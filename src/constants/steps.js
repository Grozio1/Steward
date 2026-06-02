// Onboarding conversation step definitions
// getMessage can be a string or function of (answers) => string
// Voice: parent/grandparent — warm, direct, plain

export const STEPS = [
  {
    id: 'welcome',
    getMessage: () =>
      "I'm Steward.\n\nBefore we look at any numbers — what does better actually look like for you? What would you notice first if things were on track?",
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
    id: 'income',
    getMessage: (a) =>
      `Good to meet you, ${a.name}.\n\nWhat do you take home each month? If it varies, give me a typical month.`,
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
      { label: 'Twice a month', value: 'semimonthly' },
      { label: 'Once a month', value: 'monthly' },
    ],
  },
  {
    id: 'fixedCommitments',
    getMessage: () =>
      "Now the things that hit automatically — rent, utilities, insurance, subscriptions. Walk me through those.",
    inputType: 'list',
    key: 'fixedCommitments',
    namePlaceholder: 'e.g. Rent',
    amountPlaceholder: '0',
    showFrequency: true,
    submitLabel: 'Done',
    skipLabel: 'None',
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
