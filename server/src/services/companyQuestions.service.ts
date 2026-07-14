import type {
  CompanyInterviewGuidance,
  GeneratedQuestion,
  InterviewRoadmap,
  InterviewRoadmapSection,
  InterviewRoadmapSectionKey,
  InterviewRuntimeState,
  JobDescriptionProfile,
  ResumeInterviewProfile,
} from './ai.service';

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
  difficulty: 'easy',
  topic: 'Candidate overview',
  followUpIntent: 'bridge-topic',
};

const normalizeCompany = (company?: string) => {
  if (!company) return undefined;
  const normalized = slugifyCompany(company.trim());
  return isKnownCompany(normalized) ? normalized : undefined;
};

export const getInterviewQuestionCount = (duration: number) => {
  if (duration <= 15) return 10;
  if (duration <= 20) return 13;
  if (duration <= 30) return 18;
  if (duration <= 45) return 26;
  return 34;
};

const normalizeTopic = (value: string) => value.replace(/\s+/g, ' ').trim();

const uniqueTopics = (values: string[]) =>
  Array.from(new Set(values.map(normalizeTopic).filter(Boolean)));

const sentenceCase = (value: string) => {
  const clean = normalizeTopic(value);
  return clean ? clean.charAt(0).toUpperCase() + clean.slice(1) : clean;
};

const textHas = (text: string, pattern: RegExp) => pattern.test(text);

const detectTerms = (text: string, catalog: Array<[string, RegExp]>) =>
  uniqueTopics(catalog.filter(([, pattern]) => textHas(text, pattern)).map(([label]) => label));

const PROGRAMMING_LANGUAGE_PATTERNS: Array<[string, RegExp]> = [
  ['Python', /\bpython\b/i],
  ['Java', /\bjava\b/i],
  ['C++', /\bc\+\+\b/i],
  ['C', /\bc programming\b|\blanguage c\b/i],
  ['JavaScript', /\bjavascript|js\b/i],
  ['TypeScript', /\btypescript|ts\b/i],
  ['C#', /\bc#\b/i],
  ['Go', /\bgolang\b|\bgo\b/i],
  ['PHP', /\bphp\b/i],
  ['Ruby', /\bruby\b/i],
  ['Kotlin', /\bkotlin\b/i],
  ['Swift', /\bswift\b/i],
  ['R', /\br programming\b|\blanguage r\b/i],
];

const FRAMEWORK_PATTERNS: Array<[string, RegExp]> = [
  ['React', /\breact(?:\.js|js)?\b/i],
  ['Angular', /\bangular\b/i],
  ['Vue.js', /\bvue(?:\.js|js)?\b/i],
  ['Node.js', /\bnode(?:\.js|js)?\b/i],
  ['Express.js', /\bexpress(?:\.js|js)?\b/i],
  ['Next.js', /\bnext(?:\.js|js)?\b/i],
  ['Django', /\bdjango\b/i],
  ['Flask', /\bflask\b/i],
  ['FastAPI', /\bfastapi|fast api\b/i],
  ['Spring Boot', /\bspring\s*boot\b/i],
  ['Laravel', /\blaravel\b/i],
  ['Redux', /\bredux\b/i],
];

const LIBRARY_PATTERNS: Array<[string, RegExp]> = [
  ['Pandas', /\bpandas\b/i],
  ['NumPy', /\bnumpy\b/i],
  ['TensorFlow', /\btensorflow\b/i],
  ['PyTorch', /\bpytorch\b/i],
  ['Scikit-learn', /\bscikit[-\s]?learn|sklearn\b/i],
  ['OpenCV', /\bopencv\b/i],
  ['Keras', /\bkeras\b/i],
  ['LangChain', /\blangchain\b/i],
];

const DATABASE_PATTERNS: Array<[string, RegExp]> = [
  ['SQL', /\bsql\b/i],
  ['MySQL', /\bmysql\b/i],
  ['PostgreSQL', /\bpostgres(?:ql)?\b/i],
  ['MongoDB', /\bmongodb|mongo db\b/i],
  ['Redis', /\bredis\b/i],
  ['Oracle Database', /\boracle database|oracle sql\b/i],
  ['SQLite', /\bsqlite\b/i],
  ['Firebase', /\bfirebase\b/i],
];

const CLOUD_PATTERNS: Array<[string, RegExp]> = [
  ['AWS', /\baws|amazon web services\b/i],
  ['Azure', /\bazure\b/i],
  ['Google Cloud', /\bgcp|google cloud\b/i],
  ['Docker', /\bdocker\b/i],
  ['Kubernetes', /\bkubernetes|k8s\b/i],
  ['Terraform', /\bterraform\b/i],
  ['Jenkins', /\bjenkins\b/i],
  ['CI/CD', /\bci\/cd|continuous integration|continuous deployment\b/i],
];

const OS_PATTERNS: Array<[string, RegExp]> = [
  ['Linux', /\blinux\b/i],
  ['Unix', /\bunix\b/i],
  ['Windows', /\bwindows\b/i],
  ['macOS', /\bmacos|mac os\b/i],
];

const TOOL_PATTERNS: Array<[string, RegExp]> = [
  ['GitHub', /\bgithub\b/i],
  ['Git', /\bgit\b/i],
  ['Postman', /\bpostman\b/i],
  ['VS Code', /\bvs\s*code|visual studio code\b/i],
  ['Jira', /\bjira\b/i],
  ['Figma', /\bfigma\b/i],
  ['Tableau', /\btableau\b/i],
  ['Power BI', /\bpower\s*bi\b/i],
];

const TECHNICAL_SKILL_PATTERNS: Array<[string, RegExp]> = [
  ['OOP', /\boop|object[-\s]?oriented\b/i],
  ['Data Structures', /\bdata structures?\b|\bdsa\b/i],
  ['Algorithms', /\balgorithms?\b|\bdsa\b/i],
  ['REST APIs', /\brest(?:ful)?\s+api?s?\b/i],
  ['GraphQL', /\bgraphql\b/i],
  ['Machine Learning', /\bmachine learning|\bml\b/i],
  ['Deep Learning', /\bdeep learning\b/i],
  ['Artificial Intelligence', /\bartificial intelligence|\bai\b/i],
  ['Generative AI', /\bgenerative ai|genai|llm|large language model\b/i],
  ['RAG', /\brag|retrieval augmented generation\b/i],
  ['Vector Databases', /\bvector database|embeddings?\b/i],
  ['System Design', /\bsystem design\b/i],
  ['DBMS', /\bdbms\b/i],
  ['Operating Systems', /\boperating systems?\b|\bos\b/i],
  ['Computer Networks', /\bcomputer networks?|networking\b/i],
  ['Cyber Security', /\bcyber ?security|security\b/i],
  ['HTML', /\bhtml\b/i],
  ['CSS', /\bcss\b/i],
  ['Digital Marketing', /\bdigital marketing\b/i],
  ['SEO', /\bseo|search engine optimization\b/i],
  ['SEM', /\bsem|search engine marketing\b/i],
  ['Google Ads', /\bgoogle ads|adwords\b/i],
  ['Meta Ads', /\bmeta ads|facebook ads|instagram ads\b/i],
  ['Social Media Marketing', /\bsocial media marketing|social media\b/i],
  ['Content Marketing', /\bcontent marketing|content strategy\b/i],
  ['Email Marketing', /\bemail marketing\b/i],
  ['Google Analytics', /\bgoogle analytics|ga4\b/i],
  ['PPC', /\bppc|pay per click\b/i],
  ['Campaign Management', /\bcampaign management|campaign strategy\b/i],
  ['Conversion Optimization', /\bconversion optimization|cro\b/i],
];

const SOFT_SKILL_PATTERNS: Array<[string, RegExp]> = [
  ['Communication', /\bcommunication|presentation\b/i],
  ['Leadership', /\bleadership|led\b/i],
  ['Teamwork', /\bteamwork|collaboration|collaborated\b/i],
  ['Problem Solving', /\bproblem[-\s]?solving|debugging\b/i],
  ['Adaptability', /\badaptability|learned quickly|fast[-\s]?paced\b/i],
];

const SECTION_HEADINGS: Record<string, RegExp> = {
  projects: /\b(projects?|academic projects?|personal projects?)\b/i,
  internships: /\b(internships?|internship experience|training)\b/i,
  workExperience: /\b(work experience|professional experience|employment|experience)\b/i,
  certifications: /\b(certifications?|certificates?|licenses?)\b/i,
  achievements: /\b(achievements?|awards?|honou?rs?)\b/i,
  hackathons: /\b(hackathons?|coding competitions?)\b/i,
  researchPapers: /\b(research papers?|research work)\b/i,
  publications: /\b(publications?)\b/i,
  leadership: /\b(leadership|positions? of responsibility|responsibilities)\b/i,
  areasOfInterest: /\b(areas? of interest|interests?)\b/i,
  education: /\b(education|academic background|qualification)\b/i,
};

const splitResumeLines = (resumeText?: string) =>
  (resumeText ?? '')
    .split(/\r?\n/)
    .map((line) => line.replace(/^[\s>*-]+/, '').trim())
    .filter((line) => line.length > 1);

const isLikelyHeading = (line: string) =>
  Object.values(SECTION_HEADINGS).some((pattern) => pattern.test(line)) ||
  (/^[A-Z][A-Z\s/&-]{2,}$/.test(line) && line.length <= 50);

const extractSectionLines = (lines: string[], heading: RegExp) => {
  const start = lines.findIndex((line) => heading.test(line));
  if (start < 0) return [];
  const output: string[] = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (isLikelyHeading(line) && output.length > 0) break;
    if (!isLikelyHeading(line)) output.push(line);
  }
  return output.slice(0, 12);
};

