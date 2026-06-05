import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, FONTS, SIZES, SPACING, RADIUS } from '../../constants/brand';
import { STEPS, CLOSING_MESSAGE } from '../../constants/steps';
import StewardText from '../../components/StewardText';
import FlameIcon from '../../components/FlameIcon';
import StepInput from '../../components/StepInput';

// ─── Message bubble ─────────────────────────────────────────────────────────────
function StewardMessage({ text }) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 320, useNativeDriver: true }).start();
  }, []);
  return (
    <Animated.View style={[styles.stewardMsg, { opacity }]}>
      <StewardText style={styles.stewardText}>{text}</StewardText>
    </Animated.View>
  );
}

function UserMessage({ text }) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  }, []);
  return (
    <Animated.View style={[styles.userMsg, { opacity }]}>
      <StewardText style={styles.userText}>{text}</StewardText>
    </Animated.View>
  );
}

function TypingIndicator() {
  return (
    <View style={styles.typingWrap}>
      <StewardText style={styles.typingDots}>· · ·</StewardText>
    </View>
  );
}

// ─── Screen ────────────────────────────────────────────────────────────────────
export default function OnboardingScreen({ navigation }) {
  const [messages, setMessages] = useState([
    { id: 0, type: 'steward', text: STEPS[0].getMessage({}) },
  ]);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef(null);

  const scrollToBottom = () => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  };

  // Format a user answer into a readable string for the bubble
  const formatUserAnswer = (key, value) => {
    if (key === 'lifeStageSignal') {
      const labels = { starting_out: 'Just starting out', building_career: 'Building my career', growing_household: 'Managing a growing household', peak_earning: 'Peak earning years', pre_retirement: 'Thinking about retirement', retired: 'Already retired' };
      return labels[value] || value;
    }
    if (key === 'household') {
      const labels = { solo: 'Just me', partner: 'Me and a partner', family: 'My family' };
      return labels[value] || value;
    }
    if (key === 'confidenceSignal') {
      const labels = { finding_footing: 'Finding my footing', making_progress: 'Making progress but not where I want to be', stable: 'Stable but could be optimised', major_change: 'Navigating a major change' };
      return labels[value] || value;
    }
    if (key === 'payFrequency') {
      const labels = { weekly: 'Weekly', biweekly: 'Every two weeks', 'semi-monthly': 'Twice a month', monthly: 'Once a month' };
      return labels[value] || value;
    }
    if (key === 'netIncome' || key === 'savings') {
      return `$${Number(value).toLocaleString()}/month`;
    }
    if (key === 'fixedCommitments') {
      if (!value || value.length === 0) return 'None';
      return value.map((i) => `${i.name} $${Number(i.amount).toLocaleString()}`).join(' · ');
    }
    if (key === 'debts') {
      if (!value || value.length === 0) return 'None right now';
      return value.map((d) => `${d.name} $${Number(d.balance).toLocaleString()}`).join(' · ');
    }
    return String(value);
  };

  const handleSubmit = (value, displayValue) => {
    const currentStep = STEPS[step];
    const newAnswers = { ...answers, [currentStep.key]: value };
    setAnswers(newAnswers);

    // Show user's response
    const userText = displayValue || formatUserAnswer(currentStep.key, value);
    setMessages((prev) => [...prev, { id: Date.now(), type: 'user', text: userText }]);
    scrollToBottom();

    const nextStep = step + 1;

    if (nextStep >= STEPS.length) {
      // Last step — show closing message then go to synthesis
      setIsTyping(true);
      scrollToBottom();
      setTimeout(() => {
        setIsTyping(false);
        setMessages((prev) => [
          ...prev,
          { id: Date.now() + 1, type: 'steward', text: CLOSING_MESSAGE },
        ]);
        scrollToBottom();
        setTimeout(() => {
          navigation.navigate('Synthesis', { profile: newAnswers });
        }, 1200);
      }, 1000);
    } else {
      // Advance to next step
      setIsTyping(true);
      scrollToBottom();
      setTimeout(() => {
        setIsTyping(false);
        const nextMessage = STEPS[nextStep].getMessage(newAnswers);
        setMessages((prev) => [
          ...prev,
          { id: Date.now() + 1, type: 'steward', text: nextMessage },
        ]);
        setStep(nextStep);
        scrollToBottom();
      }, 900);
    }
  };

  const progress = (step / STEPS.length) * 100;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <FlameIcon size={22} />
          <StewardText style={styles.wordmark}>Steward</StewardText>
        </View>
        {/* Progress bar */}
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Message thread */}
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          onContentSizeChange={scrollToBottom}
        >
          {messages.map((msg) =>
            msg.type === 'steward' ? (
              <StewardMessage key={msg.id} text={msg.text} />
            ) : (
              <UserMessage key={msg.id} text={msg.text} />
            )
          )}
          {isTyping && <TypingIndicator />}
        </ScrollView>

        {/* Input area — only show when not typing and step is valid */}
        {!isTyping && step < STEPS.length && (
          <View style={styles.inputArea}>
            <StepInput step={STEPS[step]} onSubmit={handleSubmit} />
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.parchment,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: SPACING.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  wordmark: {
    fontFamily: FONTS.serif.bold,
    fontSize: SIZES.lg,
    color: COLORS.forest,
  },
  progressTrack: {
    flex: 1,
    height: 3,
    backgroundColor: COLORS.border,
    borderRadius: RADIUS.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.ember,
    borderRadius: RADIUS.full,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.lg,
    gap: SPACING.md,
  },
  stewardMsg: {
    maxWidth: '88%',
    alignSelf: 'flex-start',
  },
  stewardText: {
    fontFamily: FONTS.sans.regular,
    fontSize: SIZES.md,
    color: COLORS.hearth,
    lineHeight: SIZES.md * 1.65,
  },
  userMsg: {
    maxWidth: '80%',
    alignSelf: 'flex-end',
    backgroundColor: COLORS.forest,
    borderRadius: RADIUS.md,
    borderBottomRightRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
  },
  userText: {
    fontFamily: FONTS.sans.regular,
    fontSize: SIZES.base,
    color: COLORS.white,
    lineHeight: SIZES.base * 1.5,
  },
  typingWrap: {
    alignSelf: 'flex-start',
    paddingVertical: SPACING.xs,
  },
  typingDots: {
    fontFamily: FONTS.sans.light,
    fontSize: SIZES.xl,
    color: COLORS.placeholder,
    letterSpacing: 4,
  },
  inputArea: {
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    padding: SPACING.md,
    paddingBottom: SPACING.lg,
  },
});
