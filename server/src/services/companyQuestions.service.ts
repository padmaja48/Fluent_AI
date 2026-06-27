import type { GeneratedQuestion } from './ai.service';

export const COMPANY_KEYS = [
  'tcs',
  'infosys',
  'wipro',
  'accenture',
  'cognizant',
  'capgemini',
  'hcltech',
  'deloitte',
  'ibm',
  'amazon',
  'microsoft',
  'google',
] as const;

export type TargetCompany = (typeof COMPANY_KEYS)[number];

export const COMPANY_LABELS: Record<TargetCompany, string> = {
  tcs: 'TCS',
  infosys: 'Infosys',
  wipro: 'Wipro',
  accenture: 'Accenture',
  cognizant: 'Cognizant',
  capgemini: 'Capgemini',
  hcltech: 'HCLTech',
  deloitte: 'Deloitte',
  ibm: 'IBM',
  amazon: 'Amazon',
  microsoft: 'Microsoft',
  google: 'Google',
};

const INTRO_QUESTION: GeneratedQuestion = {
  question: 'Introduce yourself.',
  expectedSignals: [
    'clear career summary',
    'relevant skills and projects',
    'concise reason for the role',
  ],
  questionType: 'behavioural',
  resumeReference: 'candidate overview',
};

const normalizeCompany = (company?: string): TargetCompany | undefined => {
  if (!company) return undefined;
  const normalized = company.trim().toLowerCase();
  return (COMPANY_KEYS as readonly string[]).includes(normalized)
    ? (normalized as TargetCompany)
    : undefined;
};

export const getInterviewQuestionCount = (duration: number) => Math.max(4, Math.ceil(duration / 5));

const tcsQuestions: GeneratedQuestion[] = [
  {
    question:
      'Why do you want to join TCS, and how does the role you are interviewing for fit your long-term career plan?',
    expectedSignals: ['specific motivation for TCS', 'role alignment', 'career clarity'],
    questionType: 'behavioural',
    resumeReference: 'TCS HR and managerial readiness',
  },
  {
    question:
      'TCS projects can involve client locations, rotational shifts, or relocation. How would you handle that while keeping your performance consistent?',
    expectedSignals: ['flexibility', 'professional communication', 'client delivery mindset'],
    questionType: 'situational',
    resumeReference: 'TCS delivery culture',
  },
  {
    question:
      'Pick one project from your resume and explain your exact contribution, the hardest technical issue, and the final result.',
    expectedSignals: ['ownership', 'technical depth', 'measurable outcome'],
    questionType: 'technical',
    resumeReference: 'resume project discussion',
  },
  {
    question:
      'Explain the four OOP pillars with a small example from Java, Python, or one of your own projects.',
    expectedSignals: ['encapsulation', 'inheritance or polymorphism', 'practical example'],
    questionType: 'technical',
    resumeReference: 'OOP fundamentals',
  },
  {
    question:
      'What is the difference between an array and a linked list, and when would you choose one over the other?',
    expectedSignals: ['memory layout', 'access and insertion trade-offs', 'use-case judgment'],
    questionType: 'technical',
    resumeReference: 'data structures fundamentals',
  },
  {
    question:
      'Explain normalization in DBMS and describe one problem it helps prevent in an enterprise application.',
    expectedSignals: ['normal forms', 'data redundancy', 'update anomalies'],
    questionType: 'technical',
    resumeReference: 'DBMS fundamentals',
  },
  {
    question:
      'How would you approach debugging a production issue reported by an important client?',
    expectedSignals: ['triage steps', 'logs and monitoring', 'communication and prevention'],
    questionType: 'situational',
    resumeReference: 'client-facing problem solving',
  },
  {
    question:
      'Write or explain the logic for checking whether a string is a palindrome, including edge cases you would test.',
    expectedSignals: ['algorithmic clarity', 'edge cases', 'time complexity'],
    questionType: 'technical',
    resumeReference: 'basic coding round',
  },
];

