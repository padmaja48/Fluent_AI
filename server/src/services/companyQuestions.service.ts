import type { GeneratedQuestion } from './ai.service';

const COMPANY_NAMES = [
  'JPMorgan Chase',
  'Amazon',
  'UBS',
  'Bank of America',
  'Arcesium',
  'SAP',
  'Deloitte',
  'IBM',
  'Cognizant',
  'Accenture',
  'Capgemini',
  'Wipro',
  'RealPage',
  'HighRadius',
  'CDK Global',
  'Vitech Systems',
  'YASH Technologies',
  'Trianz',
  'Parexel',
  'Thryve Digital',
  'Carrier Technologies',
  'Ascensus',
  'OpenText',
  'Oracle',
  'ADP',
  'Dell',
  'Virtusa',
  'ValueLabs',
  'HCL',
  'Avineon India',
  'TEKsystems',
  'Quantela',
  'Megasoft',
  'Vertex Offshore Services',
  'Lantronix India',
  'Pennant Technologies',
  'Incipio Technologies',
  'Vilas Business Solutions',
  'Virpie Info Technologies',
  'Seanergy Digital Services',
  'Desidea Software Technologies',
  'Jointlook Services',
  'BostonLogix',
  'S2Tech',
  'Lanco Global Systems',
  'Vertex Computer Systems',
  'SmartPlay Technologies',
  'ZenQ',
  'CenturyLink',
  'MarketTools',
  'Sitel',
  'Salesforce',
  'GF Digital',
  'CenturyLink (Lumen)',
  'NTT DATA',
  'ABB',
  'Celigo',
  'Tech Mahindra',
  'Cambridge Technology',
  'Valyd Software',
  'Levadata',
  'Innopark',
  'SD Softech',
  'UMC',
  'eCentric Solutions',
  'RSA',
  'Valyd Info Solutions',
  'SmartDocs Technologies',
  'Covalense Digital',
  'Marlabs',
  'NXP Semiconductors',
  'Medtronic',
  'Collins Aerospace',
  'GlobalLogic',
  'Hitachi Solutions',
  'CGI',
  'Unisys',
  'Axtria',
  'Genpact',
  'Zensar',
  'GlobalLogic Technologies',
  'Sagility India (HGS Healthcare)',
  'TIBCO Software India',
  'Alight Solutions (NGA HR)',
  'DXC Technology India',
  'Microsoft',
  'Google',
  'Apple',
  'Meta',
  'NVIDIA',
  'Intel',
  'AMD',
  'Qualcomm',
  'Cisco',
  'Adobe',
  'VMware',
  'ServiceNow',
  'Atlassian',
  'Zoho',
  'Freshworks',
  'PayPal',
  'Walmart Global Tech',
  'Goldman Sachs',
  'Morgan Stanley',
  'American Express',
  'Visa',
  'Mastercard',
  'Flipkart',
  'Meesho',
  'PhonePe',
  'Razorpay',
  'CRED',
  'Swiggy',
  'Zomato',
  'Ola',
  'Uber',
  'InMobi',
  'Oracle Financial Services Software (OFSS)',
  'Intuit',
  'Synopsys',
  'Cadence',
  'Siemens',
  'Siemens Healthineers',
  'Honeywell',
  'Philips',
  'Bosch Global Software Technologies',
  'Schneider Electric',
  'GE Healthcare',
  'Ericsson',
  'Nokia',
  'Samsung R&D Institute India',
  'LG Soft India',
  'Harman',
  'Continental',
  'Aptiv',
  'Volvo Group',
  'Mercedes-Benz Research and Development India',
  'Renault Nissan Technology & Business Centre India',
  'Tata Elxsi',
  'LTIMindtree',
  'L&T Technology Services (LTTS)',
  'Mphasis',
  'Persistent Systems',
  'Hexaware Technologies',
  'Sonata Software',
  'Birlasoft',
  'KPIT Technologies',
  'Cyient',
  'Coforge',
  'UST',
  'Brillio',
  'Happiest Minds',
  'Nagarro',
  'Newgen Software',
  'CitiusTech',
  'Fiserv',
  'FIS',
  'Fidelity Investments',
  'FactSet',
  'Broadridge',
  'Western Digital',
  'Micron Technology',
  'AMDOCS',
  'McKinsey & Company',
  'Bain & Company',
  'KPMG',
  'EY',
  'PwC',
  'Grant Thornton',
  'RSM',
  'Ericsson India',
  'Juniper Networks',
  'Red Hat',
  'SAP Labs India',
  'Informatica',
  'Nutanix',
  'Rubrik',
  'Cohesity',
  'Cloudera',
  'Snowflake',
  'Palo Alto Networks',
  'CrowdStrike',
  'Check Point Software Technologies',
  'Fortinet',
  'Cloudflare',
  'Expedia Group',
  'Agoda',
  'Booking.com',
  'BlackRock',
  'Shell',
  'BP',
  'ExxonMobil',
  'Shell Info Technologies',
  'PepsiCo Global Business Services',
  'Unilever',
  'Procter & Gamble (P&G)',
  'Reckitt',
  'Mondelez International',
  'PepsiCo',
  'Johnson Controls',
  'Optum',
  'UnitedHealth Group',
  'Cerner (Oracle Health)',
  'Epic Systems',
  'AstraZeneca',
  'Novartis',
  'Roche',
  'Pfizer',
  'Eli Lilly',
  'Sanofi',
  "Dr. Reddy's Laboratories",
  'Biocon',
  'IQVIA',
  'Deloitte USI',
  'EY GDS',
  'PwC India',
  'KPMG India',
  'BNY',
  'State Street',
  'Barclays',
  'HSBC',
  'Standard Chartered',
  'NatWest Group',
  'Deutsche Bank',
  'Societe Generale',
  'Wells Fargo',
  'Northern Trust',
  'TCS',
  'Infosys',
  'HCLTech',
] as const;