const extractNamedItems = (lines: string[], fallbackPattern: RegExp, maxItems = 8) =>
  uniqueTopics(
    lines
      .filter((line) => line.length >= 4)
      .map((line) => line.replace(/\s+\|\s+.*$/, '').replace(/\s+-\s+.*$/, '').trim())
      .filter((line) => fallbackPattern.test(line) || line.split(/\s+/).length <= 12),
  ).slice(0, maxItems);

const extractEducation = (lines: string[]) => {
  const educationLines = extractSectionLines(lines, SECTION_HEADINGS.education);
  const allText = lines.join('\n');
  const educationText = educationLines.join('\n') || allText;
  return {
    education: educationLines.slice(0, 5),
    degree: educationText.match(/\b(B\.?Tech|BTech|BE|B\.?E\.?|M\.?Tech|MTech|ME|M\.?E\.?|BSc|MSc|BCA|MCA|MBA|PhD)\b/i)?.[0],
    branch: educationText.match(/\b(?:Computer Science|Information Technology|Electronics|Electrical|Mechanical|Civil|AI|Data Science|Cyber Security)[^,\n]*/i)?.[0],
    cgpa: educationText.match(/\b(?:CGPA|GPA)\s*[:\-]?\s*([0-9.]+\/?[0-9.]*)/i)?.[1],
    college:
      educationLines.find((line) => /\b(university|college|institute|school)\b/i.test(line)) ??
      lines.find((line) => /\b(university|college|institute)\b/i.test(line)),
  };
};

