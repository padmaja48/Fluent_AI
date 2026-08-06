import OpenAI, { toFile } from 'openai';
import { env } from '../config/env';
import { getCompanyQuestions } from './companyQuestionBank';
import {
  buildAdaptiveTurnUserPrompt,
  buildInitialQuestionsUserPrompt,
  buildInterviewSystemPrompt,
  mapExperienceLevel,
  mapInterviewPromptType,
  type CompanyQuestionEntry,
  type ConversationTurn,
} from './promptBuilder';
import {
  aggregateSessionStrengths,
  buildClarificationIdealAnswer,
  buildDifficultyProgressionSummary,
  classifyAnswerTurn,
  computeCompanyReadinessScore,
  inferQuestionTypeFromContent,
  isNearDuplicateQuestion,
} from './interviewReport.utils';

const openai = env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: env.OPENAI_API_KEY, baseURL: env.OPENAI_BASE_URL })
  : null;
const groq = env.GROQ_API_KEY
  ? new OpenAI({ apiKey: env.GROQ_API_KEY, baseURL: env.GROQ_BASE_URL })
  : null;

export type InterviewMode = 'sde' | 'frontend' | 'backend' | 'data_analyst' | 'ai_ml' | 'qa' | 'hr_behavioral';

type InterviewModeGuidance = {
  label: string;
  questionTemplate: string;
  questionAngles: string[];
};

type InterviewContext = {
  roleLevel: string;
  roleDomain: string;
  interviewStyle: string;
  duration: number;
  resumeText?: string;
  jobDescription?: string;
  personaId?: string;
  personaPersonality?: string;
  interviewType?: string;
  interviewMode?: InterviewMode;
  complexity?: string;
  targetCompany?: string;
  resumeSkills?: string[];
  resumeExperienceLevel?: string;
  resumeSuggestedQuestions?: string[];
  resumeSummary?: string;
  resumeProfile?: ResumeInterviewProfile;
};

type TranscriptionContext = {
  roleDomain?: string;
  currentQuestion?: string;
  jobDescription?: string;
  resumeSkills?: string[];
  resumeText?: string;
  resumeProjects?: string[];
  resumeSummary?: string;
  resumeEducation?: string[];
  targetCompany?: string;
};

const INTERVIEW_MODE_GUIDANCE: Record<InterviewMode, InterviewModeGuidance> = {
  sde: {
    label: 'Software Development Engineer',
    questionTemplate: 'Use a balanced SDE loop: fundamentals, coding reasoning, OOP/DBMS/OS, API design, debugging, project architecture, scalability, and ownership.',
    questionAngles: ['data structures and algorithms', 'OOP and design principles', 'DBMS and SQL', 'operating systems basics', 'API design', 'debugging', 'scalability trade-offs'],
  },
  frontend: {
    label: 'Frontend Developer',
    questionTemplate: 'Use a frontend loop: UI architecture, React or framework state, component design, browser behavior, accessibility, performance, API integration, testing, and responsive UX.',
    questionAngles: ['React/component architecture', 'state management', 'browser rendering', 'accessibility', 'frontend performance', 'API integration', 'UI testing'],
  },
  backend: {
    label: 'Backend Developer',
    questionTemplate: 'Use a backend loop: API design, authentication, databases, concurrency, caching, reliability, observability, production debugging, and scaling.',
    questionAngles: ['REST/API design', 'database schema and queries', 'authentication and authorization', 'concurrency', 'caching', 'observability', 'production incidents'],
  },
  data_analyst: {
    label: 'Data Analyst',
    questionTemplate: 'Use a data analyst loop: SQL, data cleaning, metrics, dashboards, statistics, business interpretation, data quality, and stakeholder communication.',
    questionAngles: ['SQL queries', 'data cleaning', 'dashboard design', 'business metrics', 'statistics basics', 'data quality checks', 'insight communication'],
  },
  ai_ml: {
    label: 'AI/ML Engineer',
    questionTemplate: 'Use an AI/ML loop: data preprocessing, feature engineering, model selection, evaluation metrics, embeddings/RAG when relevant, deployment, monitoring, and responsible AI.',
    questionAngles: ['data preprocessing', 'model selection', 'evaluation metrics', 'feature engineering', 'embeddings and retrieval', 'model deployment', 'monitoring and bias'],
  },
  qa: {
    label: 'QA Engineer',
    questionTemplate: 'Use a QA loop: test planning, test case design, defect reporting, API testing, automation, regression strategy, edge cases, and release risk.',
    questionAngles: ['test case design', 'bug reporting', 'API testing', 'automation strategy', 'regression testing', 'edge cases', 'release readiness'],
  },
  hr_behavioral: {
    label: 'HR / Behavioral',
    questionTemplate: 'Use an HR loop: introduction, motivation, strengths, conflict, teamwork, learning agility, communication, career goals, company fit, and STAR examples.',
    questionAngles: ['self introduction', 'motivation', 'teamwork', 'conflict handling', 'strengths and weaknesses', 'learning agility', 'career goals'],
  },
};

const isInterviewMode = (mode?: string): mode is InterviewMode =>
  Boolean(mode && Object.prototype.hasOwnProperty.call(INTERVIEW_MODE_GUIDANCE, mode));

export const getInterviewModeGuidance = (mode?: string) =>
  isInterviewMode(mode) ? INTERVIEW_MODE_GUIDANCE[mode] : INTERVIEW_MODE_GUIDANCE.sde;

export type SkillGraphNode = {
  skill: string;
  source: 'job_description' | 'resume' | 'role';
  category: 'required' | 'preferred' | 'responsibility' | 'tool' | 'soft_skill' | 'domain';
  weight: number;
};

export type SkillGraphEdge = {
  from: string;
  to: string;
  relation: 'requires' | 'commonly_used_with' | 'validates' | 'supports';
};

export type JobDescriptionProfile = {
  requiredSkills: string[];
  preferredSkills: string[];
  responsibilities: string[];
  toolsTechnologies: string[];
  experienceLevel: string;
  softSkills: string[];
  domainKnowledge: string[];
  keywords: string[];
  seniorityLevel: string;
  skillGraph: {
    nodes: SkillGraphNode[];
    edges: SkillGraphEdge[];
  };
};

export type GeneratedQuestion = {
  question: string;
  expectedSignals: string[];
  questionType?: 'behavioural' | 'technical' | 'situational';
  resumeReference?: string;
  difficulty?: 'easy' | 'easy-medium' | 'medium' | 'medium-hard' | 'scenario' | 'problem-solving' | 'behavioral';
  topic?: string;
  followUpIntent?: 'deepen' | 'clarify' | 'bridge-topic' | 'challenge' | 'recover-confidence';
};

export type AnswerEvaluation = {
  score: number;
  feedback: string;
  idealAnswer?: string;
  samplePerfectAnswer?: string;
  conceptsCovered?: string[];
  missingConcepts?: string[];
  incorrectStatements?: string[];
  wrongTerminology?: string[];
  technicalMistakes?: string[];
  dynamicFeedback?: {
    strengths: string[];
    missingConcepts: string[];
    technicalMistakes: string[];
    communication: string;
    confidence: string;
    areasToImprove: string[];
    nextLearningSuggestions: string[];
    practicalUnderstanding: string;
    interviewReadiness: string;
  };
  communicationScore: number;
  technicalScore: number;
  behavioralScore: number;
  confidenceScore?: number;
  completenessScore?: number;
  depthScore?: number;
  terminologyScore?: number;
  grammarScore?: number;
  vocabularyScore?: number;
  domainScore?: number;
  nextAction?: 'ask_deeper' | 'clarify' | 'move_topic' | 'challenge' | 'reduce_difficulty';
  suggestedDifficulty?: GeneratedQuestion['difficulty'];
  detectedSignals?: string[];
  missingSignals?: string[];
};

export type AdaptiveFollowUpDecision = {
  action: NonNullable<AnswerEvaluation['nextAction']>;
  focus: string;
  reason: string;
  targetDifficulty: NonNullable<GeneratedQuestion['difficulty']>;
  followUpIntent: NonNullable<GeneratedQuestion['followUpIntent']>;
};

export type QuestionAnalysisItem = {
  question: string;
  answer: string;
  score: number;
  feedback: string;
  whatWorked: string;
  whatToImprove: string;
  questionType: string;
  resumeReference: string;
  idealAnswer?: string;
  samplePerfectAnswer?: string;
  conceptsCovered?: string[];
  missingConcepts?: string[];
  incorrectStatements?: string[];
  wrongTerminology?: string[];
  technicalMistakes?: string[];
  dynamicFeedback?: AnswerEvaluation['dynamicFeedback'];
};

export type InterviewReport = {
  communicationScore: number;
  technicalScore: number;
  behavioralScore: number;
  confidenceScore?: number;
  grammarScore?: number;
  vocabularyScore?: number;
  domainExpertiseScore?: number;
  overallScore: number;
  strengths: string[];
  improvements: string[];
  recommendations: string[];
  transcriptSummary: string;
  questionAnalysis?: QuestionAnalysisItem[];
  skillWiseStrengths?: Array<{ skill: string; evidence: string; score: number }>;
  areasForImprovement?: string[];
  missedConcepts?: string[];
  recommendedLearningResources?: string[];
  difficultyProgression?: string[];
  questionTimeline?: Array<{ question: string; topic: string; difficulty: string; score: number }>;
  followUpQuality?: string;
  hiringRecommendation?: 'Strong Hire' | 'Hire' | 'Borderline' | 'No Hire';
  hiringRecommendationReason?: string;
  speakerName?: string;
  accountOwnerName?: string;
  companyReadinessScore?: number;
};

export type ReportGenerationContext = {
  speakerName?: string;
  accountOwnerName?: string;
  targetCompany?: string;
  interviewMode?: InterviewMode;
};

export type AdaptiveTurnResponse = {
  candidateMessageIntent: 'answer' | 'question_to_interviewer';
  interviewerReply?: string | null;
  question: GeneratedQuestion;
};

export type AdaptiveQuestionContext = InterviewContext & {
  previousQuestions: GeneratedQuestion[];
  transcript: Array<{
    question: string;
    answer?: string;
    score?: number;
    feedback?: string;
    questionType?: string;
    resumeReference?: string;
    difficulty?: string;
    topic?: string;
  }>;
  lastQuestion: GeneratedQuestion;
  lastAnswer: string;
  lastEvaluation: AnswerEvaluation;
  followUpDecision?: AdaptiveFollowUpDecision;
  targetQuestionCount: number;
  currentQuestionIndex: number;
  jdProfile?: JobDescriptionProfile;
  companyGuidance?: CompanyInterviewGuidance;
  interviewRoadmap?: InterviewRoadmap;
  interviewState?: InterviewRuntimeState;
};

export type CompanyInterviewGuidance = {
  company?: string;
  style: string;
  preferredTopics: string[];
  behavioralStyle: string;
  codingStyle: string;
  systemDesignExpectations: string;
  technicalDepth: string;
  caution: string;
  researchSource?: 'static' | 'web' | 'static+web';
  researchedAt?: string;
  researchQueries?: string[];
  researchInsights?: string[];
};

export type ResumeInterviewProfile = {
  candidateInformation: {
    name?: string;
    education?: string[];
    degree?: string;
    branch?: string;
    cgpa?: string;
    college?: string;
  };
  skills: {
    programmingLanguages: string[];
    frameworks: string[];
    libraries: string[];
    databases: string[];
    cloudTechnologies: string[];
    operatingSystems: string[];
    developerTools: string[];
    versionControl: string[];
    technicalSkills: string[];
    softSkills: string[];
  };
  projects: string[];
  internships: string[];
  workExperience: string[];
  certifications: string[];
  coursework: string[];
  achievements: string[];
  hackathons: string[];
  researchPapers: string[];
  publications: string[];
  leadership: string[];
  positionsOfResponsibility: string[];
  strengths: string[];
  areasOfInterest: string[];
  interests: string[];
  targetJobRole?: string;
  expectedCompany?: string;
};

