import OpenAI, { toFile } from 'openai';
import { env } from '../config/env';

const openai = env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: env.OPENAI_API_KEY, baseURL: env.OPENAI_BASE_URL })
  : null;
const groq = env.GROQ_API_KEY
  ? new OpenAI({ apiKey: env.GROQ_API_KEY, baseURL: env.GROQ_BASE_URL })
  : null;

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
  complexity?: string;
  targetCompany?: string;
  resumeSkills?: string[];
  resumeExperienceLevel?: string;
  resumeSuggestedQuestions?: string[];
  resumeSummary?: string;
};

type TranscriptionContext = {
  roleDomain?: string;
  currentQuestion?: string;
  jobDescription?: string;
  resumeSkills?: string[];
};

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

export type QuestionAnalysisItem = {
  question: string;
  answer: string;
  score: number;
  feedback: string;
  whatWorked: string;
  whatToImprove: string;
  questionType: string;
  resumeReference: string;
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
  targetQuestionCount: number;
  currentQuestionIndex: number;
  jdProfile?: JobDescriptionProfile;
  companyGuidance?: CompanyInterviewGuidance;
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
];

export const normalizeTechnicalTranscript = (text: string, context?: TranscriptionContext) => {
  let normalized = text.replace(/\s+/g, ' ').trim();
  TECHNICAL_TERM_REPLACEMENTS.forEach(([pattern, replacement]) => {
    normalized = normalized.replace(pattern, replacement);
  });

  const contextTerms = unique([
    ...(context?.resumeSkills ?? []),
    ...extractJobDescriptionTechnologies(context?.jobDescription),
  ]).sort((a, b) => b.length - a.length);

  contextTerms.forEach((term) => {
    if (term.length < 3) return;
    const relaxed = term
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\\\./g, '\\s*\\.?\\s*')
      .replace(/\s+/g, '\\s+');
    normalized = normalized.replace(new RegExp(`\\b${relaxed}\\b`, 'gi'), term);
  });

  return normalized;
};

const buildTranscriptionPrompt = (context?: TranscriptionContext) => {
  const terms = Array.from(
    new Set([
      ...(context?.resumeSkills ?? []),
      ...extractJobDescriptionTechnologies(context?.jobDescription),
    ].map((term) => term.trim()).filter(Boolean)),
  ).slice(0, 40);

  const parts = [
    'The audio is a candidate answering a mock technical interview question in English.',
    context?.roleDomain ? `Role/domain: ${context.roleDomain}.` : '',
    context?.currentQuestion ? `Current question: ${context.currentQuestion}` : '',
    terms.length ? `Important technical words to recognize exactly: ${terms.join(', ')}.` : '',
    'Transcribe technical terms, product names, acronyms, and programming language names accurately.',
  ].filter(Boolean);

  return parts.join('\n').slice(0, 1800);
};

const extractJson = <T>(text: string): T => {
  const cleaned = text.replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
  return JSON.parse(cleaned) as T;
};

const generateJson = async <T>(prompt: string, fallback: T): Promise<T> => {
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
      input: prompt,
      text: { format: { type: 'json_object' } },
    });

    return extractJson<T>(response.output_text);
  }

  if (env.AI_PROVIDER === 'groq' && groq) {
    const response = await groq.chat.completions.create({
      model: env.GROQ_MODEL,
      messages: [
        { role: 'system', content: 'Return strict JSON only. Do not include markdown.' },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
    });

    return extractJson<T>(response.choices[0]?.message?.content ?? '{}');
  }

  return fallback;
};

export const transcribeAudio = async (file: Express.Multer.File, context?: TranscriptionContext) => {
  const client = env.AI_PROVIDER === 'groq' ? groq : openai;
  const model = env.AI_PROVIDER === 'groq' ? env.GROQ_WHISPER_MODEL : env.WHISPER_MODEL;

  if (!client) {
    return {
      text: `Transcription unavailable locally for ${file.originalname}. Configure ${env.AI_PROVIDER.toUpperCase()}_API_KEY to enable speech recognition.`,
      model,
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
  } as any);

  return {
    text: normalizeTechnicalTranscript(response.text, context),
    rawText: response.text,
    model,
    promptApplied: Boolean(prompt),
  };
};

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