export const analyzeResumeForInterview = ({
  resumeText,
  resumeSkills = [],
  resumeSummary,
  roleDomain,
  targetCompany,
}: {
  resumeText?: string;
  resumeSkills?: string[];
  resumeSummary?: string;
  roleDomain: string;
  targetCompany?: string;
}): ResumeInterviewProfile => {
  const lines = splitResumeLines(resumeText);
  const fullText = `${resumeText ?? ''}\n${resumeSummary ?? ''}\n${resumeSkills.join(' ')}`;
  const education = extractEducation(lines);
  const firstContentLine = lines.find((line) => !isLikelyHeading(line) && !/@|http|www\.|linkedin|github/i.test(line));
  const projects = extractNamedItems(extractSectionLines(lines, SECTION_HEADINGS.projects), /\b(project|app|system|platform|model|dashboard|website|portal|engine)\b/i, 8);
  const internships = extractNamedItems(extractSectionLines(lines, SECTION_HEADINGS.internships), /\b(intern|trainee|apprentice)\b/i, 5);
  const workExperience = extractNamedItems(extractSectionLines(lines, SECTION_HEADINGS.workExperience), /\b(engineer|developer|analyst|consultant|intern|associate)\b/i, 6);
  const certifications = extractNamedItems(extractSectionLines(lines, SECTION_HEADINGS.certifications), /\b(certified|certificate|aws|azure|google|tensorflow|oracle|microsoft)\b/i, 8);

  const programmingLanguages = uniqueTopics([...detectTerms(fullText, PROGRAMMING_LANGUAGE_PATTERNS), ...resumeSkills.filter((skill) => detectTerms(skill, PROGRAMMING_LANGUAGE_PATTERNS).length)]);
  const frameworks = uniqueTopics([...detectTerms(fullText, FRAMEWORK_PATTERNS), ...resumeSkills.filter((skill) => detectTerms(skill, FRAMEWORK_PATTERNS).length)]);
  const libraries = uniqueTopics([...detectTerms(fullText, LIBRARY_PATTERNS), ...resumeSkills.filter((skill) => detectTerms(skill, LIBRARY_PATTERNS).length)]);
  const databases = uniqueTopics([...detectTerms(fullText, DATABASE_PATTERNS), ...resumeSkills.filter((skill) => detectTerms(skill, DATABASE_PATTERNS).length)]);
  const cloudTechnologies = uniqueTopics([...detectTerms(fullText, CLOUD_PATTERNS), ...resumeSkills.filter((skill) => detectTerms(skill, CLOUD_PATTERNS).length)]);
  const operatingSystems = detectTerms(fullText, OS_PATTERNS);
  const developerTools = uniqueTopics([...detectTerms(fullText, TOOL_PATTERNS), ...resumeSkills.filter((skill) => detectTerms(skill, TOOL_PATTERNS).length)]);
  const technicalSkills = uniqueTopics([...detectTerms(fullText, TECHNICAL_SKILL_PATTERNS), ...resumeSkills]);
  const softSkills = detectTerms(fullText, SOFT_SKILL_PATTERNS);

  return {
    candidateInformation: {
      name: firstContentLine,
      ...education,
    },
    skills: {
      programmingLanguages,
      frameworks,
      libraries,
      databases,
      cloudTechnologies,
      operatingSystems,
      developerTools,
      versionControl: developerTools.filter((tool) => /git/i.test(tool)),
      technicalSkills,
      softSkills,
    },
    projects,
    internships,
    workExperience,
    certifications,
    achievements: extractNamedItems(extractSectionLines(lines, SECTION_HEADINGS.achievements), /\b(winner|award|rank|selected|achieved)\b/i, 6),
    hackathons: extractNamedItems(extractSectionLines(lines, SECTION_HEADINGS.hackathons), /\b(hackathon|competition|challenge)\b/i, 5),
    researchPapers: extractNamedItems(extractSectionLines(lines, SECTION_HEADINGS.researchPapers), /\b(research|paper)\b/i, 4),
    publications: extractNamedItems(extractSectionLines(lines, SECTION_HEADINGS.publications), /\b(publication|published|journal|conference)\b/i, 4),
    leadership: extractNamedItems(extractSectionLines(lines, SECTION_HEADINGS.leadership), /\b(lead|coordinator|captain|president|secretary|managed)\b/i, 5),
    positionsOfResponsibility: extractNamedItems(extractSectionLines(lines, SECTION_HEADINGS.leadership), /\b(lead|coordinator|captain|president|secretary|managed)\b/i, 5),
    strengths: uniqueTopics([...softSkills, ...technicalSkills.slice(0, 4)]).slice(0, 6),
    areasOfInterest: uniqueTopics([
      ...extractNamedItems(extractSectionLines(lines, SECTION_HEADINGS.areasOfInterest), /\b(ai|cloud|web|data|security|software|machine learning)\b/i, 5),
      roleDomain,
    ]).slice(0, 6),
    targetJobRole: roleDomain,
    expectedCompany: targetCompany ? COMPANY_LABELS[normalizeCompany(targetCompany) ?? ''] ?? targetCompany : undefined,
  };
};

const getDifficultyLimits = (complexity?: string) => {
  if (complexity === 'Advanced') return { difficulty: 'Hard' as const, projectQuestionLimit: 4, followUpLimit: 3 };
  if (complexity === 'Beginner') return { difficulty: 'Easy' as const, projectQuestionLimit: 2, followUpLimit: 1 };
  return { difficulty: 'Medium' as const, projectQuestionLimit: 3, followUpLimit: 2 };
};

const allTechnicalSkillTopics = (profile: ResumeInterviewProfile, jdProfile?: JobDescriptionProfile) =>
  uniqueTopics([
    ...(jdProfile?.requiredSkills ?? []),
    ...(jdProfile?.toolsTechnologies ?? []),
    ...profile.skills.programmingLanguages,
    ...profile.skills.frameworks,
    ...profile.skills.libraries,
    ...profile.skills.databases,
    ...profile.skills.cloudTechnologies,
    ...profile.skills.developerTools,
    ...profile.skills.technicalSkills,
  ]).filter((skill) => !profile.skills.softSkills.includes(skill));

const skillQuestionDepth = (duration: number, complexity?: string) => {
  if (duration >= 60) return complexity === 'Beginner' ? 2 : 3;
  if (duration >= 45) return complexity === 'Advanced' ? 3 : 2;
  if (duration >= 30) return complexity === 'Beginner' ? 1 : 2;
  return 1;
};

const isTechnicalInterviewRole = (roleDomain: string) =>
  /\b(?:software|developer|engineer|frontend|backend|full\s*stack|data\s*(?:scientist|analyst|engineer)|ml|machine learning|ai|devops|cloud|cyber|security|qa|test|sdet|database|system|architect|programmer)\b/i.test(roleDomain);

const roleSpecificTopics = (roleDomain: string) => {
  if (/\bdigital\s*marketing|marketing\b/i.test(roleDomain)) {
    return [
      'campaign strategy',
      'SEO and SEM',
      'social media marketing',
      'content planning',
      'marketing analytics',
      'conversion optimization',
      'budget allocation',
    ];
  }

  if (/\bai|artificial intelligence|ml|machine learning\b/i.test(roleDomain)) {
    return ['model selection', 'data preprocessing', 'feature evaluation', 'model validation', 'AI product integration', 'responsible AI checks'];
  }

  if (/\bsoftware|developer|programmer\b/i.test(roleDomain)) {
    return ['feature requirements breakdown', 'technology selection', 'implementation workflow', 'testing strategy', 'debugging approach', 'code quality'];
  }

  if (/\bfrontend\b/i.test(roleDomain)) {
    return ['responsive UI implementation', 'state management', 'API integration', 'accessibility', 'performance optimization'];
  }

  if (/\bbackend\b/i.test(roleDomain)) {
    return ['API design basics', 'database interaction', 'authentication flow', 'error handling', 'testing strategy'];
  }

  if (/\bbusiness\s*analyst|product|sales|operations|hr|human resources|finance|accounting\b/i.test(roleDomain)) {
    return ['requirements analysis', 'stakeholder communication', 'metrics and reporting', 'business impact'];
  }

  return ['role responsibilities', 'practical workflow', 'tools used', 'success metrics'];
};

const problemSolvingTopicsForRole = (roleDomain: string, resumeProfile: ResumeInterviewProfile) =>
  isTechnicalInterviewRole(roleDomain)
    ? uniqueTopics([
        ...resumeProfile.skills.programmingLanguages.slice(0, 3),
        ...resumeProfile.skills.technicalSkills.slice(0, 5),
        'debugging',
        'testing',
      ])
    : uniqueTopics(['role scenario', 'prioritization', 'metrics analysis', 'execution plan']);