export type InterviewRoadmapSectionKey =
  | 'self_introduction'
  | 'resume_overview'
  | 'coursework'
  | 'programming_languages'
  | 'technical_skills'
  | 'projects'
  | 'internship'
  | 'certifications'
  | 'role_specific'
  | 'company_specific'
  | 'coding_problem_solving'
  | 'system_design'
  | 'behavioral'
  | 'hr'
  | 'candidate_questions'
  | 'closing';

export type InterviewRoadmapSection = {
  key: InterviewRoadmapSectionKey;
  title: string;
  topics: string[];
  questionBudget: number;
};

export type InterviewRoadmap = {
  duration: number;
  targetQuestionCount: number;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  roleDomain: string;
  roleLevel: string;
  targetCompany?: string;
  resumeProfile: ResumeInterviewProfile;
  sections: InterviewRoadmapSection[];
  projectQuestionLimit: number;
  followUpLimit: number;
};

export type InterviewRuntimeState = {
  current_section?: InterviewRoadmapSectionKey;
  current_project?: string;
  projects_completed: string[];
  skills_completed: string[];
  internship_completed: boolean;
  certifications_completed: string[];
  company_questions_completed: boolean;
  role_questions_completed: boolean;
  behavioral_completed: boolean;
  hr_completed: boolean;
  coding_completed: boolean;
  remaining_time: number;
  questions_asked: number;
  followups_current_topic: number;
  covered_concepts: string[];
  asked_questions: string[];
};

export type ResumeAnalysis = {
  summary: string;
  skills: string[];
  experienceLevel: string;
  yearsOfExperience: number;
  score: number;
  strengths: string[];
  gaps: string[];
  suggestedQuestions: string[];
};

const TECHNOLOGY_PATTERNS: Array<[string, RegExp]> = [
  ['JavaScript', /\b(?:javascript|js)\b/i],
  ['TypeScript', /\b(?:typescript|ts)\b/i],
  ['React', /\breact(?:\.js|js)?\b/i],
  ['Angular', /\bangular\b/i],
  ['Vue.js', /\bvue(?:\.js|js)?\b/i],
  ['Node.js', /\bnode(?:\.js|js)?\b/i],
  ['Express.js', /\bexpress(?:\.js|js)?\b/i],
  ['Next.js', /\bnext(?:\.js|js)?\b/i],
  ['Python', /\bpython\b/i],
  ['Django', /\bdjango\b/i],
  ['Flask', /\bflask\b/i],
  ['FastAPI', /\bfastapi\b/i],
  ['Java', /\bjava\b/i],
  ['Spring Boot', /\bspring\s*boot\b/i],
  ['C#', /\bc#\b/i],
  ['.NET', /\b\.net\b/i],
  ['C++', /\bc\+\+\b/i],
  ['Go', /\bgolang\b|\bgo\b/i],
  ['PHP', /\bphp\b/i],
  ['Laravel', /\blaravel\b/i],
  ['Ruby on Rails', /\bruby\s+on\s+rails\b|\brails\b/i],
  ['SQL', /\bsql\b/i],
  ['MySQL', /\bmysql\b/i],
  ['PostgreSQL', /\bpostgres(?:ql)?\b/i],
  ['MongoDB', /\bmongodb\b/i],
  ['Redis', /\bredis\b/i],
  ['Elasticsearch', /\belasticsearch\b/i],
  ['GraphQL', /\bgraphql\b/i],
  ['REST APIs', /\brest(?:ful)?\s+api?s?\b/i],
  ['AWS', /\baws\b|\bamazon web services\b/i],
  ['Azure', /\bazure\b/i],
  ['Google Cloud', /\bgcp\b|\bgoogle cloud\b/i],
  ['Docker', /\bdocker\b/i],
  ['Kubernetes', /\bkubernetes\b|\bk8s\b/i],
  ['Jenkins', /\bjenkins\b/i],
  ['Git', /\bgit\b/i],
  ['CI/CD', /\bci\/cd\b|\bcontinuous integration\b|\bcontinuous deployment\b/i],
  ['Terraform', /\bterraform\b/i],
  ['Kafka', /\bkafka\b/i],
  ['RabbitMQ', /\brabbitmq\b/i],
  ['Microservices', /\bmicroservices?\b/i],
  ['System Design', /\bsystem design\b/i],
  ['Machine Learning', /\bmachine learning\b|\bml\b/i],
  ['TensorFlow', /\btensorflow\b/i],
  ['PyTorch', /\bpytorch\b/i],
  ['Pandas', /\bpandas\b/i],
  ['NumPy', /\bnumpy\b/i],
  ['Power BI', /\bpower\s*bi\b/i],
  ['Tableau', /\btableau\b/i],
  ['Selenium', /\bselenium\b/i],
  ['Cypress', /\bcypress\b/i],
  ['Jest', /\bjest\b/i],
  ['Playwright', /\bplaywright\b/i],
  ['Agile', /\bagile\b/i],
  ['Scrum', /\bscrum\b/i],
];

const SOFT_SKILL_PATTERNS: Array<[string, RegExp]> = [
  ['Communication', /\bcommunication|presentation|stakeholder|client-facing\b/i],
  ['Leadership', /\bleadership|mentoring|team lead|ownership\b/i],
  ['Collaboration', /\bcollaboration|cross-functional|teamwork\b/i],
  ['Problem Solving', /\bproblem[-\s]?solving|debugging|troubleshooting\b/i],
  ['Adaptability', /\badaptability|fast[-\s]?paced|learn quickly|ambiguity\b/i],
  ['Attention to Detail', /\battention to detail|accuracy|quality\b/i],
];

const DOMAIN_PATTERNS: Array<[string, RegExp]> = [
  ['FinTech', /\bfintech|payments?|banking|trading|financial|invoice|ledger\b/i],
  ['Healthcare', /\bhealthcare|clinical|patient|medical|life sciences\b/i],
  ['E-commerce', /\be-?commerce|checkout|cart|catalog|marketplace|retail\b/i],
  ['AI/ML', /\bai|machine learning|ml|llm|rag|embeddings?|computer vision|nlp\b/i],
  ['SaaS', /\bsaas|multi-tenant|enterprise software|subscription\b/i],
  ['Cybersecurity', /\bsecurity|iam|authentication|authorization|vulnerability|threat\b/i],
  ['Data Engineering', /\bdata pipeline|etl|warehouse|analytics|bi\b/i],
];

const RESPONSIBILITY_PATTERN =
  /\b(?:design(?:ing|s|ed)?|develop(?:ing|s|ed)?|build(?:ing|s|s)?|implement(?:ing|s|ed)?|maintain(?:ing|s|ed)?|own(?:ing|s|ed)?|lead(?:ing|s)?|deploy(?:ing|s|ed)?|optimi[sz](?:e|ing|es|ed)|debug(?:ging|s|ged)?|integrat(?:e|ing|es|ed)|collaborat(?:e|ing|es|ed)|manag(?:e|ing|es|ed)|test(?:ing|s|ed)?|monitor(?:ing|s|ed)?)\b[^.\n;]*/gi;

const canonicalize = (value: string) => value.replace(/\s+/g, ' ').trim();

const unique = (values: string[]) =>
  Array.from(new Set(values.map(canonicalize).filter(Boolean)));

export const extractJobDescriptionTechnologies = (jobDescription?: string) => {
  const text = jobDescription?.trim();
  if (!text) return [];

  return TECHNOLOGY_PATTERNS
    .filter(([, pattern]) => pattern.test(text))
    .map(([name]) => name);
};

const extractPatternMatches = (text: string, patterns: Array<[string, RegExp]>) =>
  patterns.filter(([, pattern]) => pattern.test(text)).map(([name]) => name);

const extractResponsibilities = (text: string) =>
  unique((text.match(RESPONSIBILITY_PATTERN) ?? []).map((item) => item.replace(/^\s*[-*]\s*/, '').slice(0, 160))).slice(0, 12);

const extractExperienceLevel = (text: string, roleLevel?: string) => {
  const years = text.match(/(\d+)\+?\s*(?:years|yrs)/i)?.[1];
  if (/principal|staff|architect/i.test(text)) return years ? `Principal/Staff, ${years}+ years` : 'Principal/Staff';
  if (/lead|manager|head of/i.test(text)) return years ? `Lead, ${years}+ years` : 'Lead';
  if (/senior|sr\./i.test(text)) return years ? `Senior, ${years}+ years` : 'Senior';
  if (/intern|graduate|entry[-\s]?level|fresher/i.test(text)) return years ? `Entry level, ${years}+ years` : 'Entry level';
  if (years) return `${years}+ years`;
  return roleLevel || 'Not specified';
};

const inferSeniority = (text: string, roleLevel?: string) => {
  if (/principal|staff|architect/i.test(text)) return 'Principal';
  if (/lead|manager|head of/i.test(text)) return 'Lead';
  if (/senior|sr\./i.test(text)) return 'Senior';
  if (/mid|software engineer ii|sde ii/i.test(text)) return 'Mid';
  if (/junior|entry[-\s]?level|graduate|fresher|intern/i.test(text)) return 'Fresher';
  return roleLevel || 'Mid';
};

const extractKeywords = (text: string) => {
  const words = text
    .replace(/[^a-zA-Z0-9+#./\s-]/g, ' ')
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 2 && !/^(and|the|with|for|from|this|that|you|are|will|have|our|your|role|work|team)$/i.test(word));

  const frequency = new Map<string, number>();
  words.forEach((word) => frequency.set(word.toLowerCase(), (frequency.get(word.toLowerCase()) ?? 0) + 1));
  return Array.from(frequency.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25)
    .map(([word]) => word);
};

export const buildJobDescriptionProfile = (
  jobDescription?: string,
  options: { roleLevel?: string; resumeSkills?: string[]; roleDomain?: string } = {},
): JobDescriptionProfile => {
  const text = jobDescription?.trim() ?? '';
  const toolsTechnologies = unique(extractJobDescriptionTechnologies(text));
  const resumeOverlap = unique((options.resumeSkills ?? []).filter((skill) => new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text)));
  const softSkills = unique(extractPatternMatches(text, SOFT_SKILL_PATTERNS));
  const domainKnowledge = unique(extractPatternMatches(`${text}\n${options.roleDomain ?? ''}`, DOMAIN_PATTERNS));
  const responsibilities = extractResponsibilities(text);
  const preferredSkills = unique(
    toolsTechnologies.filter((skill) => {
      const skillIndex = text.toLowerCase().indexOf(skill.toLowerCase());
      const preceding = skillIndex >= 0 ? text.slice(Math.max(0, skillIndex - 90), skillIndex).toLowerCase() : '';
      return /preferred|nice to have|good to have|plus|bonus|familiar/.test(preceding);
    }),
  );
  const requiredSkills = unique([...toolsTechnologies.filter((skill) => !preferredSkills.includes(skill)), ...resumeOverlap]);
  const keywords = unique([...toolsTechnologies, ...softSkills, ...domainKnowledge, ...extractKeywords(text)]).slice(0, 40);

  const nodes: SkillGraphNode[] = [
    ...requiredSkills.map((skill) => ({ skill, source: 'job_description' as const, category: 'required' as const, weight: 1 })),
    ...preferredSkills.map((skill) => ({ skill, source: 'job_description' as const, category: 'preferred' as const, weight: 0.7 })),
    ...softSkills.map((skill) => ({ skill, source: 'job_description' as const, category: 'soft_skill' as const, weight: 0.6 })),
    ...domainKnowledge.map((skill) => ({ skill, source: 'job_description' as const, category: 'domain' as const, weight: 0.8 })),
  ];

  const edges: SkillGraphEdge[] = [];
  for (let i = 0; i < toolsTechnologies.length; i += 1) {
    for (let j = i + 1; j < Math.min(toolsTechnologies.length, i + 4); j += 1) {
      edges.push({ from: toolsTechnologies[i], to: toolsTechnologies[j], relation: 'commonly_used_with' });
    }
  }
  responsibilities.slice(0, 5).forEach((responsibility) => {
    toolsTechnologies.slice(0, 4).forEach((skill) => {
      edges.push({ from: skill, to: responsibility, relation: 'supports' });
    });
  });

  return {
    requiredSkills,
    preferredSkills,
    responsibilities,
    toolsTechnologies,
    experienceLevel: extractExperienceLevel(text, options.roleLevel),
    softSkills,
    domainKnowledge,
    keywords,
    seniorityLevel: inferSeniority(text, options.roleLevel),
    skillGraph: {
      nodes: unique(nodes.map((node) => node.skill)).map((skill) => nodes.find((node) => node.skill === skill) as SkillGraphNode),
      edges,
    },
  };
};

const TECHNICAL_TERM_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\brest\s*api?s?\b/gi, 'REST API'],
  [/\bfast\s*api\b/gi, 'FastAPI'],
  [/\bnum\s*pi\b|\bnumpy\b/gi, 'NumPy'],
  [/\bpandas\b/gi, 'Pandas'],
  [/\bpi\s*torch\b|\bpytorch\b/gi, 'PyTorch'],
  [/\btensor\s*flow\b|\btensorflow\b/gi, 'TensorFlow'],
  [/\bpostgre\s*sql\b|\bpostgres\b|\bpostgresql\b/gi, 'PostgreSQL'],
  [/\bmongo\s*db\b|\bmongodb\b/gi, 'MongoDB'],
  [/\bnode\s*js\b/gi, 'Node.js'],
  [/\bnext\s*js\b/gi, 'Next.js'],
  [/\bvue\s*js\b/gi, 'Vue.js'],
  [/\bgraph\s*ql\b/gi, 'GraphQL'],
  [/\bo\s*auth\b/gi, 'OAuth'],
  [/\bj\s*w\s*t\b/gi, 'JWT'],
  [/\bci\s*\/?\s*cd\b/gi, 'CI/CD'],
  [/\bk\s*8\s*s\b/gi, 'K8s'],
  [/\bkubernetes\b/gi, 'Kubernetes'],
  [/\blang\s*chain\b/gi, 'LangChain'],
  [/\bopen\s*ai\b/gi, 'OpenAI'],
  [/\bl\s*l\s*m?s?\b/gi, 'LLM'],
  [/\br\s*a\s*g\b/gi, 'RAG'],
  [/\bf\s*a\s*i\s*s\s*s\b/gi, 'FAISS'],
  [/\bgit\s*hub\b/gi, 'GitHub'],
  // Degree / qualification phrasing only (not a national college dictionary)
  [/\bbee\s*tech\b/gi, 'B.Tech'],
  [/\bb\s*tech\b/gi, 'B.Tech'],
  [/\bm\s*tech\b/gi, 'M.Tech'],
];