const slugifyCompany = (name: string) =>
  name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\+/g, ' plus ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const COMPANY_LABELS = Object.fromEntries(
  Array.from(new Map(COMPANY_NAMES.map((name) => [slugifyCompany(name), name])).entries()),
) as Record<string, string>;

export const COMPANY_KEYS = Object.keys(COMPANY_LABELS);

export const isKnownCompany = (company?: string) =>
  Boolean(company && Object.prototype.hasOwnProperty.call(COMPANY_LABELS, company));

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

const normalizeCompany = (company?: string) => {
  if (!company) return undefined;
  const normalized = slugifyCompany(company.trim());
  return isKnownCompany(normalized) ? normalized : undefined;
};

export const getInterviewQuestionCount = (duration: number) => Math.max(4, Math.ceil(duration / 5));

const tcsQuestions = (company: string): GeneratedQuestion[] => [
  {
    question:
      `Why do you want to join ${company}, and how does this role fit your long-term career plan?`,
    expectedSignals: ['specific motivation', 'role alignment', 'career clarity'],
    questionType: 'behavioural',
    resumeReference: `${company} HR and managerial readiness`,
  },
  {
    question:
      `${company} projects can involve client locations, rotational shifts, or relocation. How would you handle that while keeping your performance consistent?`,
    expectedSignals: ['flexibility', 'professional communication', 'client delivery mindset'],
    questionType: 'situational',
    resumeReference: `${company} delivery culture`,
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
    expectedSignals: ['specific company or product awareness', 'technical curiosity', 'role fit'],
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

const financeCompanyQuestions = (company: string): GeneratedQuestion[] => [
  {
    question: `Why ${company}, and what interests you about building technology for financial services?`,
    expectedSignals: ['domain motivation', 'risk and trust awareness', 'role alignment'],
    questionType: 'behavioural',
    resumeReference: `${company} finance domain motivation`,
  },
  {
    question:
      'How would you design a transaction-processing flow that prevents duplicate payments and keeps an audit trail?',
    expectedSignals: ['idempotency', 'transaction integrity', 'auditability'],
    questionType: 'technical',
    resumeReference: 'financial systems design',
  },
  {
    question:
      'A trade, payment, or invoice job fails halfway through processing. How would you recover safely without corrupting data?',
    expectedSignals: ['rollback or retry strategy', 'data reconciliation', 'monitoring'],
    questionType: 'situational',
    resumeReference: 'financial reliability',
  },
  {
    question:
      'Explain how you would secure sensitive customer or financial data in an application.',
    expectedSignals: ['access control', 'encryption', 'least privilege and compliance awareness'],
    questionType: 'technical',
    resumeReference: 'security and compliance',
  },
  {
    question:
      'Tell me about a time you handled accuracy, deadlines, or ambiguity in a high-stakes project.',
    expectedSignals: ['attention to detail', 'prioritization', 'stakeholder communication'],
    questionType: 'behavioural',
    resumeReference: 'high-stakes delivery',
  },
];

const consultingCompanyQuestions = (company: string): GeneratedQuestion[] => [
  {
    question: `Why ${company}, and how would you approach technology consulting for a new client?`,
    expectedSignals: ['consulting motivation', 'structured discovery', 'client empathy'],
    questionType: 'behavioural',
    resumeReference: `${company} consulting fit`,
  },
  {
    question:
      'A client asks for a feature that may not solve the real business problem. How would you clarify requirements?',
    expectedSignals: ['questioning', 'problem framing', 'stakeholder alignment'],
    questionType: 'situational',
    resumeReference: 'client discovery',
  },
  {
    question:
      'Walk me through how you would estimate, plan, and de-risk a six-week implementation project.',
    expectedSignals: ['scope breakdown', 'risk management', 'delivery milestones'],
    questionType: 'situational',
    resumeReference: 'project delivery',
  },
  {
    question:
      'Explain a technical decision to a business stakeholder who cares mainly about cost, timeline, and impact.',
    expectedSignals: ['translation of technical trade-offs', 'business impact', 'recommendation clarity'],
    questionType: 'behavioural',
    resumeReference: 'executive communication',
  },
  {
    question:
      'Describe a time you worked across teams to solve a problem with unclear ownership.',
    expectedSignals: ['collaboration', 'ownership', 'conflict resolution'],
    questionType: 'behavioural',
    resumeReference: 'cross-functional work',
  },
];

const enterpriseSaasQuestions = (company: string): GeneratedQuestion[] => [
  {
    question: `Why ${company}, and what do you understand about enterprise software customers?`,
    expectedSignals: ['enterprise customer awareness', 'product/platform interest', 'role fit'],
    questionType: 'behavioural',
    resumeReference: `${company} enterprise SaaS motivation`,
  },
  {
    question:
      'How would you design role-based access control for a multi-tenant SaaS product?',
    expectedSignals: ['tenant isolation', 'roles and permissions', 'security testing'],
    questionType: 'technical',
    resumeReference: 'enterprise security design',
  },
  {
    question:
      'A large customer reports a workflow regression after a release. How would you triage and communicate the fix?',
    expectedSignals: ['rollback or hotfix thinking', 'customer communication', 'root cause analysis'],
    questionType: 'situational',
    resumeReference: 'enterprise support',
  },
  {
    question:
      'Explain how you would make an API backward-compatible while still shipping new functionality.',
    expectedSignals: ['versioning', 'contract testing', 'migration strategy'],
    questionType: 'technical',
    resumeReference: 'API design',
  },
  {
    question:
      'Tell me about a time you improved maintainability or developer productivity in a project.',
    expectedSignals: ['code quality', 'tooling or process improvement', 'measurable impact'],
    questionType: 'behavioural',
    resumeReference: 'engineering productivity',
  },
];

const healthcareQuestions = (company: string): GeneratedQuestion[] => [
  {
    question: `Why ${company}, and what responsibilities come with building technology for healthcare or life sciences?`,
    expectedSignals: ['domain motivation', 'patient or clinical impact', 'data sensitivity'],
    questionType: 'behavioural',
    resumeReference: `${company} healthcare domain motivation`,
  },
  {
    question:
      'How would you design a system that stores sensitive health data while supporting auditability and access control?',
    expectedSignals: ['privacy', 'audit logs', 'role-based access'],
    questionType: 'technical',
    resumeReference: 'health data systems',
  },
  {
    question:
      'A clinical or healthcare workflow has missing or inconsistent data. How would you validate and recover safely?',
    expectedSignals: ['validation rules', 'data quality checks', 'escalation path'],
    questionType: 'situational',
    resumeReference: 'data quality',
  },
  {
    question:
      'Tell me about a time you balanced speed with quality in a project where mistakes would have serious consequences.',
    expectedSignals: ['quality discipline', 'risk management', 'testing approach'],
    questionType: 'behavioural',
    resumeReference: 'quality-sensitive delivery',
  },
  {
    question:
      'Explain how you would test an integration between two systems that exchange critical user or patient records.',
    expectedSignals: ['integration testing', 'edge cases', 'observability'],
    questionType: 'technical',
    resumeReference: 'healthcare integrations',
  },
];

const embeddedQuestions = (company: string): GeneratedQuestion[] => [
  {
    question: `Why ${company}, and what interests you about hardware, embedded, semiconductor, or low-level systems work?`,
    expectedSignals: ['domain interest', 'systems thinking', 'role fit'],
    questionType: 'behavioural',
    resumeReference: `${company} embedded systems motivation`,
  },
  {
    question:
      'Explain a low-level debugging approach for an intermittent performance or memory issue.',
    expectedSignals: ['profiling', 'memory or concurrency awareness', 'reproducible investigation'],
    questionType: 'technical',
    resumeReference: 'systems debugging',
  },
  {
    question:
      'How would you design software that must be reliable under resource constraints?',
    expectedSignals: ['resource limits', 'failure modes', 'testing strategy'],
    questionType: 'technical',
    resumeReference: 'embedded reliability',
  },
  {
    question:
      'Describe a time you optimized code for latency, throughput, memory, or power usage.',
    expectedSignals: ['baseline measurement', 'optimization trade-off', 'validated impact'],
    questionType: 'behavioural',
    resumeReference: 'performance optimization',
  },
  {
    question:
      'How would you explain a complex hardware-software interaction to a teammate from a different discipline?',
    expectedSignals: ['clear explanation', 'cross-functional collaboration', 'technical accuracy'],
    questionType: 'situational',
    resumeReference: 'cross-discipline communication',
  },
];

const consumerQuestions = (company: string): GeneratedQuestion[] => [
  {
    question: `Why ${company}, and what user or customer problem from its domain would you like to work on?`,
    expectedSignals: ['user empathy', 'business/domain awareness', 'role fit'],
    questionType: 'behavioural',
    resumeReference: `${company} consumer domain motivation`,
  },
  {
    question:
      'How would you design a high-traffic checkout, booking, ordering, or ride-matching flow?',
    expectedSignals: ['peak traffic handling', 'data consistency', 'graceful degradation'],
    questionType: 'technical',
    resumeReference: 'consumer-scale systems',
  },
  {
    question:
      'A key funnel metric drops after a release. How would you investigate whether it is a product issue or a technical issue?',
    expectedSignals: ['metrics analysis', 'experimentation', 'rollback or fix strategy'],
    questionType: 'situational',
    resumeReference: 'product debugging',
  },
  {
    question:
      'Tell me about a time you used data or feedback to improve a feature.',
    expectedSignals: ['feedback loop', 'decision making', 'measured outcome'],
    questionType: 'behavioural',
    resumeReference: 'data-informed product work',
  },
  {
    question:
      'Explain how you would protect user privacy while still personalizing an application experience.',
    expectedSignals: ['privacy controls', 'data minimization', 'secure personalization'],
    questionType: 'technical',
    resumeReference: 'user data protection',
  },
];

const cybersecurityQuestions = (company: string): GeneratedQuestion[] => [
  {
    question: `Why ${company}, and what security or cloud reliability problem interests you most?`,
    expectedSignals: ['security awareness', 'cloud/domain motivation', 'role fit'],
    questionType: 'behavioural',
    resumeReference: `${company} security or cloud motivation`,
  },
  {
    question:
      'How would you detect, investigate, and contain suspicious traffic or unauthorized access in a production system?',
    expectedSignals: ['detection signals', 'incident response', 'containment and remediation'],
    questionType: 'situational',
    resumeReference: 'security incident response',
  },
  {
    question:
      'Explain how TLS, authentication, and authorization work together to protect an API.',
    expectedSignals: ['transport security', 'identity', 'permission checks'],
    questionType: 'technical',
    resumeReference: 'API security fundamentals',
  },
  {
    question:
      'How would you design a cloud service to tolerate regional failures or sudden traffic spikes?',
    expectedSignals: ['redundancy', 'autoscaling', 'failover strategy'],
    questionType: 'technical',
    resumeReference: 'cloud reliability',
  },
  {
    question:
      'Tell me about a time you found or prevented a reliability, security, or data-quality issue.',
    expectedSignals: ['risk identification', 'preventive action', 'impact'],
    questionType: 'behavioural',
    resumeReference: 'risk prevention',
  },
];

const industrialQuestions = (company: string): GeneratedQuestion[] => [
  {
    question: `Why ${company}, and what interests you about engineering software for industrial, automotive, aerospace, or energy systems?`,
    expectedSignals: ['domain motivation', 'reliability mindset', 'role fit'],
    questionType: 'behavioural',
    resumeReference: `${company} industrial domain motivation`,
  },
  {
    question:
      'How would you design software for a system where downtime, sensor errors, or incorrect decisions can be costly?',
    expectedSignals: ['fault tolerance', 'validation', 'monitoring and alerts'],
    questionType: 'technical',
    resumeReference: 'industrial reliability',
  },
  {
    question:
      'Describe a time you handled integration between software and an external device, vendor system, or legacy platform.',
    expectedSignals: ['interface contract', 'testing strategy', 'error handling'],
    questionType: 'behavioural',
    resumeReference: 'systems integration',
  },
  {
    question:
      'How would you analyze telemetry or sensor data to identify anomalies before they affect users?',
    expectedSignals: ['data pipeline', 'thresholds or models', 'alerting'],
    questionType: 'technical',
    resumeReference: 'telemetry and analytics',
  },
  {
    question:
      'Explain a technical trade-off you would make between safety, cost, latency, and maintainability.',
    expectedSignals: ['trade-off reasoning', 'risk awareness', 'decision clarity'],
    questionType: 'situational',
    resumeReference: 'engineering judgment',
  },
];

const CATEGORY_KEYWORDS: Array<{ category: string; labels: string[] }> = [
  {
    category: 'finance',
    labels: [
      'JPMorgan Chase', 'UBS', 'Bank of America', 'Arcesium', 'HighRadius', 'Ascensus',
      'Goldman Sachs', 'Morgan Stanley', 'American Express', 'Visa', 'Mastercard',
      'Oracle Financial Services Software (OFSS)', 'PayPal', 'Razorpay', 'CRED', 'Fiserv',
      'FIS', 'Fidelity Investments', 'FactSet', 'Broadridge', 'BlackRock', 'BNY',
      'State Street', 'Barclays', 'HSBC', 'Standard Chartered', 'NatWest Group',
      'Deutsche Bank', 'Societe Generale', 'Wells Fargo', 'Northern Trust',
    ],
  },
  {
    category: 'consulting',
    labels: [
      'Deloitte', 'Accenture', 'Trianz', 'Axtria', 'Genpact', 'McKinsey & Company',
      'Bain & Company', 'KPMG', 'EY', 'PwC', 'Grant Thornton', 'RSM', 'Deloitte USI',
      'EY GDS', 'PwC India', 'KPMG India',
    ],
  },
  {
    category: 'embedded',
    labels: [
      'NXP Semiconductors', 'NVIDIA', 'Intel', 'AMD', 'Qualcomm', 'Cisco', 'Synopsys',
      'Cadence', 'Western Digital', 'Micron Technology', 'Juniper Networks',
      'Samsung R&D Institute India', 'LG Soft India', 'SmartPlay Technologies',
      'Lantronix India',
    ],
  },
  {
    category: 'healthcare',
    labels: [
      'Parexel', 'Thryve Digital', 'Medtronic', 'Sagility India (HGS Healthcare)',
      'Siemens Healthineers', 'GE Healthcare', 'CitiusTech', 'Optum', 'UnitedHealth Group',
      'Cerner (Oracle Health)', 'Epic Systems', 'AstraZeneca', 'Novartis', 'Roche',
      'Pfizer', 'Eli Lilly', 'Sanofi', "Dr. Reddy's Laboratories", 'Biocon', 'IQVIA',
    ],
  },
  {
    category: 'enterpriseSaas',
    labels: [
      'SAP', 'SAP Labs India', 'OpenText', 'Oracle', 'ADP', 'RealPage', 'Salesforce',
      'Celigo', 'TIBCO Software India', 'Microsoft', 'Adobe', 'VMware', 'ServiceNow',
      'Atlassian', 'Zoho', 'Freshworks', 'Intuit', 'Informatica', 'Nutanix', 'Rubrik',
      'Cohesity', 'Cloudera', 'Snowflake', 'Red Hat', 'Newgen Software', 'SmartDocs Technologies',
    ],
  },
  {
    category: 'cybersecurity',
    labels: [
      'Palo Alto Networks', 'CrowdStrike', 'Check Point Software Technologies', 'Fortinet',
      'Cloudflare', 'RSA',
    ],
  },
  {
    category: 'industrial',
    labels: [
      'Carrier Technologies', 'CDK Global', 'ABB', 'Collins Aerospace', 'Siemens',
      'Honeywell', 'Philips', 'Bosch Global Software Technologies', 'Schneider Electric',
      'Ericsson', 'Ericsson India', 'Nokia', 'Harman', 'Continental', 'Aptiv', 'Volvo Group',
      'Mercedes-Benz Research and Development India', 'Renault Nissan Technology & Business Centre India',
      'Tata Elxsi', 'L&T Technology Services (LTTS)', 'KPIT Technologies', 'Cyient',
      'Johnson Controls', 'Shell', 'BP', 'ExxonMobil', 'Shell Info Technologies',
    ],
  },
  {
    category: 'consumer',
    labels: [
      'Amazon', 'Apple', 'Meta', 'Google', 'Walmart Global Tech', 'Flipkart', 'Meesho',
      'PhonePe', 'Swiggy', 'Zomato', 'Ola', 'Uber', 'InMobi', 'Expedia Group', 'Agoda',
      'Booking.com', 'PepsiCo Global Business Services', 'Unilever', 'Procter & Gamble (P&G)',
      'Reckitt', 'Mondelez International', 'PepsiCo',
    ],
  },
];

const CATEGORY_BY_KEY = new Map(
  CATEGORY_KEYWORDS.flatMap(({ category, labels }) =>
    labels.map((label) => [slugifyCompany(label), category] as const),
  ),
);

const getCompanyBank = (companyKey: string): GeneratedQuestion[] => {
  const label = COMPANY_LABELS[companyKey] ?? companyKey;
  if (companyKey === 'tcs') return tcsQuestions(label);

  switch (CATEGORY_BY_KEY.get(companyKey)) {
    case 'finance':
      return financeCompanyQuestions(label);
    case 'consulting':
      return consultingCompanyQuestions(label);
    case 'embedded':
      return embeddedQuestions(label);
    case 'healthcare':
      return healthcareQuestions(label);
    case 'enterpriseSaas':
      return enterpriseSaasQuestions(label);
    case 'cybersecurity':
      return cybersecurityQuestions(label);
    case 'industrial':
      return industrialQuestions(label);
    case 'consumer':
      return consumerQuestions(label);
    default:
      return ['microsoft', 'google', 'amazon', 'apple', 'meta', 'ibm'].includes(companyKey)
        ? productCompanyQuestions(label)
        : serviceCompanyQuestions(label);
  }
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
  prioritizeGenerated = false,
}: {
  generatedQuestions: GeneratedQuestion[];
  targetCompany?: string;
  duration: number;
  prioritizeGenerated?: boolean;
}) => {
  const company = normalizeCompany(targetCompany);
  const companyQuestions = company ? getCompanyBank(company) : [];
  const targetCount = getInterviewQuestionCount(duration);
  const generatedWithoutIntro = generatedQuestions.filter((question) => !isIntroQuestion(question));
  const orderedQuestions = prioritizeGenerated
    ? [INTRO_QUESTION, ...generatedWithoutIntro, ...companyQuestions]
    : [INTRO_QUESTION, ...companyQuestions, ...generatedWithoutIntro];

  return uniqueByQuestion(orderedQuestions).slice(0, targetCount);
};
