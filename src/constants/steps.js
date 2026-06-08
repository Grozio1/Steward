// Onboarding conversation step definitions
// getMessage can be a string or function of (answers) => string
// Voice: parent/grandparent — warm, direct, plain

export const STEPS = [
  {
    id: 'lifeStage',
    getMessage: () =>
      "I'm Steward.\n\nWhere are you in life right now?",
    inputType: 'choice',
    key: 'lifeStageSignal',
    choices: [
      { label: 'Just starting out', value: 'starting_out' },
      { label: 'Building my career', value: 'building_career' },
      { label: 'Managing a growing household', value: 'growing_household' },
      { label: 'Peak earning years', value: 'peak_earning' },
      { label: 'Thinking about retirement', value: 'pre_retirement' },
      { label: 'Already retired', value: 'retired' },
    ],
  },
  {
    id: 'household',
    getMessage: () => "Who are you managing this for?",
    inputType: 'choice',
    key: 'household',
    choices: [
      { label: 'Just me', value: 'solo' },
      { label: 'Me and a partner', value: 'partner' },
      { label: 'My family', value: 'family' },
    ],
  },
  {
    id: 'confidenceSignal',
    getMessage: () => "How would you describe your financial situation right now?",
    inputType: 'choice',
    key: 'confidenceSignal',
    choices: [
      { label: 'Finding my footing', value: 'finding_footing' },
      { label: 'Making progress but not where I want to be', value: 'making_progress' },
      { label: 'Stable but could be optimised', value: 'stable' },
      { label: 'Navigating a major change', value: 'major_change' },
    ],
  },
  {
    id: 'priorities',
    getMessage: () => "What matters most to you right now?",
    inputType: 'text',
    key: 'priorities',
    placeholder: 'Take your time...',
    submitLabel: "That's it",
    multiline: true,
  },
  {
    id: 'name',
    getMessage: () => "Good. What should I call you?",
    inputType: 'text',
    key: 'name',
    placeholder: 'Your name',
    submitLabel: 'Continue',
    multiline: false,
  },
  {
    id: 'dateOfBirth',
    getMessage: () => "When were you born? This helps me give you guidance that fits where you are in life.",
    inputType: 'date',
    key: 'dateOfBirth',
    placeholder: 'MM/DD/YYYY',
    submitLabel: 'Continue',
  },
  {
    id: 'jobStartDate',
    getMessage: () => "When did you start your current job?",
    inputType: 'date',
    key: 'jobStartDate',
    placeholder: 'MM/DD/YYYY',
    submitLabel: 'Continue',
    skipLabel: 'Skip for now',
    optional: true,
  },
  {
    id: 'income',
    getMessage: (a) =>
      `Good to meet you, ${a.name}.\n\nWhat's your take-home pay per paycheck — after taxes and deductions?`,
    inputType: 'currency',
    key: 'netIncome',
    placeholder: '0',
    submitLabel: "That's right",
  },
  {
    id: 'payFrequency',
    getMessage: () => 'How does that come in?',
    inputType: 'choice',
    key: 'payFrequency',
    choices: [
      { label: 'Weekly', value: 'weekly' },
      { label: 'Every two weeks', value: 'biweekly' },
      { label: 'Twice a month', value: 'semi-monthly' },
      { label: 'Once a month', value: 'monthly' },
    ],
  },
  {
    id: 'nextPayDate',
    prompt: "When does your next paycheck arrive?",
    inputType: 'text',
    placeholder: 'e.g. June 15 or the 1st and 15th',
    key: 'nextPayDate',
  },
  {
    id: 'fixedCommitments',
    getMessage: () =>
      "Now the things that hit automatically — rent, utilities, insurance, subscriptions. Walk me through those.",
    inputType: 'bareMinimum',
    key: 'fixedCommitments',
    submitLabel: 'Done',
  },
  {
    id: 'debts',
    getMessage: () =>
      "Any debt I should know about? Cards, loans, anything with a minimum payment.",
    inputType: 'debtList',
    key: 'debts',
    namePlaceholder: 'e.g. Visa card',
    submitLabel: 'Done',
    skipLabel: 'None right now',
  },
  {
    id: 'savings',
    getMessage: () =>
      "What do you have accessible right now — savings, checking, anything you could reach if you needed to?",
    inputType: 'currency',
    key: 'savings',
    placeholder: '0',
    submitLabel: "That's right",
  },
  {
    id: 'goals',
    getMessage: () =>
      "Last one. What are you working toward? Could be one thing, could be three. Don't overthink it.",
    inputType: 'text',
    key: 'goals',
    placeholder: 'e.g. Pay off my card, save for a trip...',
    submitLabel: 'Done',
    multiline: true,
  },
];

export const CLOSING_MESSAGE =
  "Got it. Let me put this together.";