const fallbackInitialQuestions = (
  context: InterviewContext,
  questionCount: number,
  jdProfile: JobDescriptionProfile,
): GeneratedQuestion[] => {
  const topics = unique([
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
      question: `The job description emphasizes ${primaryTopic}. Can you explain how you have used it in ${projectAnchor}?`,
      expectedSignals: ['specific project context', 'hands-on usage', 'clear technical terminology'],
      questionType: 'technical',
      resumeReference: `JD skill: ${primaryTopic}`,
      difficulty: 'easy-medium',
      topic: primaryTopic,
      followUpIntent: 'deepen',
    },
    {
      question: `How would you compare ${primaryTopic} with ${secondaryTopic} when deciding how to build a production feature?`,
      expectedSignals: ['trade-off reasoning', 'practical constraints', 'production awareness'],
      questionType: 'technical',
      resumeReference: `JD skill graph: ${primaryTopic} and ${secondaryTopic}`,
      difficulty: 'medium',
      topic: primaryTopic,
      followUpIntent: 'challenge',
    },
    {
      question: `Imagine a feature using ${primaryTopic} starts failing in production. How would you investigate and communicate the issue?`,
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

export const generateInterviewQuestions = (context: InterviewContext) => {
  const questionCount = Math.max(4, Math.ceil(context.duration / 5));

  // Unique session seed — guarantees different questions every call even for the same resume
  const sessionSeed = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  const personaBlock = context.personaPersonality
    ? `\nYOU ARE: A ${context.personaId ?? 'professional'} interviewer.\nPersonality: ${context.personaPersonality}\nAsk questions in your persona's natural tone and style.\n`
    : context.personaId
    ? `\nInterviewer persona: ${PERSONA_PERSONALITIES[context.personaId] ?? 'Professional interviewer'}\n`
    : '';

  // Build rich resume context block — use all available resume data
  let resumeBlock = '';
  if (context.resumeSummary || context.resumeText) {
    const skills = (context.resumeSkills ?? []).join(', ');
    resumeBlock = `
CANDIDATE RESUME — read every detail carefully:
${context.resumeSummary ? `Summary: ${context.resumeSummary}` : ''}
${context.resumeText ? `\nFull resume text:\n${context.resumeText}` : ''}

IDENTIFIED SKILLS: ${skills || 'See resume text above'}
EXPERIENCE LEVEL: ${context.resumeExperienceLevel ?? context.roleLevel}

SUGGESTED QUESTION ANGLES (do NOT copy these verbatim — use them as inspiration and create FRESH, rephrased variants):
${(context.resumeSuggestedQuestions ?? []).map((q, i) => `${i + 1}. ${q}`).join('\n')}
`;
  } else {
    resumeBlock = `\nRole domain: ${context.roleDomain}\nRole level: ${context.roleLevel}\n`;
  }

  const jdTechnologies = extractJobDescriptionTechnologies(context.jobDescription);
  const jdProfile = buildJobDescriptionProfile(context.jobDescription, {
    roleLevel: context.roleLevel,
    roleDomain: context.roleDomain,
    resumeSkills: context.resumeSkills,
  });
  const jdTechnologyTargetCount = jdTechnologies.length
    ? Math.min(questionCount - 1, Math.max(2, Math.ceil(questionCount * 0.7)))
    : 0;

  const jobDescriptionBlock = context.jobDescription?.trim()
    ? `
JOB DESCRIPTION — align the interview with these responsibilities and requirements:
${context.jobDescription.trim()}
${jdTechnologies.length ? `\nDETECTED JD TECHNOLOGIES: ${jdTechnologies.join(', ')}` : ''}
JD SKILL GRAPH:
${JSON.stringify(jdProfile, null, 2)}
`
    : '';

  const styleInstruction =
    context.interviewType === 'Behavioural'
      ? 'ALL questions must use the STAR method (Situation / Task / Action / Result). Start each with "Tell me about a time when..." or "Describe a situation where..."'
      : context.interviewType === 'Technical'
      ? 'ALL questions must probe deep technical knowledge — architecture decisions, specific technologies named in the resume, trade-offs, debugging strategies, system design.'
      : `Mix questions: roughly half STAR behavioural (starting "Tell me about a time...") and half deep technical questions targeting specific skills from the resume.`;

  const complexityNote =
    context.complexity === 'Beginner'
      ? 'Entry-level complexity: focus on fundamentals, coursework, personal projects, and learning mindset. Avoid deep system design.'
      : context.complexity === 'Advanced'
      ? 'Senior/advanced complexity: include system design, scalability trade-offs, leadership, cross-functional influence, and strategic decisions.'
      : 'Intermediate complexity: blend theory with practical real-world examples and moderate system design thinking.';

  return generateJson<{ questions: GeneratedQuestion[] }>(
    `SESSION ID: ${sessionSeed}  ← use this as your random seed; produce a FRESH, UNIQUE set of questions different from any previous session.

You are generating ${questionCount} interview questions for a LIVE interview session. These questions will be asked aloud to the candidate.

${personaBlock}
${resumeBlock}
${jobDescriptionBlock}

INTERVIEW TYPE: ${context.interviewType ?? 'Mixed'} | ROLE: ${context.roleDomain} ${context.roleLevel} | COMPLEXITY: ${context.complexity ?? 'Intermediate'} | TARGET COMPANY: ${context.targetCompany ?? 'None'}
STYLE RULE: ${styleInstruction}
COMPLEXITY RULE: ${complexityNote}
COMPANY RULE: If a target company is provided, align follow-up questions with that company's likely interview style, service/product context, and role expectations while still grounding questions in the resume.
JD RULE: If a job description is provided, the JD is the primary source. Use the JD SKILL GRAPH to cover required skills, responsibilities, seniority, domain knowledge, tools, soft skills, and keywords before generic role topics.
JD TECHNOLOGY RULE: If DETECTED JD TECHNOLOGIES is present, at least ${jdTechnologyTargetCount || 'most'} non-introduction questions MUST directly test those technologies. Name the technology in the question or resumeReference. If the resume does not mention a JD technology, ask a fundamentals, project-transfer, or scenario question for that JD technology instead of ignoring it.
DIFFICULTY RULE: Stage the interview naturally: easy warm-up, easy-medium, medium, medium-hard, scenario, problem-solving, behavioral. Early questions build confidence; later questions probe depth.

ABSOLUTE RULES — violating any rule makes the output unusable:
1. Generate EXACTLY ${questionCount} questions — no more, no fewer
2. Every question MUST target something SPECIFIC from this resume or the provided job description. Prefer questions that connect both. No generic or copy-paste questions.
3. NO two questions may be semantically similar or ask about the same topic
4. Questions MUST be varied — different skills, different question types, different depths
5. Do NOT copy the suggested question angles verbatim — rephrase and combine them creatively
6. Order: question 1 = warm-up/opener → middle = core depth → final = most challenging
7. Scale difficulty appropriately to ${context.roleLevel} level
8. Use the SESSION ID above to randomize phrasing — every session must produce a different set

Each question object MUST have ALL these fields:
- question: string (the exact question text, ready to speak aloud)
- expectedSignals: string[] (2-4 bullet points: what a strong answer must include)
- questionType: "behavioural" | "technical" | "situational"
- resumeReference: string (which specific skill/project/role/tech this targets)
- difficulty: "easy" | "easy-medium" | "medium" | "medium-hard" | "scenario" | "problem-solving" | "behavioral"
- topic: string (one primary skill/domain this question covers)
- followUpIntent: "deepen" | "clarify" | "bridge-topic" | "challenge" | "recover-confidence"

Return ONLY valid JSON. No markdown fences, no preamble, no explanation.
{
  "questions": [ ... ]
}`,
    { questions: fallbackInitialQuestions(context, questionCount, jdProfile) },
  );
};

export const evaluateAnswer = (question: string, answer: string) => {
  // Detect empty / skipped answers immediately — no AI call needed
  const trimmed = answer.trim();
  const isSkipped =
    !trimmed ||
    trimmed === '(no answer)' ||
    trimmed.length < 10 ||
    /^\(?(no answer|skipped?|n\/a|nothing|none)\)?$/i.test(trimmed);

  if (isSkipped) {
    return Promise.resolve<AnswerEvaluation>({
      score: 0,
      feedback: 'No answer was provided for this question. Skipped or empty answers score zero.',
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
    `You are a strict, professional interview evaluator. Evaluate the candidate's answer to the interview question below.

QUESTION: ${question}

CANDIDATE ANSWER: ${answer}

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
  "feedback": string (2-3 sentences, reference the actual answer content — what was good or missing),
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
    {
      score: 0,
      feedback: 'Unable to evaluate this answer. No meaningful content was detected.',
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
      missingSignals: ['Unable to evaluate answer content'],
    },
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

const chooseCoverageTopic = (context: AdaptiveQuestionContext) => {
  const jdTopics = unique([
    ...(context.jdProfile?.requiredSkills ?? []),
    ...(context.jdProfile?.toolsTechnologies ?? []),
    ...(context.jdProfile?.domainKnowledge ?? []),
    ...(context.resumeSkills ?? []),
    context.roleDomain,
  ]).filter(Boolean);
  const coverage = topicCoverage(context.transcript);
  return (
    jdTopics.find((topic) => !coverage.has(topic)) ??
    jdTopics.sort((a, b) => (coverage.get(a)?.asked ?? 0) - (coverage.get(b)?.asked ?? 0))[0] ??
    context.lastQuestion.topic ??
    context.roleDomain
  );
};

const transitionForAction = (action: AnswerEvaluation['nextAction'], score: number) => {
  if (action === 'reduce_difficulty' || score < 40) return "Let's make that more concrete.";
  if (action === 'clarify' || score < 60) return 'I want to clarify one part of that.';
  if (action === 'challenge' || score >= 85) return "That's a strong answer. Let's stretch it further.";
  if (action === 'ask_deeper' || score >= 70) return "Good. Let's go one level deeper.";
  return "Thanks. Let's connect that to another part of the role.";
};

const fallbackAdaptiveQuestion = (context: AdaptiveQuestionContext): GeneratedQuestion => {
  const action = context.lastEvaluation.nextAction ?? 'move_topic';
  const difficulty = nextDifficulty(
    context.lastQuestion.difficulty,
    context.lastEvaluation,
    context.currentQuestionIndex + 1,
    context.targetQuestionCount,
  );
  const sameTopic = context.lastQuestion.topic || context.lastQuestion.resumeReference || context.roleDomain;
  const coverageTopic = chooseCoverageTopic(context);
  const topic = action === 'ask_deeper' || action === 'clarify' || action === 'challenge' || action === 'reduce_difficulty'
    ? sameTopic
    : coverageTopic;
  const transition = transitionForAction(action, context.lastEvaluation.score);
  const questionType: GeneratedQuestion['questionType'] =
    difficulty === 'behavioral'
      ? 'behavioural'
      : difficulty === 'scenario' || difficulty === 'problem-solving'
      ? 'situational'
      : 'technical';

  const question =
    action === 'reduce_difficulty'
      ? `${transition} In your own words, when would you use ${topic}, and what is one simple example from your experience?`
      : action === 'clarify'
      ? `${transition} Can you walk me through the missing step or trade-off in your previous answer about ${topic}?`
      : action === 'challenge' || difficulty === 'scenario'
      ? `${transition} Suppose ${topic} has to handle a production failure or a sudden scale increase. How would you diagnose it and what trade-offs would you consider?`
      : difficulty === 'problem-solving'
      ? `${transition} Design a practical solution using ${topic}; cover the approach, edge cases, time or space complexity, and one optimization.`
      : difficulty === 'behavioral'
      ? `${transition} Tell me about a time you had to make a difficult technical decision related to ${topic}. What was your role, action, result, and what would you do differently now?`
      : `${transition} How does ${topic} work under the hood, and what mistake should engineers avoid when using it?`;

  return {
    question,
    expectedSignals:
      questionType === 'behavioural'
        ? ['STAR structure', 'specific role and action', 'outcome and reflection']
        : ['accurate concept explanation', 'practical example', 'trade-offs or edge cases'],
    questionType,
    resumeReference: action === 'move_topic' ? `Coverage topic: ${topic}` : `Follow-up on: ${sameTopic}`,
    difficulty,
    topic,
    followUpIntent:
      action === 'reduce_difficulty'
        ? 'recover-confidence'
        : action === 'move_topic'
        ? 'bridge-topic'
        : action === 'ask_deeper'
        ? 'deepen'
        : action,
  };
};

export const generateAdaptiveInterviewQuestion = async (context: AdaptiveQuestionContext) => {
  const difficulty = nextDifficulty(
    context.lastQuestion.difficulty,
    context.lastEvaluation,
    context.currentQuestionIndex + 1,
    context.targetQuestionCount,
  );
  const coveredTopics = Array.from(topicCoverage(context.transcript).entries()).map(([topic, value]) => ({
    topic,
    asked: value.asked,
    averageScore: value.averageScore,
  }));
  const fallback = fallbackAdaptiveQuestion(context);

  return generateJson<{ question: GeneratedQuestion }>(
    `You are conducting a LIVE adaptive mock interview. Generate exactly ONE next question that sounds like a professional human interviewer.

ROLE: ${context.roleDomain} ${context.roleLevel}
INTERVIEW TYPE: ${context.interviewType ?? 'Mixed'}
TARGET COMPANY: ${context.targetCompany ?? 'None'}
COMPANY STYLE GUIDANCE (inspiration only, do not claim official questions):
${context.companyGuidance ? JSON.stringify(context.companyGuidance, null, 2) : 'No company-specific style guidance available.'}

JOB DESCRIPTION PROFILE AND SKILL GRAPH:
${JSON.stringify(context.jdProfile ?? buildJobDescriptionProfile(context.jobDescription, {
      roleLevel: context.roleLevel,
      roleDomain: context.roleDomain,
      resumeSkills: context.resumeSkills,
    }), null, 2)}

RESUME SUMMARY: ${context.resumeSummary ?? 'Not available'}
RESUME SKILLS: ${(context.resumeSkills ?? []).join(', ') || 'Not available'}

LAST QUESTION:
${JSON.stringify(context.lastQuestion, null, 2)}
LAST ANSWER:
${context.lastAnswer}
LAST EVALUATION:
${JSON.stringify(context.lastEvaluation, null, 2)}

TOPIC COVERAGE SO FAR:
${JSON.stringify(coveredTopics, null, 2)}
PREVIOUS QUESTIONS:
${JSON.stringify(context.previousQuestions.map((item) => ({
      question: item.question,
      topic: item.topic,
      difficulty: item.difficulty,
      questionType: item.questionType,
    })), null, 2)}

NEXT QUESTION REQUIREMENTS:
- Must depend directly on the candidate's previous answer and evaluation.
- If the answer was strong, ask a deeper or more challenging continuation on the same topic.
- If the answer was partial, ask a clarifying follow-up.
- If the answer was weak, reduce difficulty immediately and rebuild confidence.
- If enough depth was shown, move to an uncovered JD/resume topic without feeling random.
- Do not repeat a previous question or ask semantically similar questions.
- Respect target difficulty: ${difficulty}.
- Prefer JD-required skills and resume/JD overlap over generic programming.
- For coding-style questions, ask for complexity, edge cases, alternatives, and optimization. Do not reveal solutions.
- For behavioral questions, use STAR follow-up logic.
- Use a natural transition sentence, not labels like "Question 4".

Return ONLY this JSON:
{
  "question": {
    "question": string,
    "expectedSignals": string[],
    "questionType": "behavioural" | "technical" | "situational",
    "resumeReference": string,
    "difficulty": "easy" | "easy-medium" | "medium" | "medium-hard" | "scenario" | "problem-solving" | "behavioral",
    "topic": string,
    "followUpIntent": "deepen" | "clarify" | "bridge-topic" | "challenge" | "recover-confidence"
  }
}`,
    { question: fallback },
  ).then((result) => ({
    ...fallback,
    ...result.question,
    expectedSignals: result.question.expectedSignals?.length ? result.question.expectedSignals : fallback.expectedSignals,
  }));
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
  }>
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
      })),
    });
  }

  // For the per-question scores already computed by evaluateAnswer, use them as ground truth
  const precomputedAvg = transcript.reduce((sum, t) => sum + (t.score ?? 0), 0) / Math.max(1, totalCount);
  const difficultyProgression = transcript.map((t) => t.difficulty ?? 'unknown');
  const questionTimeline = transcript.map((t) => ({
    question: t.question,
    topic: t.topic ?? t.resumeReference ?? 'general',
    difficulty: t.difficulty ?? 'unknown',
    score: t.score ?? 0,
  }));

  return generateJson<InterviewReport>(
    `You are a strict, professional interview panel evaluator. Generate an honest performance report from this Q&A transcript.

TRANSCRIPT:
${JSON.stringify(transcript, null, 2)}

STRICT EVALUATION RULES:
1. Answers that are empty, "(no answer)", very short (under 2 sentences), or completely vague must be scored 0–20
2. Do NOT inflate scores — if the candidate gave weak answers, the overall score must reflect that honestly
3. The overallScore must be the weighted average of the per-question scores — do NOT invent a higher number
4. ${answeredCount} out of ${totalCount} questions were answered. This participation rate (${Math.round(participationRatio * 100)}%) must factor into all scores
5. If fewer than half the questions were answered, no score category should exceed 50
6. Pre-computed average per-question score: ${Math.round(precomputedAvg)} — your overallScore should be close to this
7. Strengths array must be EMPTY [] if the candidate gave no meaningful answers
8. Reference actual answer content in all feedback — do NOT fabricate content the candidate did not say

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
      "resumeReference": string
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
        whatWorked: t.score && t.score > 40 ? 'Some relevant content was provided' : 'Nothing — no meaningful answer was given.',
        whatToImprove: 'Provide a complete, structured answer with specific examples.',
        questionType: t.questionType ?? 'general',
        resumeReference: t.resumeReference ?? 'general',
      })),
    },
  );
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
