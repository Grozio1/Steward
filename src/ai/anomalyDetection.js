import AsyncStorage from '@react-native-async-storage/async-storage';

const ANOMALIES_KEY = 'steward_anomalies';

// ─── Month utilities ──────────────────────────────────────────────────────────

function monthKey(offset) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

async function loadRaw(key) {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// ─── Stats helpers ────────────────────────────────────────────────────────────

function totalSpend(spends) {
  return (spends || []).reduce((s, sp) => s + (sp.amount || 0), 0);
}

function spendForLayer(spends, normKey) {
  return (spends || [])
    .filter(sp => (sp.layer || '').toLowerCase().replace(/\s/g, '') === normKey)
    .reduce((s, sp) => s + (sp.amount || 0), 0);
}

function mean(values) {
  if (!values.length) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function stddev(values) {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(values.reduce((s, v) => s + Math.pow(v - m, 2), 0) / values.length);
}

function isDuplicate(existing, type, layer) {
  return existing.some(a => !a.acknowledged && a.type === type && a.layer === layer);
}

function makeAnomaly(type, { layer = null, layerName = null, commitmentName = null, message }) {
  return {
    id: 'anomaly_' + Date.now(),
    detectedAt: new Date().toISOString(),
    type,
    layer,
    layerName,
    commitmentName,
    message,
    acknowledged: false,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function detectAnomalies(profile) {
  try {
    const recentKey = monthKey(1);
    const baselineKeys = [monthKey(2), monthKey(3), monthKey(4)];
    const allKeys = [recentKey, ...baselineKeys];

    const [allSpends, allPlans, lifeEventsRaw, existingRaw] = await Promise.all([
      Promise.all(allKeys.map(k => loadRaw(`steward_spends_${k}`))),
      Promise.all(allKeys.map(k => loadRaw(`steward_plan_${k}`))),
      loadRaw('steward_life_events'),
      loadRaw(ANOMALIES_KEY),
    ]);

    const [spendRecent, ...spendBaseline] = allSpends;
    const [planRecent, ...planBaseline] = allPlans;
    const lifeEvents = lifeEventsRaw || [];
    const existing = existingRaw || [];
    const newAnomalies = [];

    // ── spend_spike ──────────────────────────────────────────────────────────
    // Fires when total spend last month is > 1.5 SD above 3-month baseline.
    // Suppressed if a Navigate event was logged in that same calendar month.
    const recentTotal = totalSpend(spendRecent);
    const baselineTotals = spendBaseline.map(s => totalSpend(s));
    const baseMean = mean(baselineTotals);
    const baseSd = stddev(baselineTotals);
    const spikeThreshold = baseMean + 1.5 * baseSd;
    const spikeNavigateSuppressed = lifeEvents.some(e => e.month === recentKey);

    let spikeFired = false;
    if (
      baseMean > 0 &&
      recentTotal > spikeThreshold &&
      !spikeNavigateSuppressed &&
      !isDuplicate(existing, 'spend_spike', null)
    ) {
      spikeFired = true;
      newAnomalies.push(makeAnomaly('spend_spike', {
        message: 'Your total spending last month was higher than usual. If something changed, Navigate can help you adjust the plan.',
      }));
    }

    // ── layer_shift ──────────────────────────────────────────────────────────
    // Fires when food, qol, or adhoc spend is > 40% above its 3-month baseline.
    // Suppressed if spend_spike is active (same underlying cause).
    const hasActiveSpike = spikeFired || existing.some(a => !a.acknowledged && a.type === 'spend_spike');
    if (!hasActiveSpike) {
      const LAYER_TARGETS = [
        { key: 'food',  norm: 'food',           display: 'Food' },
        { key: 'qol',   norm: 'qualityoflife',   display: 'Quality of life' },
        { key: 'adhoc', norm: 'adhoc',           display: 'Ad hoc' },
      ];
      for (const { key, norm, display } of LAYER_TARGETS) {
        const recent = spendForLayer(spendRecent, norm);
        const baselineVals = spendBaseline.map(s => spendForLayer(s, norm));
        const layerMean = mean(baselineVals);
        if (layerMean > 0 && recent > layerMean * 1.4 && !isDuplicate(existing, 'layer_shift', key)) {
          newAnomalies.push(makeAnomaly('layer_shift', {
            layer: key,
            layerName: display,
            message: `Your ${display} spending jumped last month. Could be a one-off — worth keeping an eye on.`,
          }));
        }
      }
    }

    // ── income_change ────────────────────────────────────────────────────────
    // Fires when plan income last month differs from 3-month average by > 10%.
    // Suppressed if a Navigate event containing 'income' or 'job' was logged in the past 60 days.
    const recentIncome = planRecent?.income;
    const baselineIncomes = planBaseline.map(p => p?.income).filter(Boolean);
    if (recentIncome && baselineIncomes.length > 0) {
      const incomeMean = mean(baselineIncomes);
      const incomeDelta = Math.abs(recentIncome - incomeMean) / incomeMean;
      const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
      const incomeSuppressed = lifeEvents.some(e => {
        const label = (e.event || '').toLowerCase();
        return (label.includes('income') || label.includes('job')) && e.date >= sixtyDaysAgo;
      });
      if (incomeDelta > 0.1 && !incomeSuppressed && !isDuplicate(existing, 'income_change', null)) {
        newAnomalies.push(makeAnomaly('income_change', {
          message: "Your take-home looks different this month. If your pay changed, let's update the plan.",
        }));
      }
    }

    // ── fixed_shift ──────────────────────────────────────────────────────────
    // Fires when any fixed commitment override exceeds profile amount by > 20%
    // for two consecutive complete months.
    const [overrides1, overrides2] = await Promise.all([
      loadRaw(`steward_fixed_overrides_${monthKey(1)}`),
      loadRaw(`steward_fixed_overrides_${monthKey(2)}`),
    ]);
    const o1 = overrides1 || {};
    const o2 = overrides2 || {};
    for (const commitment of (profile.fixedCommitments || [])) {
      const threshold = commitment.amount * 1.2;
      const val1 = o1[commitment.name];
      const val2 = o2[commitment.name];
      if (
        val1 !== undefined && val2 !== undefined &&
        val1 > threshold && val2 > threshold &&
        !isDuplicate(existing, 'fixed_shift', commitment.name)
      ) {
        newAnomalies.push(makeAnomaly('fixed_shift', {
          layer: commitment.name,
          commitmentName: commitment.name,
          message: `Your ${commitment.name} has been running higher than expected for a couple of months. It may be time to update that number.`,
        }));
      }
    }

    if (newAnomalies.length > 0) {
      await AsyncStorage.setItem(ANOMALIES_KEY, JSON.stringify([...existing, ...newAnomalies]));
    }
  } catch (err) {
    console.error('[anomalyDetection] detectAnomalies failed:', err);
  }
}

export async function getUnacknowledgedAnomalies() {
  try {
    const all = (await loadRaw(ANOMALIES_KEY)) || [];
    return all.filter(a => !a.acknowledged);
  } catch {
    return [];
  }
}

export async function acknowledgeAnomaly(id) {
  try {
    const all = (await loadRaw(ANOMALIES_KEY)) || [];
    const updated = all.map(a => a.id === id ? { ...a, acknowledged: true } : a);
    await AsyncStorage.setItem(ANOMALIES_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('[anomalyDetection] acknowledgeAnomaly failed:', err);
  }
}