const shouldAskSystemDesign = (
  roleDomain: string,
  roleLevel: string,
  skillTopics: string[],
  jdProfile?: JobDescriptionProfile,
) => {
  const explicitSystemDesign = uniqueTopics([
    roleDomain,
    ...skillTopics,
    ...(jdProfile?.requiredSkills ?? []),
    ...(jdProfile?.responsibilities ?? []),
    ...(jdProfile?.toolsTechnologies ?? []),
  ]).some((topic) => /\b(system design|architecture|scalability|distributed systems|microservices|platform architecture)\b/i.test(topic));

  return isTechnicalInterviewRole(roleDomain) && (explicitSystemDesign || roleLevel === 'Senior' || roleLevel === 'Lead');
};

const distributeBudget = (sections: Omit<InterviewRoadmapSection, 'questionBudget'>[], targetQuestionCount: number) => {
  const weights: Record<InterviewRoadmapSectionKey, number> = {
    self_introduction: 1,
    resume_overview: 1,
    programming_languages: 2,
    technical_skills: 4,
    projects: 5,
    internship: 2,
    certifications: 2,
    role_specific: 3,
    company_specific: 3,
    coding_problem_solving: 2,
    system_design: 2,
    behavioral: 2,
    hr: 1,
    candidate_questions: 0,
    closing: 0,
  };
  const totalWeight = sections.reduce((sum, section) => sum + (weights[section.key] ?? 1), 0) || 1;
  let remaining = targetQuestionCount;
  return sections.map((section, index) => {
    const isLast = index === sections.length - 1;
    const budget = isLast ? remaining : Math.max(1, Math.round((targetQuestionCount * (weights[section.key] ?? 1)) / totalWeight));
    remaining = Math.max(0, remaining - budget);
    return { ...section, questionBudget: budget };
  });
};

export const buildInterviewRoadmap = ({
  resumeText,
  resumeSkills = [],
  resumeSummary,
  roleDomain,
  roleLevel,
  duration,
  complexity,
  targetCompany,
  jdProfile,
  companyGuidance,
}: {
  resumeText?: string;
  resumeSkills?: string[];
  resumeSummary?: string;
  roleDomain: string;
  roleLevel: string;
  duration: number;
  complexity?: string;
  targetCompany?: string;
  jdProfile?: JobDescriptionProfile;
  companyGuidance?: CompanyInterviewGuidance;
}): InterviewRoadmap => {
  const resumeProfile = analyzeResumeForInterview({ resumeText, resumeSkills, resumeSummary, roleDomain, targetCompany });
  const technicalRole = isTechnicalInterviewRole(roleDomain);
  const technicalSkillTopics = allTechnicalSkillTopics(resumeProfile, jdProfile);
  const coverageQuestionCount = technicalSkillTopics.length * skillQuestionDepth(duration, complexity);
  const systemDesignApplicable = shouldAskSystemDesign(roleDomain, roleLevel, technicalSkillTopics, jdProfile);
  const coreSectionReserve =
    1 + // introduction
    2 + // role-specific and coding/problem-solving
    (systemDesignApplicable ? 1 : 0) +
    (targetCompany ? 1 : 0) +
    Math.min(2, resumeProfile.projects.length) +
    (resumeProfile.internships.length || resumeProfile.workExperience.length ? 1 : 0) +
    Math.min(1, resumeProfile.certifications.length) +
    2; // behavioral and HR
  const targetQuestionCount = Math.max(getInterviewQuestionCount(duration), coverageQuestionCount + coreSectionReserve);
  const limits = getDifficultyLimits(complexity);
  const technicalTopics = technicalSkillTopics.slice(0, 30);
  const sections: Omit<InterviewRoadmapSection, 'questionBudget'>[] = [
    { key: 'self_introduction', title: 'Self Introduction', topics: ['Candidate overview'] },
    { key: 'resume_overview', title: 'Resume Overview', topics: uniqueTopics([resumeProfile.candidateInformation.degree ?? '', resumeProfile.candidateInformation.college ?? '', roleDomain]).slice(0, 4) },
    ...(resumeProfile.skills.programmingLanguages.length
      ? [{ key: 'programming_languages' as const, title: 'Programming Languages', topics: resumeProfile.skills.programmingLanguages }]
      : []),
    ...(technicalTopics.length
      ? [{ key: 'technical_skills' as const, title: 'Technical Skills', topics: technicalTopics }]
      : []),
    ...(resumeProfile.projects.length
      ? [{ key: 'projects' as const, title: 'Projects', topics: resumeProfile.projects }]
      : []),
    ...(resumeProfile.internships.length || resumeProfile.workExperience.length
      ? [{ key: 'internship' as const, title: 'Internship / Work Experience', topics: uniqueTopics([...resumeProfile.internships, ...resumeProfile.workExperience]) }]
      : []),
    ...(resumeProfile.certifications.length
      ? [{ key: 'certifications' as const, title: 'Certifications', topics: resumeProfile.certifications }]
      : []),
    { key: 'role_specific', title: 'Role-specific Questions', topics: uniqueTopics([...roleSpecificTopics(roleDomain), ...(jdProfile?.responsibilities ?? []).slice(0, 4)]) },
    ...(targetCompany
      ? [{ key: 'company_specific' as const, title: 'Company-specific Questions', topics: uniqueTopics([companyGuidance?.company ?? targetCompany, ...(companyGuidance?.preferredTopics ?? [])]) }]
      : []),
    {
      key: 'coding_problem_solving',
      title: technicalRole ? 'Coding / Problem Solving' : 'Role Scenario / Problem Solving',
      topics: problemSolvingTopicsForRole(roleDomain, resumeProfile),
    },
    ...(systemDesignApplicable
      ? [{ key: 'system_design' as const, title: 'System Design', topics: uniqueTopics(['Scalability', 'API design', 'Data storage', ...(companyGuidance?.preferredTopics ?? []).slice(0, 2)]) }]
      : []),
    { key: 'behavioral', title: 'Behavioral Questions', topics: ['Conflict', 'Leadership', 'Failure', 'Teamwork', 'Deadline pressure', 'Adaptability'] },
    { key: 'hr', title: 'HR Questions', topics: ['Strengths', 'Weaknesses', 'Career goals', 'Why this company'] },
  ];

  return {
    duration,
    targetQuestionCount,
    difficulty: limits.difficulty,
    roleDomain,
    roleLevel,
    targetCompany,
    resumeProfile,
    sections: distributeBudget(sections, targetQuestionCount),
    projectQuestionLimit: limits.projectQuestionLimit,
    followUpLimit: limits.followUpLimit,
  };
};

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