const serviceCompanyQuestions = (company: string): GeneratedQuestion[] => [
  {
    question: `Why ${company}, and what do you understand about working in a client-service delivery environment?`,
    expectedSignals: ['company awareness', 'client focus', 'role fit'],
    questionType: 'behavioural',
    resumeReference: `${company} motivation`,
  },
  {
    question:
      'Describe a time you had to learn a new tool, framework, or domain quickly to complete a task.',
    expectedSignals: ['learning process', 'execution under pressure', 'outcome'],
    questionType: 'behavioural',
    resumeReference: 'adaptability',
  },
  {
    question:
      'How would you explain a technical delay or risk to a non-technical client stakeholder?',
    expectedSignals: ['plain-language explanation', 'risk ownership', 'next steps'],
    questionType: 'situational',
    resumeReference: 'client communication',
  },
  {
    question:
      'Choose a database-backed feature from your experience and explain the schema, queries, and performance considerations.',
    expectedSignals: ['schema reasoning', 'query design', 'optimization awareness'],
    questionType: 'technical',
    resumeReference: 'database and backend fundamentals',
  },
  {
    question:
      'Explain one OOP or modular-design decision you made in a project and why it improved maintainability.',
    expectedSignals: ['design principle', 'trade-off', 'maintainability impact'],
    questionType: 'technical',
    resumeReference: 'software design fundamentals',
  },
];

const productCompanyQuestions = (company: string): GeneratedQuestion[] => [
  {
    question: `Why ${company}, and which product, platform, or engineering principle from the company interests you most?`,
    expectedSignals: ['specific company/product awareness', 'technical curiosity', 'role fit'],
    questionType: 'behavioural',
    resumeReference: `${company} motivation`,
  },
  {
    question:
      'Design a scalable service for a feature you have used recently. Walk through APIs, storage, caching, and failure handling.',
    expectedSignals: ['system boundaries', 'scalability trade-offs', 'reliability thinking'],
    questionType: 'technical',
    resumeReference: 'system design',
  },
  {
    question:
      'Tell me about a time you improved performance, reliability, or user experience in a project.',
    expectedSignals: ['baseline and metric', 'technical action', 'measured impact'],
    questionType: 'behavioural',
    resumeReference: 'impact and ownership',
  },
  {
    question:
      'How would you debug a high-latency API in production if users started reporting slow responses?',
    expectedSignals: ['observability', 'hypothesis-driven debugging', 'mitigation plan'],
    questionType: 'situational',
    resumeReference: 'production debugging',
  },
  {
    question:
      'Explain the trade-offs between SQL and NoSQL storage for a high-traffic application.',
    expectedSignals: ['data model', 'consistency and scaling', 'practical choice'],
    questionType: 'technical',
    resumeReference: 'database design',
  },
];

const getCompanyBank = (company: TargetCompany): GeneratedQuestion[] => {
  if (company === 'tcs') return tcsQuestions;
  const label = COMPANY_LABELS[company];
  if (['amazon', 'microsoft', 'google', 'ibm'].includes(company)) {
    return productCompanyQuestions(label);
  }
  return serviceCompanyQuestions(label);
};

const isIntroQuestion = (question: GeneratedQuestion) =>
  question.question.trim().toLowerCase().replace(/[?.!]+$/, '') === 'introduce yourself';

const uniqueByQuestion = (questions: GeneratedQuestion[]) => {
  const seen = new Set<string>();
  return questions.filter((item) => {
    const key = item.question.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const buildInterviewQuestionSet = ({
  generatedQuestions,
  targetCompany,
  duration,
}: {
  generatedQuestions: GeneratedQuestion[];
  targetCompany?: string;
  duration: number;
}) => {
  const company = normalizeCompany(targetCompany);
  const companyQuestions = company ? getCompanyBank(company) : [];
  const targetCount = getInterviewQuestionCount(duration);
  const generatedWithoutIntro = generatedQuestions.filter((question) => !isIntroQuestion(question));

  return uniqueByQuestion([INTRO_QUESTION, ...companyQuestions, ...generatedWithoutIntro]).slice(0, targetCount);
};