const SAFE_CONTEXT_TERM_MIN_LENGTH = 5;

const EDUCATION_ANCHOR =
  /\b(?:university|college|institute|institution|school|academy|polytechnic)\b/i;

/** Pull college/university names from THIS candidate's resume — scales without a national list. */
export const extractEducationEntities = (resumeText?: string): string[] => {
  if (!resumeText?.trim()) return [];
  const lines = resumeText
    .split(/\r?\n|[,;|]/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const entities: string[] = [];
  for (const line of lines) {
    if (!EDUCATION_ANCHOR.test(line)) continue;
    if (line.length < 6 || line.length > 120) continue;
    // Drop long bullet paragraphs; keep institution-like phrases
    if ((line.match(/\b/g) || []).length > 28) continue;
    const cleaned = line
      .replace(/^(education|academic|qualification|college|university)\s*[:\-–]?\s*/i, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (cleaned.length >= 6) entities.push(cleaned);
  }

  return unique(entities).slice(0, 12);
};

const significantTokens = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !['the', 'and', 'for', 'from', 'with', 'university', 'college', 'institute', 'of'].includes(token));

/**
 * When the transcript mentions a university/college, map the garbled phrase
 * to the closest institution name found on the candidate's resume.
 */
export const alignTranscriptWithResumeEducation = (
  transcript: string,
  educationEntities: string[],
): string => {
  if (!transcript?.trim() || !educationEntities.length) return transcript;

  const anchorMatch = transcript.match(
    /\b(?:[\w'.-]+\s+){0,5}(?:university|college|institute|institution|school|academy|polytechnic)\b(?:\s+[\w'.-]+){0,3}/gi,
  );
  if (!anchorMatch?.length) return transcript;

  let updated = transcript;
  for (const phrase of anchorMatch) {
    const phraseTokens = new Set(significantTokens(phrase));
    if (!phraseTokens.size && !EDUCATION_ANCHOR.test(phrase)) continue;

    let best: { name: string; score: number } | null = null;
    for (const entity of educationEntities) {
      const entityTokens = significantTokens(entity);
      if (!entityTokens.length) continue;
      const overlap = entityTokens.filter((token) => {
        if (phraseTokens.has(token)) return true;
        // Allow fuzzy token match (vigyan ~ vignan, nancy distant from vignan so won't false-match alone)
        return [...phraseTokens].some((pt) => {
          const distance = levenshtein(pt, token);
          const maxDistance = token.length >= 6 ? 2 : 1;
          return distance <= maxDistance;
        });
      }).length;
      const coverage = overlap / entityTokens.length;
      // Prefer entities with shared distinctive tokens; also prefer sole resume school near "university"
      const score = coverage + (educationEntities.length === 1 ? 0.35 : 0);
      if (!best || score > best.score) best = { name: entity, score };
    }

    if (best && best.score >= 0.35) {
      updated = updated.replace(phrase, best.name);
    }
  }

  return updated.replace(/\bfrom\s+with\s+/gi, 'from ').replace(/\s+/g, ' ').trim();
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const levenshtein = (a: string, b: string) => {
  const matrix = Array.from({ length: b.length + 1 }, (_, i) => [i]);
  for (let j = 0; j <= a.length; j += 1) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i += 1) {
    for (let j = 1; j <= a.length; j += 1) {
      matrix[i][j] =
        b.charAt(i - 1) === a.charAt(j - 1)
          ? matrix[i - 1][j - 1]
          : Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
    }
  }
  return matrix[b.length][a.length];
};

const replaceSafeContextTerm = (text: string, term: string) => {
  if (term.length < SAFE_CONTEXT_TERM_MIN_LENGTH) return text;

  const pattern = new RegExp(`\\b${escapeRegExp(term).replace(/\s+/g, '\\s+')}\\b`, 'gi');
  return text.replace(pattern, (match) => {
    if (match.toLowerCase() === term.toLowerCase()) return term;
    const distance = levenshtein(match.toLowerCase(), term.toLowerCase());
    const maxDistance = term.length >= 8 ? 2 : 1;
    return distance <= maxDistance ? term : match;
  });
};

export const normalizeTechnicalTranscript = (text: string, context?: TranscriptionContext) => {
  let normalized = text.replace(/\s+/g, ' ').trim();
  TECHNICAL_TERM_REPLACEMENTS.forEach(([pattern, replacement]) => {
    normalized = normalized.replace(pattern, replacement);
  });

  const educationEntities = unique([
    ...(context?.resumeEducation ?? []),
    ...extractEducationEntities(context?.resumeText),
  ]);
  normalized = alignTranscriptWithResumeEducation(normalized, educationEntities);

  const contextTerms = unique([
    ...(context?.resumeSkills ?? []),
    ...(context?.resumeProjects ?? []),
    ...educationEntities,
    ...extractJobDescriptionTechnologies(context?.jobDescription),
  ]).sort((a, b) => b.length - a.length);

  contextTerms.forEach((term) => {
    normalized = replaceSafeContextTerm(normalized, term);
  });

  return normalized;
};

const WHISPER_PROMPT_MAX_CHARS = 800;
const MIN_INTERVIEW_AUDIO_BYTES = 1200;

const extractQuestionVocabulary = (question?: string) => {
  if (!question?.trim()) return [] as string[];
  return extractJobDescriptionTechnologies(question);
};

/**
 * Groq/OpenAI Whisper uses `prompt` as style + vocabulary priming — NOT instructions.
 * Long "do not hallucinate" text can bleed into the transcript or skew output.
 * We prime with a short, natural candidate-answer sentence containing expected terms.
 */
export const buildGroqWhisperPrompt = (context?: TranscriptionContext): string => {
  const educationEntities = unique([
    ...(context?.resumeEducation ?? []),
    ...extractEducationEntities(context?.resumeText),
  ]).slice(0, 4);

  const terms = unique(
    [
      ...educationEntities,
      ...(context?.resumeSkills ?? []),
      ...(context?.resumeProjects ?? []),
      ...extractJobDescriptionTechnologies(context?.jobDescription),
      ...extractQuestionVocabulary(context?.currentQuestion),
      context?.roleDomain,
      context?.targetCompany,
    ].filter((term): term is string => Boolean(term?.trim())),
  )
    .map((term) => term.trim())
    .filter((term) => term.length >= 3 && term.length <= 48)
    .slice(0, 18);

  if (terms.length >= 3) {
    const [first, second, third, ...rest] = terms;
    const tail = rest.slice(0, 6).join(', ');
    const educationBit = educationEntities[0]
      ? `I studied at ${educationEntities[0]}. `
      : '';
    const sample = tail
      ? `${educationBit}In my project I used ${first}, ${second}, and ${third}, along with ${tail}. I explained the architecture, trade-offs, and testing approach.`
      : `${educationBit}In my project I used ${first}, ${second}, and ${third}. I explained the design, implementation, and results.`;
    return sample.slice(0, WHISPER_PROMPT_MAX_CHARS);
  }

  if (educationEntities[0]) {
    return `I completed my B.Tech at ${educationEntities[0]}. In my internship I worked on REST APIs, a SQL database, and backend services.`.slice(
      0,
      WHISPER_PROMPT_MAX_CHARS,
    );
  }

  return 'In my internship I worked on REST APIs, a SQL database, and backend services. I handled debugging, testing, and deployment.'.slice(
    0,
    WHISPER_PROMPT_MAX_CHARS,
  );
};

const buildTranscriptionPrompt = (context?: TranscriptionContext) => {
  if (env.AI_PROVIDER === 'groq') {
    return buildGroqWhisperPrompt(context);
  }

  const terms = Array.from(
    new Set([
      ...(context?.resumeSkills ?? []),
      ...(context?.resumeProjects ?? []),
      ...extractJobDescriptionTechnologies(context?.jobDescription),
      ...extractQuestionVocabulary(context?.currentQuestion),
    ]
      .map((term) => term.trim())
      .filter(Boolean)),
  ).slice(0, 30);

  return terms.length
    ? `Technical interview answer mentioning ${terms.join(', ')}.`
    : 'Technical interview answer about software engineering projects and experience.';
};

const extractJson = <T>(text: string): T => {
  const cleaned = text.replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
  return JSON.parse(cleaned) as T;
};

const generateJson = async <T>(
  prompt: string,
  fallback: T,
  options?: { systemPrompt?: string },
): Promise<T> => {
  const systemContent = options?.systemPrompt ?? 'Return strict JSON only. Do not include markdown.';

  try {
    if (env.AI_PROVIDER === 'openai' && openai) {
      const client = openai as unknown as {
        responses: {
          create(input: {
            model: string;
            input: string;
            text: { format: { type: 'json_object' } };
          }): Promise<{ output_text: string }>;
        };
      };

      const response = await client.responses.create({
        model: env.OPENAI_MODEL,
        input: `${systemContent}\n\n${prompt}`,
        text: { format: { type: 'json_object' } },
      });

      return extractJson<T>(response.output_text);
    }

    if (env.AI_PROVIDER === 'groq' && groq) {
      const response = await groq.chat.completions.create({
        model: env.GROQ_MODEL,
        messages: [
          { role: 'system', content: systemContent },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
      });

      return extractJson<T>(response.choices[0]?.message?.content ?? '{}');
    }
  } catch (error) {
    console.warn('AI JSON generation failed; using deterministic fallback.', error);
  }

  return fallback;
};

export const transcribeAudio = async (file: Express.Multer.File, context?: TranscriptionContext) => {
  const client = env.AI_PROVIDER === 'groq' ? groq : openai;
  const model = env.AI_PROVIDER === 'groq' ? env.GROQ_WHISPER_MODEL : env.WHISPER_MODEL;
  const provider = env.AI_PROVIDER;

  if (!client) {
    return {
      text: `Transcription unavailable locally for ${file.originalname}. Configure ${provider.toUpperCase()}_API_KEY to enable speech recognition.`,
      model,
      provider,
    };
  }

  if (file.buffer.length < MIN_INTERVIEW_AUDIO_BYTES) {
    return {
      text: '',
      rawText: '',
      model,
      provider,
      promptApplied: false,
      warning: 'Audio clip was too short to transcribe reliably.',
    };
  }

  const uploadedFile = await toFile(file.buffer, file.originalname, { type: file.mimetype });
  const prompt = buildTranscriptionPrompt(context);
  const response = await client.audio.transcriptions.create({
    file: uploadedFile,
    model,
    language: 'en',
    prompt,
    temperature: 0,
    response_format: 'json',
  } as any);

  const rawText = typeof response.text === 'string' ? response.text.trim() : '';

  return {
    text: normalizeTechnicalTranscript(rawText, context),
    rawText,
    model,
    provider,
    promptApplied: Boolean(prompt),
  };
};

/** Mock interview answer STT — Groq Whisper when AI_PROVIDER=groq. Sarvam STT is separate (image-description route). */
export const transcribeInterviewAnswer = transcribeAudio;

const firstTranscript = (value: unknown): string | undefined => {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(firstTranscript).find(Boolean);
  if (typeof value !== 'object') return undefined;

  const record = value as Record<string, unknown>;
  return (
    firstTranscript(record.transcript) ||
    firstTranscript(record.text) ||
    firstTranscript(record.transcription) ||
    firstTranscript(record.result) ||
    firstTranscript(record.data)
  );
};

export const transcribeAudioWithSarvam = async (file: Express.Multer.File) => {
  if (!env.SARVAM_API_KEY) {
    throw new Error('SARVAM_API_KEY is not configured.');
  }

  const formData = new FormData();
  const arrayBuffer = file.buffer.buffer.slice(
    file.buffer.byteOffset,
    file.buffer.byteOffset + file.buffer.byteLength,
  ) as ArrayBuffer;
  const blob = new Blob([arrayBuffer], { type: file.mimetype || 'audio/webm' });
  formData.append('file', blob, file.originalname || 'speech.webm');
  formData.append('language_code', 'en-IN');

  const response = await fetch(env.SARVAM_STT_ENDPOINT, {
    method: 'POST',
    headers: {
      'api-subscription-key': env.SARVAM_API_KEY,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Sarvam STT ${response.status}: ${errorText}`);
  }

  const payload = await response.json().catch(() => null);
  const text = firstTranscript(payload)?.trim() ?? '';
  return {
    text: normalizeTechnicalTranscript(text),
    rawText: text,
    model: 'sarvam:speech-to-text',
    raw: payload,
  };
};

const PERSONA_PERSONALITIES: Record<string, string> = {
  'us-american': 'You are Ryan Carter, a Senior Tech Lead. You are direct, value concrete examples, and use STAR method prompts. You expect candidates to be specific and results-driven.',
  'us-indian': 'You are Priya Sharma, an Engineering Manager. You are analytical, probe technical depth, and ask thorough follow-up questions. You value structured thinking.',
  'us-australian': 'You are Ananya Rao, a Product Director. You are conversational, test product thinking and communication clarity, and keep the interview relaxed but sharp. You value adaptability and big-picture thinking.',
  'ru-russian': 'You are Rahul Menon, a Principal Engineer. You are precise and methodical. You focus on algorithmic thinking, system design, and rigorous problem-solving. You expect well-structured, logically sound answers and will probe deeply into technical reasoning.',
};

const difficultyForPosition = (index: number, total: number): NonNullable<GeneratedQuestion['difficulty']> => {
  const ratio = total <= 1 ? 0 : index / (total - 1);
  if (ratio < 0.16) return 'easy';
  if (ratio < 0.32) return 'easy-medium';
  if (ratio < 0.5) return 'medium';
  if (ratio < 0.66) return 'medium-hard';
  if (ratio < 0.82) return 'scenario';
  if (ratio < 0.94) return 'problem-solving';
  return 'behavioral';
};

const plannedQuestionCountForDuration = (duration: number) => {
  if (duration <= 15) return 10;
  if (duration <= 20) return 13;
  if (duration <= 30) return 18;
  if (duration <= 45) return 26;
  return 34;
};

const fallbackInitialQuestions = (
  context: InterviewContext,
  questionCount: number,
  jdProfile: JobDescriptionProfile,
): GeneratedQuestion[] => {
  const modeGuidance = getInterviewModeGuidance(context.interviewMode);
  const topics = unique([
    ...modeGuidance.questionAngles,
    ...jdProfile.requiredSkills,
    ...jdProfile.toolsTechnologies,
    ...(context.resumeSkills ?? []),
    context.roleDomain,
  ]).filter(Boolean);
  const primaryTopic = topics[0] ?? context.roleDomain;
  const secondaryTopic = topics[1] ?? primaryTopic;
  const projectAnchor = context.resumeSummary ? 'a project from your resume' : 'one relevant project';
  const base: GeneratedQuestion[] = [
    {
      question: `To get started, walk me through your background and the experience most relevant to ${context.roleDomain}.`,
      expectedSignals: ['concise summary', 'role-relevant experience', 'clear motivation'],
      questionType: 'behavioural',
      resumeReference: 'candidate overview',
      difficulty: 'easy',
      topic: context.roleDomain,
      followUpIntent: 'bridge-topic',
    },
    {
      question: `For a ${modeGuidance.label} interview, the role emphasizes ${primaryTopic}. Can you explain how you have used it in ${projectAnchor}?`,
      expectedSignals: ['specific project context', 'hands-on usage', 'mode-relevant technical terminology'],
      questionType: 'technical',
      resumeReference: `JD skill: ${primaryTopic}`,
      difficulty: 'easy-medium',
      topic: primaryTopic,
      followUpIntent: 'deepen',
    },
    {
      question: `How would you compare ${primaryTopic} with ${secondaryTopic} when making a ${modeGuidance.label} design decision?`,
      expectedSignals: ['trade-off reasoning', 'practical constraints', 'production awareness'],
      questionType: 'technical',
      resumeReference: `JD skill graph: ${primaryTopic} and ${secondaryTopic}`,
      difficulty: 'medium',
      topic: primaryTopic,
      followUpIntent: 'challenge',
    },
    {
      question: `Imagine work involving ${primaryTopic} starts failing in a real ${modeGuidance.label} scenario. How would you investigate and communicate the issue?`,
      expectedSignals: ['debugging steps', 'observability', 'stakeholder communication'],
      questionType: 'situational',
      resumeReference: `JD responsibility: ${jdProfile.responsibilities[0] ?? 'production ownership'}`,
      difficulty: 'scenario',
      topic: primaryTopic,
      followUpIntent: 'challenge',
    },
    {
      question: 'Tell me about a time you received difficult feedback or faced a conflict on a technical decision. What did you do, and what was the result?',
      expectedSignals: ['STAR structure', 'self-awareness', 'measurable outcome'],
      questionType: 'behavioural',
      resumeReference: 'behavioral assessment',
      difficulty: 'behavioral',
      topic: 'Communication',
      followUpIntent: 'clarify',
    },
  ];

  return Array.from({ length: questionCount }, (_, index) => ({
    ...(base[index % base.length]),
    difficulty: difficultyForPosition(index, questionCount),
  }));
};

const buildPromptBuilderInput = (
  context: InterviewContext,
  jdProfile?: JobDescriptionProfile,
  companyQuestionBank?: CompanyQuestionEntry[] | null,
  companyBankMode: 'verified' | 'generic' | 'none' = 'none',
) => {
  const modeGuidance = getInterviewModeGuidance(context.interviewMode);
  const candidateResume =
    context.resumeProfile ??
    ({
      summary: context.resumeSummary,
      skills: context.resumeSkills,
      rawText: context.resumeText,
    } as const);

  return {
    candidateResume,
    jobDescription: context.jobDescription,
    jdProfile,
    company: context.targetCompany,
    role: context.roleDomain,
    experienceLevel: mapExperienceLevel(context.roleLevel),
    companyQuestionBank: companyQuestionBank ?? null,
    companyBankMode,
    interviewType: mapInterviewPromptType(context.interviewType ?? context.interviewStyle),
    personaId: context.personaId,
    personaPersonality: context.personaPersonality,
    interviewModeLabel: modeGuidance.label,
    interviewModeTemplate: modeGuidance.questionTemplate,
    complexity: context.complexity,
    roleLevel: context.roleLevel,
  };
};

const resolveCompanyQuestionBank = (context: InterviewContext) => {
  const bankResult = getCompanyQuestions(
    context.targetCompany,
    context.roleDomain,
    mapExperienceLevel(context.roleLevel),
    8,
  );

  if (!bankResult) {
    return { questions: null as CompanyQuestionEntry[] | null, mode: 'none' as const };
  }

  return { questions: bankResult.questions, mode: bankResult.mode };
};

export const generateInterviewQuestions = (context: InterviewContext) => {
  const questionCount = plannedQuestionCountForDuration(context.duration);
  const sessionSeed = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const jdProfile = buildJobDescriptionProfile(context.jobDescription, {
    roleLevel: context.roleLevel,
    roleDomain: context.roleDomain,
    resumeSkills: context.resumeSkills,
  });
  const { questions: companyQuestionBank, mode: companyBankMode } = resolveCompanyQuestionBank(context);
  const systemPrompt = buildInterviewSystemPrompt(
    buildPromptBuilderInput(context, jdProfile, companyQuestionBank, companyBankMode),
  );
  const userPrompt = buildInitialQuestionsUserPrompt(questionCount, sessionSeed);

  return generateJson<{ questions: GeneratedQuestion[] }>(
    userPrompt,
    { questions: fallbackInitialQuestions(context, questionCount, jdProfile) },
    { systemPrompt },
  );
};

type AnswerEvaluationContext = {
  expectedSignals?: string[];
  roleDomain?: string;
  roleLevel?: string;
  targetCompany?: string;
  difficulty?: string;
  questionType?: string;
  topic?: string;
};

const sentenceFromSignal = (signal: string, topic: string) => {
  const cleanSignal = canonicalize(signal).replace(/[.]+$/, '');
  return cleanSignal
    ? `It should clearly address ${cleanSignal}${topic ? ` in the context of ${topic}` : ''}.`
    : '';
};

const buildIdealAnswerFallback = (question: string, context?: AnswerEvaluationContext) => {
  const topic = context?.topic || context?.roleDomain || 'the topic';
  const signals = context?.expectedSignals?.length
    ? context.expectedSignals
    : ['the core concept', 'a practical example', 'trade-offs or edge cases'];
  const signalSentences = signals.map((signal) => sentenceFromSignal(signal, topic)).filter(Boolean).join(' ');
  const companyContext = context?.targetCompany ? ` For ${context.targetCompany}, it should connect the answer to practical judgement and role expectations.` : '';
  return canonicalize(
    `A strong interview answer to "${question}" should start with a direct explanation of ${topic}, then support it with a concrete example. ${signalSentences} It should mention relevant trade-offs, validation or testing, and the impact of the decision. The answer should be structured, technically accurate, and confident.${companyContext}`,
  );
};

const tokenizeConcepts = (value: string) =>
  Array.from(
    new Set(
      value
        .toLowerCase()
        .replace(/[^a-z0-9+#.\s-]/g, ' ')
        .split(/\s+/)
        .map((word) => word.trim())
        .filter((word) => word.length > 3 && !/^(that|this|with|from|they|have|were|when|what|would|should|could|about|because|using|used|into|their|there|then|than|also)$/i.test(word)),
    ),
  );

const fallbackComparisonEvaluation = (
  question: string,
  answer: string,
  context?: AnswerEvaluationContext,
): AnswerEvaluation => {
  const turnType = classifyAnswerTurn(answer);
  const idealAnswerBase = buildIdealAnswerFallback(question, context);
  const idealAnswer =
    turnType === 'clarification_request'
      ? buildClarificationIdealAnswer(question, idealAnswerBase)
      : idealAnswerBase;
  const expectedSignals = context?.expectedSignals ?? [];
  const answerTokens = tokenizeConcepts(answer);
  const signalCoverage = expectedSignals.filter((signal) =>
    tokenizeConcepts(signal).some((token) => answerTokens.includes(token)),
  );
  const missingSignals = expectedSignals.filter((signal) => !signalCoverage.includes(signal));
  const wordCount = answer.trim().split(/\s+/).filter(Boolean).length;
  const completeness = expectedSignals.length
    ? Math.round((signalCoverage.length / expectedSignals.length) * 100)
    : Math.min(100, wordCount * 3);
  const depth = Math.min(100, Math.round(wordCount * 2 + (/\b(example|trade[-\s]?off|because|tested|deployed|optimized|measured|edge case)\b/i.test(answer) ? 20 : 0)));
  const communication = Math.min(100, Math.max(20, Math.round(wordCount * 2.2)));
  const terminology = Math.min(100, Math.round((answerTokens.length / Math.max(1, tokenizeConcepts(idealAnswer).length)) * 100));
  const score = Math.round((completeness * 0.35) + (depth * 0.25) + (communication * 0.2) + (terminology * 0.2));
  const missingConcepts = missingSignals.length ? missingSignals : ['No clear gap was identified from the expected signals, but more specificity would improve the answer.'];
  const strengths = [
    ...(signalCoverage.length ? [`Covered ${signalCoverage.slice(0, 2).join(', ')}.`] : []),
    ...(wordCount >= 30 ? ['Gave enough detail for evaluation.'] : []),
  ];

  const whatWorked = signalCoverage.length
    ? `Correct: covered ${signalCoverage.slice(0, 2).join(', ')}.`
    : 'Correct: the answer attempted the question, but it did not clearly cover the expected signals.';
  const whatWasMissing = `Missing: ${missingConcepts.slice(0, 2).join(', ')}.`;
  const improvementDirection = `Improve by explaining ${missingConcepts[0]} with a concrete project example, trade-off, and validation step.`;

  return {
    score,
    feedback: `${whatWorked} ${whatWasMissing} ${improvementDirection} The ideal answer should be structured, technically accurate, and backed by evidence.`,
    idealAnswer,
    samplePerfectAnswer: idealAnswer,
    conceptsCovered: signalCoverage,
    missingConcepts,
    incorrectStatements: [],
    wrongTerminology: [],
    technicalMistakes: [],
    dynamicFeedback: {
      strengths: strengths.length ? strengths : ['The answer attempted the question directly.'],
      missingConcepts,
      technicalMistakes: [],
      communication: wordCount < 25 ? 'The answer needs clearer structure and more complete sentences.' : 'The answer is understandable; it can improve by using a clearer beginning, middle, and conclusion.',
      confidence: /\b(maybe|i think|not sure|probably)\b/i.test(answer) ? 'The wording sounds tentative; use more decisive language after stating assumptions.' : 'The answer sounds reasonably confident based on wording.',
      areasToImprove: missingConcepts.map((item) => `Concept to improve: ${item}. Explain what it means, why it matters, and how you used or would use it.`).slice(0, 4),
      nextLearningSuggestions: missingConcepts.map((item) => `Practice an ideal-answer version for ${item}: definition, project example, trade-off, and validation.`).slice(0, 4),
      practicalUnderstanding: /\b(project|built|implemented|deployed|tested|used)\b/i.test(answer)
        ? 'The answer includes some practical framing.'
        : 'The answer should include a practical implementation or project example.',
      interviewReadiness: score >= 70 ? 'Ready for follow-up depth on this concept.' : 'Needs more preparation before a real interview follow-up.',
    },
    communicationScore: communication,
    technicalScore: context?.questionType === 'behavioural' ? Math.round(score * 0.5) : score,
    behavioralScore: context?.questionType === 'technical' ? Math.round(score * 0.4) : score,
    confidenceScore: /\b(maybe|i think|not sure|probably)\b/i.test(answer) ? Math.max(30, score - 20) : score,
    completenessScore: completeness,
    depthScore: depth,
    terminologyScore: terminology,
    grammarScore: communication,
    vocabularyScore: terminology,
    domainScore: score,
    nextAction: score < 40 ? 'reduce_difficulty' : score < 60 ? 'clarify' : score >= 85 ? 'challenge' : score >= 70 ? 'ask_deeper' : 'move_topic',
    suggestedDifficulty: score < 40 ? 'easy' : context?.difficulty as GeneratedQuestion['difficulty'] ?? 'medium',
    detectedSignals: signalCoverage,
    missingSignals,
  };
};

export const evaluateAnswer = (question: string, answer: string, context?: AnswerEvaluationContext) => {
  // Detect empty / skipped answers immediately — no AI call needed
  const trimmed = answer.trim();
  const isSkipped =
    !trimmed ||
    trimmed === '(no answer)' ||
    trimmed.length < 10 ||
    /^\(?(no answer|skipped?|n\/a|nothing|none)\)?$/i.test(trimmed);

  if (isSkipped) {
    const idealAnswer = buildIdealAnswerFallback(question, context);
    return Promise.resolve<AnswerEvaluation>({
      score: 0,
      feedback: 'No answer was provided. Correct coverage: none. Missing: all expected concepts for this question. Improve by giving a structured answer with a direct explanation, one project or practical example, and the key trade-offs; review the ideal answer below.',
      idealAnswer,
      samplePerfectAnswer: idealAnswer,
      conceptsCovered: [],
      missingConcepts: context?.expectedSignals?.length ? context.expectedSignals : ['No answer was provided'],
      incorrectStatements: [],
      wrongTerminology: [],
      technicalMistakes: [],
      dynamicFeedback: {
        strengths: [],
        missingConcepts: context?.expectedSignals?.length ? context.expectedSignals : ['No answer was provided'],
        technicalMistakes: [],
        communication: 'No communication could be evaluated because no answer was provided.',
        confidence: 'No confidence could be evaluated because no answer was provided.',
        areasToImprove: ['Concept to improve: the full question topic. Answer with a direct explanation, one relevant example, and the expected signals.'],
        nextLearningSuggestions: ['Review the sample perfect answer and practice a 60-90 second response aloud.'],
        practicalUnderstanding: 'No practical understanding was demonstrated.',
        interviewReadiness: 'Not interview-ready for this question until a substantive answer is provided.',
      },
      communicationScore: 0,
      technicalScore: 0,
      behavioralScore: 0,
      confidenceScore: 0,
      completenessScore: 0,
      depthScore: 0,
      terminologyScore: 0,
      grammarScore: 0,
      vocabularyScore: 0,
      domainScore: 0,
      nextAction: 'reduce_difficulty',
      suggestedDifficulty: 'easy',
      detectedSignals: [],
      missingSignals: ['No answer was provided'],
    });
  }

  return generateJson<AnswerEvaluation>(
    `You are a strict, professional interview evaluator and answer-comparison engine. Generate a fresh internal ideal answer, compare it to the candidate's answer, and evaluate the answer.

QUESTION: ${question}
ROLE: ${context?.roleDomain ?? 'Not specified'} ${context?.roleLevel ?? ''}
TARGET COMPANY: ${context?.targetCompany ?? 'Not specified'}
DIFFICULTY: ${context?.difficulty ?? 'Not specified'}
QUESTION TYPE: ${context?.questionType ?? 'Not specified'}
TOPIC: ${context?.topic ?? 'Not specified'}
EXPECTED SIGNALS:
${JSON.stringify(context?.expectedSignals ?? [], null, 2)}

CANDIDATE ANSWER: ${answer}
DETECTED ANSWER TURN TYPE: ${classifyAnswerTurn(answer)}

IDEAL ANSWER REQUIREMENTS:
- First classify the turn: answered_well, answered_weakly, clarification_request, or deflected.
- If clarification_request: the ideal answer must model asking for clarification briefly AND then answering once clarified. Do not ignore the confusion.
- If deflected: the ideal answer should acknowledge the gap honestly and outline what a prepared answer would cover.
- Keep idealAnswer and samplePerfectAnswer as detailed, paragraph-length responses tailored to this specific question. Do not shorten them into brief snippets.
- Avoid generic filler such as "fast-paced environment", "aligns with my career goals", or "eager to apply my skills" unless the question is explicitly about motivation.
- The samplePerfectAnswer must NOT personalize to the candidate and must NOT copy candidate wording.
- Compare ideal answer vs candidate answer.
- Feedback must clearly state: what was correct, what was missing, which concept to improve, and what an ideal answer should include.

SCORING RULES (be strict and honest — do NOT inflate scores):
- Score 0–20  → No meaningful answer, completely off-topic, or just a few words
- Score 21–40 → Very vague, generic, no specific examples or evidence
- Score 41–60 → Partially addresses the question but lacks depth, specifics, or structure
- Score 61–80 → Good answer with relevant examples, clear structure, some depth
- Score 81–100 → Excellent: specific, structured (STAR/situation-action-result), insightful, with measurable outcomes

IMPORTANT:
- If the answer is very short (under 2 sentences), the maximum score is 30
- If the answer contains no specific examples or evidence, cap at 50
- If the answer is a filler phrase, meaningless text, or off-topic, score it 0–15
- Do NOT give high scores to vague answers — be honest even if it means scoring 10 or 20
- Base the score on actual comparison to the ideal answer: technical correctness, completeness, communication, confidence, logical flow, examples, missing concepts, and practical understanding
- The communicationScore reflects clarity and structure of expression
- The technicalScore reflects relevance of technical knowledge shown (0 if non-technical question)
- The behavioralScore reflects self-awareness, teamwork, and professional maturity shown
- confidenceScore reflects how certain and composed the candidate sounded based on wording, hedging, and answer control
- completenessScore reflects whether all parts of the question were answered
- depthScore reflects technical/behavioral depth beyond definitions
- terminologyScore reflects accurate use of role-specific technical language
- grammarScore and vocabularyScore reflect spoken English clarity without penalizing accent
- domainScore reflects job/domain expertise shown
- nextAction decides the next interviewer move:
  * ask_deeper = strong answer, continue same topic at higher depth
  * clarify = answer is partial or ambiguous, ask a clarifying follow-up
  * move_topic = adequate answer, coverage should move to a different JD topic
  * challenge = strong answer, ask scenario/problem-solving
  * reduce_difficulty = weak answer, ask an easier confidence-building continuation

Return ONLY a JSON object:
{
  "score": number (0-100, strict),
  "feedback": string (2-4 dynamic sentences comparing candidate answer against the ideal answer; explicitly mention what was correct, what was missing, what concept to improve, and what the ideal answer should include),
  "idealAnswer": string (internal ideal answer used for comparison),
  "samplePerfectAnswer": string (professionally written perfect answer for the candidate to learn from; generic, not personalized),
  "conceptsCovered": string[],
  "missingConcepts": string[],
  "incorrectStatements": string[],
  "wrongTerminology": string[],
  "technicalMistakes": string[],
  "dynamicFeedback": {
    "strengths": string[],
    "missingConcepts": string[],
    "technicalMistakes": string[],
    "communication": string,
    "confidence": string,
    "areasToImprove": string[],
    "nextLearningSuggestions": string[],
    "practicalUnderstanding": string,
    "interviewReadiness": string
  },
  "communicationScore": number (0-100),
  "technicalScore": number (0-100),
  "behavioralScore": number (0-100),
  "confidenceScore": number (0-100),
  "completenessScore": number (0-100),
  "depthScore": number (0-100),
  "terminologyScore": number (0-100),
  "grammarScore": number (0-100),
  "vocabularyScore": number (0-100),
  "domainScore": number (0-100),
  "nextAction": "ask_deeper" | "clarify" | "move_topic" | "challenge" | "reduce_difficulty",
  "suggestedDifficulty": "easy" | "easy-medium" | "medium" | "medium-hard" | "scenario" | "problem-solving" | "behavioral",
  "detectedSignals": string[],
  "missingSignals": string[]
}`,
    fallbackComparisonEvaluation(question, answer, context),
  );
};

const DIFFICULTY_ORDER: NonNullable<GeneratedQuestion['difficulty']>[] = [
  'easy',
  'easy-medium',
  'medium',
  'medium-hard',
  'scenario',
  'problem-solving',
  'behavioral',
];

const clampDifficultyIndex = (index: number) => Math.max(0, Math.min(DIFFICULTY_ORDER.length - 1, index));

const nextDifficulty = (
  current: GeneratedQuestion['difficulty'],
  evaluation: AnswerEvaluation,
  position: number,
  total: number,
): NonNullable<GeneratedQuestion['difficulty']> => {
  const currentIndex = current ? DIFFICULTY_ORDER.indexOf(current) : DIFFICULTY_ORDER.indexOf(difficultyForPosition(position, total));
  const safeIndex = currentIndex >= 0 ? currentIndex : 0;

  if (evaluation.nextAction === 'reduce_difficulty' || evaluation.score < 40) {
    return DIFFICULTY_ORDER[clampDifficultyIndex(safeIndex - 1)];
  }
  if (evaluation.nextAction === 'clarify' || evaluation.score < 60) {
    return DIFFICULTY_ORDER[clampDifficultyIndex(safeIndex)];
  }
  if (evaluation.nextAction === 'challenge' || evaluation.score >= 85) {
    return DIFFICULTY_ORDER[clampDifficultyIndex(safeIndex + 2)];
  }
  if (evaluation.nextAction === 'ask_deeper' || evaluation.score >= 70) {
    return DIFFICULTY_ORDER[clampDifficultyIndex(safeIndex + 1)];
  }
  return DIFFICULTY_ORDER[clampDifficultyIndex(Math.max(safeIndex, DIFFICULTY_ORDER.indexOf(difficultyForPosition(position, total))))];
};

const firstMeaningfulGap = (evaluation: AnswerEvaluation) =>
  [
    ...(evaluation.missingConcepts ?? []),
    ...(evaluation.missingSignals ?? []),
    ...(evaluation.dynamicFeedback?.missingConcepts ?? []),
    ...(evaluation.technicalMistakes ?? []),
  ]
    .map((item) => canonicalize(item))
    .find((item) => item && !/no clear gap|not available|none/i.test(item)) ?? 'the missing part of the answer';

export const decideAdaptiveFollowUp = ({
  evaluation,
  lastQuestion,
  position,
  total,
}: {
  evaluation: AnswerEvaluation;
  lastQuestion?: GeneratedQuestion;
  position: number;
  total: number;
}): AdaptiveFollowUpDecision => {
  const score = evaluation.score ?? 0;
  const focus = firstMeaningfulGap(evaluation);
  const targetDifficulty = nextDifficulty(lastQuestion?.difficulty, evaluation, position, total);
  const incomplete =
    evaluation.nextAction === 'clarify' ||
    (evaluation.completenessScore ?? 100) < 65 ||
    Boolean((evaluation.missingConcepts?.length ?? 0) || (evaluation.missingSignals?.length ?? 0));

  if (evaluation.nextAction === 'reduce_difficulty' || score < 40) {
    return {
      action: 'reduce_difficulty',
      focus,
      reason: 'Weak answer: ask an easier clarifying question that rebuilds confidence.',
      targetDifficulty,
      followUpIntent: 'recover-confidence',
    };
  }

  if (incomplete && score < 75) {
    return {
      action: 'clarify',
      focus,
      reason: 'Incomplete answer: target the missing concept before moving on.',
      targetDifficulty,
      followUpIntent: 'clarify',
    };
  }

  if (evaluation.nextAction === 'challenge' || score >= 85) {
    return {
      action: 'challenge',
      focus: lastQuestion?.topic || focus,
      reason: 'Strong answer: increase depth with a technical challenge.',
      targetDifficulty,
      followUpIntent: 'challenge',
    };
  }

  if (evaluation.nextAction === 'ask_deeper' || score >= 70) {
    return {
      action: 'ask_deeper',
      focus: lastQuestion?.topic || focus,
      reason: 'Strong answer: ask a deeper follow-up on the same topic.',
      targetDifficulty,
      followUpIntent: 'deepen',
    };
  }

  return {
    action: 'move_topic',
    focus,
    reason: 'Adequate answer: continue coverage with the next planned topic.',
    targetDifficulty,
    followUpIntent: 'bridge-topic',
  };
};

const topicCoverage = (transcript: AdaptiveQuestionContext['transcript']) => {
  const coverage = new Map<string, { asked: number; averageScore: number }>();
  transcript.forEach((item) => {
    const topic = canonicalize(item.topic || item.resumeReference || 'general');
    const existing = coverage.get(topic) ?? { asked: 0, averageScore: 0 };
    const nextAsked = existing.asked + 1;
    coverage.set(topic, {
      asked: nextAsked,
      averageScore: Math.round(((existing.averageScore * existing.asked) + (item.score ?? 0)) / nextAsked),
    });
  });
  return coverage;
};

const sameCoverageTopic = (left?: string, right?: string) => {
  const a = canonicalize(left ?? '').toLowerCase();
  const b = canonicalize(right ?? '').toLowerCase();
  return Boolean(a && b && (a === b || a.includes(b) || b.includes(a)));
};

const sectionForTopic = (context: AdaptiveQuestionContext, topic?: string) =>
  context.interviewRoadmap?.sections.find((section) =>
    section.topics.some((sectionTopic) => sameCoverageTopic(topic, sectionTopic)),
  );

const projectForTopic = (context: AdaptiveQuestionContext, topic?: string) =>
  context.interviewRoadmap?.resumeProfile.projects.find((project) => sameCoverageTopic(topic, project));

const topicAskCount = (context: AdaptiveQuestionContext, topic?: string) =>
  context.transcript.filter((item) => sameCoverageTopic(item.topic || item.resumeReference, topic)).length;

const consecutiveTopicCount = (context: AdaptiveQuestionContext, topic?: string) => {
  let count = 0;
  for (let index = context.transcript.length - 1; index >= 0; index -= 1) {
    const item = context.transcript[index];
    if (!sameCoverageTopic(item.topic || item.resumeReference, topic)) break;
    count += 1;
  }
  return count;
};

const isTopicExhausted = (context: AdaptiveQuestionContext, topic?: string) => {
  const project = projectForTopic(context, topic);
  const projectLimit = context.interviewRoadmap?.projectQuestionLimit ?? 3;
  const followUpLimit = context.interviewRoadmap?.followUpLimit ?? 2;
  if (project && topicAskCount(context, project) >= projectLimit) return true;
  return consecutiveTopicCount(context, topic) > followUpLimit;
};

const roadmapTopicsInOrder = (context: AdaptiveQuestionContext) =>
  unique((context.interviewRoadmap?.sections ?? []).flatMap((section) => section.topics));

const chooseCoverageTopic = (context: AdaptiveQuestionContext) => {
  const modeGuidance = getInterviewModeGuidance(context.interviewMode);
  const jdTopics = unique([
    ...roadmapTopicsInOrder(context),
    ...modeGuidance.questionAngles,
    ...(context.jdProfile?.requiredSkills ?? []),
    ...(context.jdProfile?.toolsTechnologies ?? []),
    ...(context.jdProfile?.domainKnowledge ?? []),
    ...(context.resumeSkills ?? []),
    context.roleDomain,
  ]).filter(Boolean);
  const coverage = topicCoverage(context.transcript);
  const lastSection = sectionForTopic(context, context.lastQuestion.topic || context.lastQuestion.resumeReference);
  const nextRoadmapTopic = context.interviewRoadmap?.sections
    .filter((section) => section.key !== lastSection?.key || isTopicExhausted(context, context.lastQuestion.topic))
    .flatMap((section) => section.topics)
    .find((topic) => !coverage.has(topic) && !isTopicExhausted(context, topic));

  return (
    nextRoadmapTopic ??
    jdTopics.find((topic) => !coverage.has(topic)) ??
    jdTopics
      .filter((topic) => !isTopicExhausted(context, topic))
      .sort((a, b) => (coverage.get(a)?.asked ?? 0) - (coverage.get(b)?.asked ?? 0))[0] ??
    context.lastQuestion.topic ??
    context.roleDomain
  );
};

const buildNaturalFallbackQuestion = (
  context: AdaptiveQuestionContext,
  action: NonNullable<AnswerEvaluation['nextAction']>,
  topic: string,
  focus: string,
  difficulty: NonNullable<GeneratedQuestion['difficulty']>,
): GeneratedQuestion => {
  const modeGuidance = getInterviewModeGuidance(context.interviewMode);
  const projectName = context.resumeProfile?.projects?.[0] ?? 'one of your projects';
  const isHrMode = context.interviewMode === 'hr_behavioral';
  const questionType: GeneratedQuestion['questionType'] =
    isHrMode || difficulty === 'behavioral'
      ? 'behavioural'
      : difficulty === 'scenario' || difficulty === 'problem-solving'
      ? 'situational'
      : 'technical';

  const question =
    action === 'reduce_difficulty'
      ? `Can you walk me through ${focus} in simpler terms, maybe using ${projectName} as an example?`
      : action === 'clarify'
      ? `You brought up ${topic}, but I'd like more detail on ${focus}. Can you give me a concrete example?`
      : action === 'challenge' || difficulty === 'scenario'
      ? `Suppose ${topic} fails under load in production. How would you diagnose it, and what trade-offs would you weigh?`
      : difficulty === 'problem-solving'
      ? `For a ${modeGuidance.label} scenario involving ${topic}, outline your approach, edge cases, and complexity.`
      : difficulty === 'behavioral' || isHrMode
      ? `Tell me about a time you had to make a tough call related to ${topic}. What was the situation, your action, and the result?`
      : `Walk me through how you applied ${focus} while working on ${projectName}. What problem were you solving, what did you do, and what was the outcome?`;

  return {
    question,
    expectedSignals:
      questionType === 'behavioural'
        ? ['STAR structure', 'specific role and action', 'outcome and reflection']
        : ['accurate concept explanation', 'practical example', 'trade-offs or edge cases'],
    questionType,
    resumeReference: `Follow-up on: ${topic}`,
    difficulty,
    topic,
    followUpIntent:
      action === 'reduce_difficulty'
        ? 'recover-confidence'
        : action === 'move_topic'
        ? 'bridge-topic'
        : action === 'ask_deeper'
        ? 'deepen'
        : 'clarify',
  };
};

const fallbackAdaptiveQuestion = (context: AdaptiveQuestionContext): GeneratedQuestion => {
  const sameTopic = context.lastQuestion.topic || context.lastQuestion.resumeReference || context.roleDomain;
  const exhausted = isTopicExhausted(context, sameTopic);
  const decision = context.followUpDecision ?? decideAdaptiveFollowUp({
    evaluation: context.lastEvaluation,
    lastQuestion: context.lastQuestion,
    position: context.currentQuestionIndex + 1,
    total: context.targetQuestionCount,
  });
  const action = exhausted ? 'move_topic' : decision.action;
  const difficulty = decision.targetDifficulty;
  const coverageTopic = chooseCoverageTopic(context);
  const topic =
    action === 'ask_deeper' || action === 'clarify' || action === 'challenge' || action === 'reduce_difficulty'
      ? sameTopic
      : coverageTopic;

  return buildNaturalFallbackQuestion(context, action, topic, decision.focus, difficulty);
};

const mergeInterviewerReply = (turn: AdaptiveTurnResponse) => {
  if (turn.candidateMessageIntent !== 'question_to_interviewer' || !turn.interviewerReply?.trim()) {
    return turn.question;
  }

  const reply = turn.interviewerReply.trim();
  const nextQuestion = turn.question.question.trim();
  const combined = nextQuestion ? `${reply} ${nextQuestion}` : reply;

  return {
    ...turn.question,
    question: combined,
  };
};

export const generateAdaptiveInterviewQuestion = async (
  context: AdaptiveQuestionContext,
): Promise<AdaptiveTurnResponse> => {
  const difficulty = nextDifficulty(
    context.lastQuestion.difficulty,
    context.lastEvaluation,
    context.currentQuestionIndex + 1,
    context.targetQuestionCount,
  );
  const fallbackQuestion = fallbackAdaptiveQuestion(context);
  const fallbackTurn: AdaptiveTurnResponse = {
    candidateMessageIntent: 'answer',
    interviewerReply: null,
    question: fallbackQuestion,
  };

  const jdProfile =
    context.jdProfile ??
    buildJobDescriptionProfile(context.jobDescription, {
      roleLevel: context.roleLevel,
      roleDomain: context.roleDomain,
      resumeSkills: context.resumeSkills,
    });
  const { questions: companyQuestionBank, mode: companyBankMode } = resolveCompanyQuestionBank(context);
  const systemPrompt = buildInterviewSystemPrompt(
    buildPromptBuilderInput(context, jdProfile, companyQuestionBank, companyBankMode),
  );

  const conversationHistory: ConversationTurn[] = context.transcript.map((item) => ({
    question: item.question,
    answer: item.answer,
    score: item.score,
    topic: item.topic,
    questionType: item.questionType,
  }));

  const userPrompt = buildAdaptiveTurnUserPrompt({
    conversationHistory,
    candidateMessage: context.lastAnswer,
    lastEvaluation: {
      score: context.lastEvaluation.score,
      nextAction: context.lastEvaluation.nextAction,
      missingConcepts: context.lastEvaluation.missingConcepts,
      conceptsCovered: context.lastEvaluation.conceptsCovered,
      feedback: context.lastEvaluation.feedback,
    },
    followUpDecision: context.followUpDecision,
    previousQuestionTopics: context.previousQuestions.map((item) => item.topic ?? item.resumeReference ?? '').filter(Boolean),
    targetDifficulty: difficulty,
    questionsRemaining: Math.max(0, context.targetQuestionCount - context.currentQuestionIndex - 1),
  });

  return generateJson<AdaptiveTurnResponse>(userPrompt, fallbackTurn, { systemPrompt })
    .then((result) => {
      const candidate = {
        ...fallbackTurn,
        ...result,
        question: {
          ...fallbackQuestion,
          ...result.question,
          expectedSignals: result.question?.expectedSignals?.length
            ? result.question.expectedSignals
            : fallbackQuestion.expectedSignals,
        },
      };

      const normalizedCandidate = canonicalize(candidate.question.question).toLowerCase().replace(/[?.!]+$/g, '');
      const repeatedQuestion = context.previousQuestions.some(
        (item) => canonicalize(item.question).toLowerCase().replace(/[?.!]+$/g, '') === normalizedCandidate,
      );
      const exhaustedTopic = candidate.question.topic !== fallbackQuestion.topic && isTopicExhausted(context, candidate.question.topic);

      if (repeatedQuestion || exhaustedTopic) {
        const alternate = fallbackAdaptiveQuestion({
          ...context,
          followUpDecision: {
            ...(context.followUpDecision ?? decideAdaptiveFollowUp({
              evaluation: context.lastEvaluation,
              lastQuestion: context.lastQuestion,
              position: context.currentQuestionIndex + 1,
              total: context.targetQuestionCount,
            })),
            action: 'move_topic',
          },
        });
        const alternateRepeated = context.previousQuestions.some((item) =>
          isNearDuplicateQuestion(item.question, alternate.question),
        );
        return alternateRepeated ? fallbackTurn : { ...fallbackTurn, question: alternate };
      }

      const mergedQuestion = mergeInterviewerReply(candidate);
      return {
        ...candidate,
        question: {
          ...mergedQuestion,
          questionType: inferQuestionTypeFromContent(
            mergedQuestion.question,
            context.interviewMode,
            mergedQuestion.questionType,
          ),
        },
      };
    });
};

export type WritingEvaluation = {
  score: number;
  feedback: string;
  strengths: string[];
  improvements: string[];
  grammarScore: number;
  vocabularyScore: number;
  coherenceScore: number;
  taskAchievementScore: number;
};

export const evaluateWriting = (prompt: string, level: string, criteria: string, userText: string) =>
  generateJson<WritingEvaluation>(
    `You are an English language writing examiner. Evaluate the following student writing response.

CEFR Level: ${level}
Task prompt: ${prompt}
Evaluation criteria: ${criteria}
Student response: ${userText}

Return a JSON object with:
- score (0-100 overall)
- feedback (2-3 sentences of actionable feedback)
- strengths (array of 2 specific strengths)
- improvements (array of 2 specific improvements)
- grammarScore (0-100)
- vocabularyScore (0-100)
- coherenceScore (0-100)
- taskAchievementScore (0-100)

Be fair but honest. A short or off-topic response should score low. A well-structured, appropriate response should score high.`,
    {
      score: Math.min(80, Math.max(30, Math.round(userText.split(/\s+/).length * 1.5))),
      feedback: 'Your response shows effort. Focus on organising your ideas clearly and using vocabulary appropriate for your level.',
      strengths: ['Shows an attempt to address the prompt', 'Uses basic sentence structures'],
      improvements: ['Develop your ideas with more specific details', 'Check grammar and punctuation carefully'],
      grammarScore: 60,
      vocabularyScore: 60,
      coherenceScore: 55,
      taskAchievementScore: 60,
    },
  );

export const generateReport = (
  transcript: Array<{
    question: string;
    answer?: string;
    feedback?: string;
    score?: number;
    questionType?: string;
    resumeReference?: string;
    difficulty?: string;
    topic?: string;
    idealAnswer?: string;
    samplePerfectAnswer?: string;
    conceptsCovered?: string[];
    missingConcepts?: string[];
    incorrectStatements?: string[];
    wrongTerminology?: string[];
    technicalMistakes?: string[];
    dynamicFeedback?: AnswerEvaluation['dynamicFeedback'];
  }>,
  reportContext: ReportGenerationContext = {},
) => {
  // Pre-compute honest per-question scores for skipped/empty answers
  const answeredCount = transcript.filter(t => {
    const a = (t.answer ?? '').trim();
    return a && a !== '(no answer)' && a.length >= 10 && !/^\(?(no answer|skipped?|n\/a|nothing|none)\)?$/i.test(a);
  }).length;
  const totalCount = transcript.length;
  const participationRatio = totalCount > 0 ? answeredCount / totalCount : 0;

  // If participation is zero or near-zero, return a real zero-score report immediately
  if (participationRatio === 0) {
    return Promise.resolve<InterviewReport>({
      communicationScore: 0,
      technicalScore: 0,
      behavioralScore: 0,
      confidenceScore: 0,
      grammarScore: 0,
      vocabularyScore: 0,
      domainExpertiseScore: 0,
      overallScore: 0,
      strengths: [],
      improvements: [
        'No answers were provided during the interview.',
        'The candidate did not respond to any of the questions.',
        'A complete re-attempt of the interview is recommended.',
      ],
      recommendations: [
        'Attempt the interview again and answer each question.',
        'Prepare for each question type before starting.',
        'Use the STAR method for behavioral questions.',
      ],
      transcriptSummary: 'The candidate did not answer any interview questions. No performance could be evaluated.',
      skillWiseStrengths: [],
      areasForImprovement: ['Answer each question with a complete, role-relevant response.'],
      missedConcepts: transcript.map((t) => t.topic || t.resumeReference || t.question).filter(Boolean),
      recommendedLearningResources: [
        'Practice role fundamentals from the job description.',
        'Prepare project walkthroughs using the STAR method.',
        'Record short spoken answers and review clarity, structure, and terminology.',
      ],
      difficultyProgression: transcript.map((t) => t.difficulty ?? 'unknown'),
      questionTimeline: transcript.map((t) => ({
        question: t.question,
        topic: t.topic ?? t.resumeReference ?? 'general',
        difficulty: t.difficulty ?? 'unknown',
        score: 0,
      })),
      followUpQuality: 'No follow-up quality could be assessed because no answers were provided.',
      hiringRecommendation: 'No Hire',
      hiringRecommendationReason: 'The candidate did not provide enough evidence to evaluate readiness.',
      questionAnalysis: transcript.map(t => ({
        question: t.question,
        answer: t.answer ?? '(no answer)',
        score: 0,
        feedback: 'No answer was provided for this question.',
        whatWorked: 'Nothing — no answer was given.',
        whatToImprove: 'Provide a substantive answer addressing the question directly.',
        questionType: t.questionType ?? 'general',
        resumeReference: t.resumeReference ?? 'general',
        idealAnswer: t.idealAnswer,
        samplePerfectAnswer: t.samplePerfectAnswer,
        conceptsCovered: [],
        missingConcepts: t.missingConcepts ?? [t.topic ?? t.resumeReference ?? 'Expected answer content'],
        incorrectStatements: [],
        wrongTerminology: [],
        technicalMistakes: [],
        dynamicFeedback: t.dynamicFeedback,
      })),
    });
  }

  // For the per-question scores already computed by evaluateAnswer, use them as ground truth
  const precomputedAvg = transcript.reduce((sum, t) => sum + (t.score ?? 0), 0) / Math.max(1, totalCount);
  const difficultyProgression = buildDifficultyProgressionSummary(transcript);
  const questionTimeline = transcript.map((t) => ({
    question: t.question,
    topic: t.topic ?? t.resumeReference ?? 'general',
    difficulty: t.difficulty ?? 'unknown',
    score: t.score ?? 0,
  }));
  const speakerLabel = reportContext.speakerName || reportContext.accountOwnerName || 'The candidate';

  return generateJson<InterviewReport>(
    `You are a strict, professional interview panel evaluator. Generate an honest performance report from this Q&A transcript.

CANDIDATE FOR FEEDBACK: ${speakerLabel}
ACCOUNT OWNER (login profile): ${reportContext.accountOwnerName ?? 'Not specified'}
Use the candidate name above in summary/feedback when referring to the person who spoke. Do not substitute the account owner name if a distinct candidate name is provided.

TRANSCRIPT:
${JSON.stringify(transcript, null, 2)}

STRICT EVALUATION RULES:
1. Answers that are empty, "(no answer)", very short (under 2 sentences), or completely vague must be scored 0–20
2. Do NOT inflate scores — if the candidate gave weak answers, the overall score must reflect that honestly
3. The overallScore must be the weighted average of the per-question scores — do NOT invent a higher number
4. ${answeredCount} out of ${totalCount} questions were answered. This participation rate (${Math.round(participationRatio * 100)}%) must factor into all scores
5. If fewer than half the questions were answered, no score category should exceed 50
6. Pre-computed average per-question score: ${Math.round(precomputedAvg)} — your overallScore should be close to this
7. Strengths must NEVER be empty or a placeholder. Even for low scores, include at least 2 honest positives (effort, partial correctness, clarification requests, persistence).
8. Reference actual answer content in all feedback — do NOT fabricate content the candidate did not say
9. Preserve each transcript item's idealAnswer, samplePerfectAnswer, conceptsCovered, missingConcepts, incorrectStatements, wrongTerminology, technicalMistakes, and dynamicFeedback when present
10. Question-level feedback must be dynamic and based on the answer comparison, not a repeated template
11. idealAnswer and samplePerfectAnswer must stay detailed and paragraph-length, tailored to the specific question, and must match whether the candidate answered, asked for clarification, or deflected
12. difficultyProgression must contain one entry per transcript question (${totalCount} entries), not a fixed 3-item template
13. Do not add extra per-question fields such as additionalEvaluatorNotes

Return ONLY this exact JSON structure (no markdown):
{
  "communicationScore": number (0-100, strict),
  "technicalScore": number (0-100, strict),
  "behavioralScore": number (0-100, strict),
  "confidenceScore": number (0-100, strict),
  "grammarScore": number (0-100, strict),
  "vocabularyScore": number (0-100, strict),
  "domainExpertiseScore": number (0-100, strict),
  "overallScore": number (0-100, strict — must reflect actual answer quality),
  "strengths": string[] (only include real strengths evidenced in the answers — empty array if none),
  "improvements": string[] (3-5 specific, honest improvement areas based on what was missing),
  "recommendations": string[] (3-5 concrete, actionable next steps),
  "transcriptSummary": string (honest 2-3 sentence summary of actual performance),
  "skillWiseStrengths": [{ "skill": string, "evidence": string, "score": number }],
  "areasForImprovement": string[],
  "missedConcepts": string[],
  "recommendedLearningResources": string[],
  "difficultyProgression": string[],
  "questionTimeline": [{ "question": string, "topic": string, "difficulty": string, "score": number }],
  "followUpQuality": string,
  "hiringRecommendation": "Strong Hire" | "Hire" | "Borderline" | "No Hire",
  "hiringRecommendationReason": string,
  "questionAnalysis": [
    {
      "question": string,
      "answer": string (exact answer given, or "(no answer)"),
      "score": number (0-100, strict),
      "feedback": string (honest 2-3 sentences referencing actual answer content),
      "whatWorked": string (what specifically was good, or "Nothing — no answer was provided"),
      "whatToImprove": string (specific gap or "Provide a substantive answer"),
      "questionType": string,
      "resumeReference": string,
      "idealAnswer": string,
      "samplePerfectAnswer": string,
      "conceptsCovered": string[],
      "missingConcepts": string[],
      "incorrectStatements": string[],
      "wrongTerminology": string[],
      "technicalMistakes": string[],
      "dynamicFeedback": {
        "strengths": string[],
        "missingConcepts": string[],
        "technicalMistakes": string[],
        "communication": string,
        "confidence": string,
        "areasToImprove": string[],
        "nextLearningSuggestions": string[],
        "practicalUnderstanding": string,
        "interviewReadiness": string
      }
    }
  ]
}`,
    {
      communicationScore: Math.round(precomputedAvg * 0.9),
      technicalScore: Math.round(precomputedAvg * 0.9),
      behavioralScore: Math.round(precomputedAvg * 0.9),
      confidenceScore: Math.round(precomputedAvg * 0.85),
      grammarScore: Math.round(precomputedAvg * 0.9),
      vocabularyScore: Math.round(precomputedAvg * 0.9),
      domainExpertiseScore: Math.round(precomputedAvg * 0.9),
      overallScore: Math.round(precomputedAvg),
      strengths: answeredCount > 0 ? ['Some questions were attempted'] : [],
      improvements: ['Provide specific, structured answers to each question', 'Use the STAR method for behavioral questions'],
      recommendations: ['Practice answering interview questions aloud', 'Prepare concrete examples from past experience'],
      transcriptSummary: `The candidate answered ${answeredCount} of ${totalCount} questions with an average score of ${Math.round(precomputedAvg)}.`,
      skillWiseStrengths: transcript
        .filter((t) => (t.score ?? 0) >= 65)
        .slice(0, 5)
        .map((t) => ({
          skill: t.topic ?? t.resumeReference ?? 'general',
          evidence: t.feedback ?? 'Relevant answer content was provided.',
          score: t.score ?? 0,
        })),
      areasForImprovement: ['Add more concrete examples', 'Explain trade-offs and edge cases', 'Structure behavioral responses with STAR'],
      missedConcepts: transcript.filter((t) => (t.score ?? 0) < 60).map((t) => t.topic ?? t.resumeReference ?? t.question).slice(0, 8),
      recommendedLearningResources: ['Review the job description skill list', 'Practice project deep-dives aloud', 'Prepare concise STAR stories'],
      difficultyProgression,
      questionTimeline,
      followUpQuality: 'Follow-up quality is inferred from the adaptive question sequence and answer depth.',
      hiringRecommendation:
        precomputedAvg >= 85 ? 'Strong Hire' : precomputedAvg >= 70 ? 'Hire' : precomputedAvg >= 50 ? 'Borderline' : 'No Hire',
      hiringRecommendationReason: `Recommendation is based on the average evaluated score of ${Math.round(precomputedAvg)} and ${answeredCount}/${totalCount} answered questions.`,
      questionAnalysis: transcript.map(t => ({
        question: t.question,
        answer: t.answer ?? '(no answer)',
        score: t.score ?? 0,
        feedback: t.feedback ?? 'No answer was provided.',
        whatWorked: t.dynamicFeedback?.strengths?.[0] ?? (t.score && t.score > 40 ? 'Some relevant content was provided' : 'Nothing — no meaningful answer was given.'),
        whatToImprove: t.dynamicFeedback?.areasToImprove?.[0] ?? 'Provide a complete, structured answer with specific examples.',
        questionType: t.questionType ?? 'general',
        resumeReference: t.resumeReference ?? 'general',
        idealAnswer: t.idealAnswer,
        samplePerfectAnswer: t.samplePerfectAnswer,
        conceptsCovered: t.conceptsCovered ?? [],
        missingConcepts: t.missingConcepts ?? [],
        incorrectStatements: t.incorrectStatements ?? [],
        wrongTerminology: t.wrongTerminology ?? [],
        technicalMistakes: t.technicalMistakes ?? [],
        dynamicFeedback: t.dynamicFeedback,
      })),
    },
  ).then((report) => {
    const analysis = report.questionAnalysis?.length ? report.questionAnalysis : [];
    const questionAnalysis = transcript.map((item, index) => {
      const merged = {
        ...(analysis[index] ?? {
          question: item.question,
          answer: item.answer ?? '(no answer)',
          score: item.score ?? 0,
          feedback: item.feedback ?? 'No answer was provided.',
          whatWorked: item.dynamicFeedback?.strengths?.[0] ?? 'No specific strength recorded.',
          whatToImprove: item.dynamicFeedback?.areasToImprove?.[0] ?? 'Provide a complete, structured answer with specific examples.',
          questionType: item.questionType ?? 'general',
          resumeReference: item.resumeReference ?? 'general',
        }),
        idealAnswer: item.idealAnswer ?? analysis[index]?.idealAnswer,
        samplePerfectAnswer: item.samplePerfectAnswer ?? analysis[index]?.samplePerfectAnswer ?? item.idealAnswer,
        conceptsCovered: item.conceptsCovered ?? analysis[index]?.conceptsCovered ?? [],
        missingConcepts: item.missingConcepts ?? analysis[index]?.missingConcepts ?? [],
        incorrectStatements: item.incorrectStatements ?? analysis[index]?.incorrectStatements ?? [],
        wrongTerminology: item.wrongTerminology ?? analysis[index]?.wrongTerminology ?? [],
        technicalMistakes: item.technicalMistakes ?? analysis[index]?.technicalMistakes ?? [],
        dynamicFeedback: item.dynamicFeedback ?? analysis[index]?.dynamicFeedback,
      };

      return {
        ...merged,
        questionType: inferQuestionTypeFromContent(
          item.question,
          reportContext.interviewMode,
          merged.questionType,
        ),
      };
    });

    const strengths = aggregateSessionStrengths(
      transcript,
      questionAnalysis.map((item) => item.whatWorked),
    );
    const companyReadinessScore = computeCompanyReadinessScore(transcript, {
      targetCompany: reportContext.targetCompany,
      overallScore: Math.round(precomputedAvg),
    });
    if (
      process.env.NODE_ENV !== 'production' &&
      reportContext.targetCompany &&
      companyReadinessScore === Math.round(precomputedAvg)
    ) {
      console.warn(
        '[report] companyReadinessScore equals overallScore — verify company-specific evidence was captured.',
        { overallScore: Math.round(precomputedAvg), companyReadinessScore, targetCompany: reportContext.targetCompany },
      );
    }

    return {
      ...report,
      overallScore: Math.round(precomputedAvg),
      strengths: report.strengths?.length
        ? [...new Set([...report.strengths, ...strengths])].slice(0, 4)
        : strengths,
      difficultyProgression,
      questionTimeline,
      companyReadinessScore,
      speakerName: reportContext.speakerName,
      accountOwnerName: reportContext.accountOwnerName,
      questionAnalysis,
    };
  });
};

export const analyzeResume = (resumeText: string) =>
  generateJson<ResumeAnalysis>(
    `You are a senior technical recruiter and resume analyst. Perform a COMPLETE, EXHAUSTIVE analysis of the following resume.

RESUME TEXT (full document):
---
${resumeText}
---

YOUR TASK — read every line and extract ALL of the following:

1. SKILLS — list EVERY technical and professional skill mentioned anywhere in the resume:
   - Programming languages (e.g. Python, Java, TypeScript, C++, Go, Rust)
   - Frameworks & libraries (e.g. React, Node.js, Spring Boot, Django, TensorFlow)
   - Databases (e.g. PostgreSQL, MongoDB, Redis, MySQL, Cassandra)
   - Cloud & DevOps (e.g. AWS, GCP, Azure, Docker, Kubernetes, CI/CD, Terraform)
   - Tools (e.g. Git, Jira, Figma, Postman, VS Code)
   - Methodologies (e.g. Agile, Scrum, TDD, REST, GraphQL, Microservices)
   - Soft skills ONLY if explicitly stated (e.g. Leadership, Mentoring, Communication)
   - Domain-specific skills (e.g. Machine Learning, System Design, Data Structures, Algorithms)
   - Certifications and their relevant skills
   RULES for skills:
   - Include ALL skills you find — do NOT skip any
   - Use the canonical name: "JavaScript" not "js", "PostgreSQL" not "postgres"
   - Do NOT invent skills not present in the resume
   - Do NOT deduplicate variations — list "React" and "React.js" as just "React"
   - Minimum 10 skills if the resume is non-trivial; list everything you find
   - Order by strength/prominence (most-used or most-emphasized first)

2. EXPERIENCE LEVEL — classify as exactly one of: "Student", "Fresher", "Junior", "Mid", "Senior", "Lead", "Principal", "Executive"
   - Base on total years of work experience and role titles
   - Internships count as 0.5 years each

3. YEARS OF EXPERIENCE — total professional experience as a number (0 for students/freshers with only internships < 1yr)

4. SUMMARY — 2-3 sentences describing who this person is, their strongest domain, and their career stage

5. STRENGTHS — 3-5 specific, evidence-based strengths (reference actual projects/roles from the resume)

6. GAPS — 2-4 areas that are missing or weak compared to a typical candidate at this level

7. SUGGESTED QUESTIONS — generate 8-10 targeted interview questions that are SPECIFIC to THIS resume:
   - Each question must reference a specific project, technology, or role from THIS resume
   - Mix technical deep-dives, behavioral STAR questions, and situational scenarios
   - Questions must be distinct and non-overlapping
   - Order: warm-up → core technical → behavioral → challenging

Return ONLY this exact JSON (no markdown, no preamble):
{
  "summary": string,
  "skills": string[],
  "experienceLevel": string,
  "yearsOfExperience": number,
  "score": number (0-100 resume quality/completeness score),
  "strengths": string[],
  "gaps": string[],
  "suggestedQuestions": string[]
}`,
    {
      summary: 'Resume uploaded successfully. Add API credentials for a full AI analysis.',
      skills: ['Communication', 'Problem Solving'],
      experienceLevel: 'Unknown',
      yearsOfExperience: 0,
      score: 60,
      strengths: ['Readable resume structure'],
      gaps: ['AI provider is not configured, so deep extraction is unavailable'],
      suggestedQuestions: ['Which project best represents your current skill level?'],
    },
  );