export const getCompanyInterviewGuidance = (targetCompany?: string): CompanyInterviewGuidance | undefined => {
  const companyKey = normalizeCompany(targetCompany);
  if (!companyKey) return undefined;

  const company = COMPANY_LABELS[companyKey] ?? companyKey;
  const category = CATEGORY_BY_KEY.get(companyKey);
  const base: CompanyInterviewGuidance = {
    company,
    style: 'Use public interview-pattern inspiration only. Do not claim questions are official or historically guaranteed.',
    preferredTopics: ['resume projects', 'job-description skills', 'fundamentals', 'practical problem solving'],
    behavioralStyle: 'Use structured follow-ups around situation, role, action, result, and reflection.',
    codingStyle: 'Start with fundamentals, then ask for edge cases, complexity, alternatives, and optimization.',
    systemDesignExpectations: 'Scale system-design depth to candidate seniority and the job description.',
    technicalDepth: 'Probe depth after strong answers and reduce difficulty when the candidate struggles.',
    caution: 'Historical public reports are inspiration, not a question bank. Generate fresh questions grounded in the JD and resume.',
  };

  const explicit: Record<string, Partial<CompanyInterviewGuidance>> = {
    amazon: {
      preferredTopics: ['ownership', 'customer impact', 'scalable services', 'coding fundamentals', 'operational excellence'],
      behavioralStyle: 'Lean into STAR stories around ownership, bias for action, trade-offs, failures, and customer impact.',
      codingStyle: 'Ask practical coding and data-structure questions with edge cases and complexity.',
      systemDesignExpectations: 'For senior candidates, probe reliability, scale, operations, and trade-offs.',
      technicalDepth: 'Expect concrete examples and decision reasoning; challenge vague claims with follow-ups.',
    },
    google: {
      preferredTopics: ['algorithms', 'problem solving', 'data structures', 'scalability', 'technical reasoning'],
      behavioralStyle: 'Keep behavioral prompts concise and focus follow-ups on collaboration, ambiguity, and learning.',
      codingStyle: 'Probe reasoning, correctness, complexity, edge cases, and alternate approaches.',
      systemDesignExpectations: 'Probe constraints, APIs, storage, scaling, reliability, and clarity of assumptions.',
      technicalDepth: 'Ask deeper why/how follow-ups after correct answers.',
    },
    microsoft: {
      preferredTopics: ['practical coding', 'OOP', 'debugging', 'system design', 'collaboration'],
      behavioralStyle: 'Use collaboration, growth mindset, conflict, and product/customer scenarios.',
      codingStyle: 'Favor practical implementation, object-oriented design, debugging, and clean reasoning.',
      systemDesignExpectations: 'Focus on maintainable services, API design, reliability, and product constraints.',
      technicalDepth: 'Balance fundamentals with real-world engineering judgment.',
    },
    accenture: {
      preferredTopics: ['SQL', 'OOP', 'projects', 'communication', 'client scenarios'],
      behavioralStyle: 'Emphasize client communication, adaptability, team delivery, and structured thinking.',
      codingStyle: 'Start with fundamentals and practical coding or query reasoning.',
      systemDesignExpectations: 'Use implementation planning, requirements clarification, and delivery risk.',
      technicalDepth: 'Keep depth role-appropriate and verify fundamentals before advanced follow-ups.',
    },
    infosys: {
      preferredTopics: ['OOP', 'DBMS', 'programming basics', 'projects', 'HR readiness'],
      behavioralStyle: 'Ask concise HR and project-ownership questions with communication follow-ups.',
      codingStyle: 'Start from basics, syntax-independent logic, DBMS, OOP, and simple algorithms.',
      systemDesignExpectations: 'Limit system design unless the JD or seniority requires it.',
      technicalDepth: 'Prioritize fundamentals and reduce difficulty quickly if basics are weak.',
    },
    tcs: {
      preferredTopics: ['OOP', 'DBMS', 'data structures', 'projects', 'client delivery', 'communication'],
      behavioralStyle: 'Include HR, flexibility, communication, and project contribution follow-ups.',
      codingStyle: 'Ask basic logic, arrays/strings, OOP, DBMS, and edge cases.',
      systemDesignExpectations: 'Focus on maintainability and enterprise delivery rather than advanced architecture for junior roles.',
      technicalDepth: 'Assess fundamentals clearly before moving into scenarios.',
    },
  };

  const categoryGuidance: Record<string, Partial<CompanyInterviewGuidance>> = {
    finance: {
      preferredTopics: ['transactions', 'data integrity', 'security', 'auditability', 'risk-aware delivery'],
      behavioralStyle: 'Ask about accuracy, deadlines, risk, stakeholder communication, and ownership.',
      systemDesignExpectations: 'Probe idempotency, consistency, audit trails, recovery, and access control.',
    },
    consulting: {
      preferredTopics: ['requirements clarification', 'client communication', 'planning', 'delivery risk', 'business impact'],
      behavioralStyle: 'Use client scenarios, ambiguity, influence, and cross-team collaboration.',
      systemDesignExpectations: 'Ask for phased implementation, risk mitigation, trade-offs, and stakeholder alignment.',
    },
    embedded: {
      preferredTopics: ['systems fundamentals', 'performance', 'memory', 'concurrency', 'debugging'],
      codingStyle: 'Probe low-level reasoning, resource constraints, correctness, and profiling.',
      systemDesignExpectations: 'Focus on reliability, constraints, interfaces, and testability.',
    },
    healthcare: {
      preferredTopics: ['privacy', 'data quality', 'auditability', 'critical workflows', 'testing'],
      behavioralStyle: 'Ask about quality discipline, risk, compliance awareness, and careful communication.',
      systemDesignExpectations: 'Probe sensitive data handling, validation, audit logs, and safe recovery.',
    },
    enterpriseSaas: {
      preferredTopics: ['APIs', 'multi-tenancy', 'RBAC', 'backward compatibility', 'customer impact'],
      systemDesignExpectations: 'Probe tenancy, permissions, release safety, contracts, and customer support.',
    },
    consumer: {
      preferredTopics: ['scale', 'latency', 'experimentation', 'privacy', 'user experience'],
      behavioralStyle: 'Ask about user impact, data-informed decisions, speed, and quality trade-offs.',
      systemDesignExpectations: 'Probe peak traffic, graceful degradation, consistency, and metrics.',
    },
  };

  return {
    ...base,
    ...(category ? categoryGuidance[category] : {}),
    ...(explicit[companyKey] ?? {}),
    company,
  };
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

const questionForRoadmapTopic = (
  section: InterviewRoadmapSection,
  topic: string,
  index: number,
  roadmap: InterviewRoadmap,
): GeneratedQuestion => {
  const company = roadmap.targetCompany ? COMPANY_LABELS[normalizeCompany(roadmap.targetCompany) ?? ''] ?? roadmap.targetCompany : undefined;
  const technicalRole = isTechnicalInterviewRole(roadmap.roleDomain);
  const common = {
    topic,
    resumeReference: `${section.title}: ${topic}`,
  };

  switch (section.key) {
    case 'self_introduction':
      return INTRO_QUESTION;
    case 'resume_overview':
      return {
        question: `I noticed ${topic} in your profile. How does it connect to the ${roadmap.roleDomain} role you are targeting?`,
        expectedSignals: ['resume awareness', 'role alignment', 'concise explanation'],
        questionType: 'behavioural',
        difficulty: 'easy',
        followUpIntent: 'bridge-topic',
        ...common,
      };
    case 'programming_languages':
      return {
        question: `Let's evaluate your ${topic} fundamentals. Which language features or concepts have you used most in real projects, and where did they matter?`,
        expectedSignals: ['hands-on usage', 'core language concepts', 'project example'],
        questionType: 'technical',
        difficulty: index % 2 === 0 ? 'easy-medium' : 'medium',
        followUpIntent: 'deepen',
        ...common,
      };
    case 'technical_skills':
      return {
        question: `You mentioned ${topic}. Explain one practical use case from your learning, internship, or project work, one common mistake, and how you would test or verify it.`,
        expectedSignals: ['practical use case', 'common pitfall', 'testing or verification'],
        questionType: 'technical',
        difficulty: index % 3 === 0 ? 'medium' : 'easy-medium',
        followUpIntent: 'deepen',
        ...common,
      };
    case 'projects':
      return {
        question: `Great. Let's discuss ${topic}. What problem did it solve, what was your exact contribution, and what was the hardest technical or execution challenge?`,
        expectedSignals: ['problem solved', 'personal contribution', 'technical or execution challenge'],
        questionType: 'technical',
        difficulty: 'medium',
        followUpIntent: 'deepen',
        ...common,
      };
    case 'internship':
      return {
        question: `I'd like to discuss your internship or work experience now. For ${topic}, what were your responsibilities, tools used, and biggest learning?`,
        expectedSignals: ['responsibilities', 'technologies used', 'learning or impact'],
        questionType: 'behavioural',
        difficulty: 'easy-medium',
        followUpIntent: 'clarify',
        ...common,
      };
    case 'certifications':
      return {
        question: `I noticed ${topic} on your resume. What did you build or practice for it, and how would you apply that knowledge in this role?`,
        expectedSignals: ['certification scope', 'hands-on application', 'role relevance'],
        questionType: 'technical',
        difficulty: 'easy-medium',
        followUpIntent: 'deepen',
        ...common,
      };
    case 'role_specific':
      return {
        question: technicalRole
          ? `For a ${roadmap.roleDomain} role, how would you handle ${topic} in a project? Mention the steps you would take, the resume skills you would use, and how you would verify the result.`
          : `For a ${roadmap.roleDomain} role, how would you plan and execute ${topic}, and how would you measure whether it worked?`,
        expectedSignals: technicalRole
          ? ['structured steps', 'resume skill connection', 'verification mindset']
          : ['structured plan', 'execution steps', 'success metrics'],
        questionType: 'situational',
        difficulty: 'scenario',
        followUpIntent: 'challenge',
        ...common,
      };
    case 'company_specific':
      return {
        question: technicalRole
          ? company
            ? `Let's move to some ${company}-style expectations. How would you demonstrate ${topic} in a technical interview or project discussion?`
            : `Let's move to company-specific expectations. How would you demonstrate ${topic} in a technical interview or project discussion?`
          : company
          ? `Let's move to some ${company}-style expectations. How would you connect ${topic} to the ${roadmap.roleDomain} role with a practical example?`
          : `Let's move to company-specific expectations. How would you connect ${topic} to the ${roadmap.roleDomain} role with a practical example?`,
        expectedSignals: technicalRole
          ? ['company awareness', 'specific example', 'interview readiness']
          : ['company awareness', 'role alignment', 'specific example'],
        questionType: 'behavioural',
        difficulty: 'behavioral',
        followUpIntent: 'clarify',
        ...common,
      };
    case 'coding_problem_solving':
      return {
        question: technicalRole
          ? `Let's discuss a practical problem involving ${topic}. What would you build or debug, what cases would you check, and how would you know your solution is working?`
          : `Let's discuss a practical ${roadmap.roleDomain} scenario around ${topic}. What would you do first, what constraints would you consider, and how would you track success?`,
        expectedSignals: technicalRole
          ? ['practical approach', 'cases checked', 'verification']
          : ['problem framing', 'prioritization', 'success metrics'],
        questionType: technicalRole ? 'technical' : 'situational',
        difficulty: technicalRole ? 'problem-solving' : 'scenario',
        followUpIntent: 'challenge',
        ...common,
      };
    case 'system_design':
      return {
        question: `Now let's discuss system design. Design around ${topic}; cover APIs, storage, scaling, failure handling, and trade-offs.`,
        expectedSignals: ['APIs and boundaries', 'storage choice', 'scaling and reliability trade-offs'],
        questionType: 'situational',
        difficulty: 'scenario',
        followUpIntent: 'challenge',
        ...common,
      };
    case 'behavioral':
      return {
        question: `Tell me about a time involving ${topic}. Use the situation, your role, actions, result, and what you learned.`,
        expectedSignals: ['STAR structure', 'personal ownership', 'result and reflection'],
        questionType: 'behavioural',
        difficulty: 'behavioral',
        followUpIntent: 'clarify',
        ...common,
      };
    case 'hr':
      return {
        question: company
          ? `Before we close, how would you answer an HR question about ${topic} for ${company}?`
          : `Before we close, how would you answer an HR question about ${topic}?`,
        expectedSignals: ['self-awareness', 'role motivation', 'professional clarity'],
        questionType: 'behavioural',
        difficulty: 'easy',
        followUpIntent: 'bridge-topic',
        ...common,
      };
    default:
      return {
        question: `Let's discuss ${topic}. What should I know about your experience here?`,
        expectedSignals: ['specific example', 'clear explanation', 'role relevance'],
        questionType: 'behavioural',
        difficulty: 'easy-medium',
        followUpIntent: 'bridge-topic',
        ...common,
      };
  }
};

const roadmapQuestions = (roadmap?: InterviewRoadmap) => {
  if (!roadmap) return [];
  return roadmap.sections.flatMap((section) => {
    const topics = section.topics.length ? section.topics : [section.title];
    const budget = Math.max(1, section.questionBudget);
    return Array.from({ length: budget }, (_, index) =>
      questionForRoadmapTopic(section, topics[index % topics.length], index, roadmap),
    );
  });
};

const skillCoverageQuestions = (roadmap?: InterviewRoadmap): GeneratedQuestion[] => {
  if (!roadmap) return [];
  const technicalRole = isTechnicalInterviewRole(roadmap.roleDomain);
  const skills = allTechnicalSkillTopics(roadmap.resumeProfile).slice(0, 40);
  const depth = skillQuestionDepth(roadmap.duration, roadmap.difficulty === 'Hard' ? 'Advanced' : roadmap.difficulty === 'Easy' ? 'Beginner' : 'Intermediate');

  return skills.flatMap((skill) => {
    const questions: GeneratedQuestion[] = [
      {
        question: technicalRole
          ? `For the ${roadmap.roleDomain} role, let's evaluate your ${skill} skills. Explain the core concept you have used most, with one concrete project or implementation example.`
          : `For the ${roadmap.roleDomain} role, let's evaluate your ${skill} skills. Explain one practical campaign, task, or business example where you used it and what outcome you tracked.`,
        expectedSignals: technicalRole
          ? [`${skill} fundamentals`, `${roadmap.roleDomain} relevance`, 'specific example', 'clear practical usage']
          : [`${skill} practical usage`, `${roadmap.roleDomain} relevance`, 'specific example', 'measured outcome'],
        questionType: technicalRole ? 'technical' : 'situational',
        resumeReference: `Skill coverage: ${skill}`,
        difficulty: 'easy-medium',
        topic: skill,
        followUpIntent: 'deepen',
      },
    ];

    if (depth >= 2) {
      questions.push({
        question: technicalRole
          ? `Staying with ${skill} for a ${roadmap.roleDomain} interview, what is one failure mode, limitation, or common mistake engineers should watch for, and how would you prevent it?`
          : `Staying with ${skill} for a ${roadmap.roleDomain} interview, what is one common mistake, limitation, or campaign risk you would watch for, and how would you prevent it?`,
        expectedSignals: technicalRole
          ? [`${skill} pitfalls`, `${roadmap.roleDomain} judgement`, 'prevention strategy', 'testing or validation']
          : [`${skill} pitfalls`, `${roadmap.roleDomain} judgement`, 'prevention strategy', 'measurement or review'],
        questionType: technicalRole ? 'technical' : 'situational',
        resumeReference: `Skill deep dive: ${skill}`,
        difficulty: 'medium',
        topic: skill,
        followUpIntent: 'challenge',
      });
    }

    if (depth >= 3) {
      questions.push({
        question: technicalRole
          ? `Let's go one level deeper on ${skill}. Design a production-ready ${roadmap.roleDomain} use case and explain performance, scalability, security, and trade-offs.`
          : `Let's go one level deeper on ${skill}. Design a ${roadmap.roleDomain} execution plan and explain audience, channels, budget or effort, metrics, and trade-offs.`,
        expectedSignals: technicalRole
          ? [`${skill} architecture`, `${roadmap.roleDomain} system thinking`, 'trade-off reasoning', 'production readiness']
          : [`${skill} strategy`, `${roadmap.roleDomain} execution thinking`, 'trade-off reasoning', 'measurement plan'],
        questionType: 'situational',
        resumeReference: `Skill production scenario: ${skill}`,
        difficulty: 'scenario',
        topic: skill,
        followUpIntent: 'challenge',
      });
    }

    return questions;
  });
};

const roleFocusQuestions = (roadmap?: InterviewRoadmap): GeneratedQuestion[] => {
  if (!roadmap) return [];
  const technicalRole = isTechnicalInterviewRole(roadmap.roleDomain);
  const roleTopics = uniqueTopics([
    ...roleSpecificTopics(roadmap.roleDomain),
    ...problemSolvingTopicsForRole(roadmap.roleDomain, roadmap.resumeProfile),
  ]).slice(0, 12);

  return roleTopics.flatMap((topic, index) => {
    const base: GeneratedQuestion = {
      question: technicalRole
        ? `For a ${roadmap.roleDomain} interview, explain how you would apply ${topic} in one of your projects or internship tasks, and how you would check that it worked.`
        : `For a ${roadmap.roleDomain} interview, walk me through how you would handle ${topic} in a real business situation and how you would measure success.`,
      expectedSignals: technicalRole
        ? ['role relevance', 'project connection', 'verification']
        : ['role relevance', 'practical execution', 'success metrics'],
      questionType: technicalRole ? 'technical' : 'situational',
      resumeReference: `Role focus: ${topic}`,
      difficulty: index < 2 ? 'easy-medium' : 'medium',
      topic,
      followUpIntent: 'deepen',
    };

    const followUp: GeneratedQuestion = {
      question: technicalRole
        ? `Staying with ${topic}, what mistake or failure could happen while implementing it, and how would you debug or prevent that?`
        : `Staying with ${topic}, what could go wrong during execution, and how would you adjust your plan based on performance data?`,
      expectedSignals: technicalRole
        ? ['failure mode', 'debugging approach', 'prevention']
        : ['risk awareness', 'data-driven adjustment', 'practical judgement'],
      questionType: 'situational',
      resumeReference: `Role follow-up: ${topic}`,
      difficulty: 'scenario',
      topic,
      followUpIntent: 'challenge',
    };

    return index < 4 ? [base, followUp] : [base];
  });
};

const withQuestionMetadata = (questions: GeneratedQuestion[]) =>
  questions.map((question, index) => ({
    ...question,
    difficulty:
      question.difficulty ??
      (index === 0
        ? 'easy'
        : index < 2
        ? 'easy-medium'
        : index < 4
        ? 'medium'
        : question.questionType === 'situational'
        ? 'scenario'
        : question.questionType === 'behavioural'
        ? 'behavioral'
        : 'medium-hard'),
    topic: question.topic ?? question.resumeReference ?? 'general',
    followUpIntent:
      question.followUpIntent ??
      (question.questionType === 'situational'
        ? 'challenge'
        : question.questionType === 'behavioural'
        ? 'clarify'
        : 'deepen'),
  }));

const sectionTitleFromReference = (question: GeneratedQuestion) =>
  normalizeTopic((question.resumeReference ?? '').split(':')[0] ?? '');

const takeFirstBySection = (questions: GeneratedQuestion[], sectionTitles: string[]) => {
  const wanted = new Set(sectionTitles);
  const seen = new Set<string>();
  return questions.filter((question) => {
    const title = sectionTitleFromReference(question);
    if (!wanted.has(title) || seen.has(title)) return false;
    seen.add(title);
    return true;
  });
};

export const buildInterviewQuestionSet = ({
  generatedQuestions,
  targetCompany,
  duration,
  interviewRoadmap,
  prioritizeGenerated = false,
}: {
  generatedQuestions: GeneratedQuestion[];
  targetCompany?: string;
  duration: number;
  interviewRoadmap?: InterviewRoadmap;
  prioritizeGenerated?: boolean;
}) => {
  const company = normalizeCompany(targetCompany);
  const companyQuestions = company ? getCompanyBank(company) : [];
  const targetCount = getInterviewQuestionCount(duration);
  const finalTargetCount = interviewRoadmap?.targetQuestionCount ?? targetCount;
  const generatedWithoutIntro = generatedQuestions.filter((question) => !isIntroQuestion(question));
  const skillQuestions = skillCoverageQuestions(interviewRoadmap);
  const roleQuestions = roleFocusQuestions(interviewRoadmap);
  const plannedQuestions = roadmapQuestions(interviewRoadmap).filter((question) => !isIntroQuestion(question));
  const roleAndCodingPrimary = takeFirstBySection(plannedQuestions, ['Role-specific Questions', 'Coding / Problem Solving', 'Role Scenario / Problem Solving', 'System Design']);
  const resumeAndCompanyPrimary = takeFirstBySection(plannedQuestions, [
    'Projects',
    'Internship / Work Experience',
    'Certifications',
    'Company-specific Questions',
    'Behavioral Questions',
    'HR Questions',
  ]);
  const primaryQuestions = [...roleAndCodingPrimary, ...resumeAndCompanyPrimary];
  const remainingPlannedQuestions = plannedQuestions.filter((question) => !primaryQuestions.includes(question));
  const minimumRoleSkillQuestions = Math.ceil(Math.max(1, finalTargetCount - 1) * 0.6);
  const existingRoleSkillQuestions = skillQuestions.length + roleAndCodingPrimary.length;
  const leadRoleQuestions = roleQuestions.slice(0, Math.max(0, minimumRoleSkillQuestions - existingRoleSkillQuestions));
  const remainingRoleQuestions = roleQuestions.filter((question) => !leadRoleQuestions.includes(question));
  const orderedQuestions = prioritizeGenerated
    ? [INTRO_QUESTION, ...skillQuestions, ...roleAndCodingPrimary, ...leadRoleQuestions, ...resumeAndCompanyPrimary, ...generatedWithoutIntro, ...remainingRoleQuestions, ...remainingPlannedQuestions, ...companyQuestions]
    : [INTRO_QUESTION, ...skillQuestions, ...roleAndCodingPrimary, ...leadRoleQuestions, ...resumeAndCompanyPrimary, ...remainingRoleQuestions, ...remainingPlannedQuestions, ...companyQuestions, ...generatedWithoutIntro];

  return withQuestionMetadata(uniqueByQuestion(orderedQuestions).slice(0, finalTargetCount));
};

const topicMatches = (candidate: string | undefined, topic: string) => {
  if (!candidate) return false;
  const left = normalizeTopic(candidate).toLowerCase();
  const right = normalizeTopic(topic).toLowerCase();
  return Boolean(left && right && (left === right || left.includes(right) || right.includes(left)));
};

const sectionForTopic = (roadmap: InterviewRoadmap | undefined, topic: string | undefined) =>
  roadmap?.sections.find((section) => section.topics.some((sectionTopic) => topicMatches(topic, sectionTopic)));

export const deriveInterviewRuntimeState = ({
  roadmap,
  transcript,
}: {
  roadmap?: InterviewRoadmap;
  transcript: Array<{ question: string; topic?: string; resumeReference?: string }>;
}): InterviewRuntimeState => {
  const questionsAsked = transcript.length;
  const coveredConcepts = uniqueTopics(
    transcript.map((item) => item.topic ?? item.resumeReference ?? '').filter(Boolean),
  );
  const askedQuestions = transcript.map((item) => item.question);
  const lastTopic = transcript[transcript.length - 1]?.topic ?? transcript[transcript.length - 1]?.resumeReference;
  const currentSection = sectionForTopic(roadmap, lastTopic)?.key;
  const projectTopics = roadmap?.resumeProfile.projects ?? [];
  const certificationTopics = roadmap?.resumeProfile.certifications ?? [];
  const skillTopics = uniqueTopics([
    ...(roadmap?.resumeProfile.skills.programmingLanguages ?? []),
    ...(roadmap?.resumeProfile.skills.technicalSkills ?? []),
    ...(roadmap?.resumeProfile.skills.frameworks ?? []),
    ...(roadmap?.resumeProfile.skills.libraries ?? []),
    ...(roadmap?.resumeProfile.skills.databases ?? []),
    ...(roadmap?.resumeProfile.skills.cloudTechnologies ?? []),
  ]);
  const countTopic = (topic: string) =>
    transcript.filter((item) => topicMatches(item.topic ?? item.resumeReference, topic)).length;
  const consecutiveSameTopic = [...transcript]
    .reverse()
    .findIndex((item) => !topicMatches(item.topic ?? item.resumeReference, lastTopic ?? ''));

  return {
    current_section: currentSection,
    current_project: projectTopics.find((project) => topicMatches(lastTopic, project)),
    projects_completed: projectTopics.filter((project) => countTopic(project) >= (roadmap?.projectQuestionLimit ?? 3)),
    skills_completed: skillTopics.filter((skill) => countTopic(skill) > 0),
    internship_completed: Boolean(
      roadmap?.resumeProfile.internships.some((internship) => countTopic(internship) > 0) ||
        roadmap?.resumeProfile.workExperience.some((experience) => countTopic(experience) > 0),
    ),
    certifications_completed: certificationTopics.filter((certification) => countTopic(certification) > 0),
    company_questions_completed: transcript.some((item) => sectionForTopic(roadmap, item.topic ?? item.resumeReference)?.key === 'company_specific'),
    role_questions_completed: transcript.some((item) => sectionForTopic(roadmap, item.topic ?? item.resumeReference)?.key === 'role_specific'),
    behavioral_completed: transcript.some((item) => sectionForTopic(roadmap, item.topic ?? item.resumeReference)?.key === 'behavioral'),
    hr_completed: transcript.some((item) => sectionForTopic(roadmap, item.topic ?? item.resumeReference)?.key === 'hr'),
    coding_completed: transcript.some((item) => sectionForTopic(roadmap, item.topic ?? item.resumeReference)?.key === 'coding_problem_solving'),
    remaining_time: Math.max(0, Math.round((roadmap?.duration ?? 0) * (1 - questionsAsked / Math.max(1, roadmap?.targetQuestionCount ?? questionsAsked)))),
    questions_asked: questionsAsked,
    followups_current_topic: consecutiveSameTopic < 0 ? questionsAsked : consecutiveSameTopic,
    covered_concepts: coveredConcepts,
    asked_questions: askedQuestions,
  };
};
