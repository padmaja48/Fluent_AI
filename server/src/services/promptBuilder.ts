import type { JobDescriptionProfile, ResumeInterviewProfile } from './ai.service';

export type InterviewPromptType = 'technical' | 'behavioral' | 'mixed';
export type ExperienceLevel = 'fresher' | 'experienced';

export type CompanyQuestionEntry = {
  question: string;
  type: 'behavioral' | 'technical' | 'situational' | 'coding' | 'system_design';
  source?: string;
};

export type ConversationTurn = {
  question: string;
  answer?: string;
  score?: number;
  topic?: string;
  questionType?: string;
};

export type PromptBuilderInput = {
  candidateResume: ResumeInterviewProfile | {
    summary?: string;
    skills?: string[];
    rawText?: string;
  };
  jobDescription?: string;
  jdProfile?: JobDescriptionProfile;
  company?: string;
  role: string;
  experienceLevel: ExperienceLevel;
  companyQuestionBank: CompanyQuestionEntry[] | null;
  companyBankMode: 'verified' | 'generic' | 'none';
  interviewType: InterviewPromptType;
  personaId?: string;
  personaPersonality?: string;
  interviewModeLabel?: string;
  interviewModeTemplate?: string;
  complexity?: string;
  roleLevel?: string;
};

const PERSONA_NAMES: Record<string, string> = {
  'us-american': 'Ryan Carter',
  'us-indian': 'Priya Sharma',
  'us-australian': 'Ananya Rao',
  'ru-russian': 'Rahul Menon',
};

const FORBIDDEN_TRANSITION_PHRASES = [
  "Let's make that more concrete",
  'You touched on',
  'Good, let\'s connect',
  'Thanks, let\'s connect',
  'Since your last answer',
  'You mentioned',
  'Let\'s go one level deeper on',
];

export const mapExperienceLevel = (roleLevel?: string): ExperienceLevel =>
  roleLevel === 'Fresher' ? 'fresher' : 'experienced';

export const mapInterviewPromptType = (interviewType?: string): InterviewPromptType => {
  if (interviewType === 'Technical') return 'technical';
  if (interviewType === 'Behavioural') return 'behavioral';
  return 'mixed';
};

const isStructuredResume = (
  resume: PromptBuilderInput['candidateResume'],
): resume is ResumeInterviewProfile => 'projects' in resume && 'skills' in resume;

const formatStructuredResume = (resume: ResumeInterviewProfile) => {
  const { candidateInformation, skills, projects, internships, workExperience, certifications, coursework } = resume;
  return [
    candidateInformation.name ? `Name: ${candidateInformation.name}` : '',
    candidateInformation.college ? `Education: ${candidateInformation.college}` : '',
    candidateInformation.degree ? `Degree: ${candidateInformation.degree}` : '',
    candidateInformation.branch ? `Branch: ${candidateInformation.branch}` : '',
    candidateInformation.cgpa ? `CGPA: ${candidateInformation.cgpa}` : '',
    projects.length ? `Projects (cite these by name):\n${projects.map((p, i) => `  ${i + 1}. ${p}`).join('\n')}` : '',
    internships.length ? `Internships:\n${internships.map((item) => `  - ${item}`).join('\n')}` : '',
    workExperience.length ? `Work Experience:\n${workExperience.map((item) => `  - ${item}`).join('\n')}` : '',
    certifications.length ? `Certifications: ${certifications.join('; ')}` : '',
    coursework.length ? `Coursework: ${coursework.join(', ')}` : '',
    `Tech stack — Languages: ${skills.programmingLanguages.join(', ') || 'none listed'}`,
    `Frameworks: ${skills.frameworks.join(', ') || 'none listed'}`,
    `Databases: ${skills.databases.join(', ') || 'none listed'}`,
    `Cloud/DevOps: ${skills.cloudTechnologies.join(', ') || 'none listed'}`,
    `Tools: ${skills.developerTools.join(', ') || 'none listed'}`,
  ]
    .filter(Boolean)
    .join('\n');
};

const formatResumeBlock = (resume: PromptBuilderInput['candidateResume']) => {
  if (isStructuredResume(resume)) {
    return formatStructuredResume(resume);
  }

  return [
    resume.summary ? `Summary: ${resume.summary}` : '',
    resume.skills?.length ? `Skills: ${resume.skills.join(', ')}` : '',
    resume.rawText ? `Full resume text:\n${resume.rawText}` : '',
  ]
    .filter(Boolean)
    .join('\n');
};

const formatJdBlock = (jobDescription?: string, jdProfile?: JobDescriptionProfile) => {
  if (!jobDescription?.trim() && !jdProfile) return 'No job description provided. Use role and resume only.';

  return [
    jobDescription?.trim() ? `Full job description:\n${jobDescription.trim()}` : '',
    jdProfile
      ? `Extracted requirements — Required: ${jdProfile.requiredSkills.join(', ') || 'none'}; Tools: ${jdProfile.toolsTechnologies.join(', ') || 'none'}; Responsibilities: ${jdProfile.responsibilities.slice(0, 6).join('; ') || 'none'}`
      : '',
  ]
    .filter(Boolean)
    .join('\n\n');
};

const formatCompanyBankBlock = (
  company: string | undefined,
  bank: CompanyQuestionEntry[] | null,
  mode: PromptBuilderInput['companyBankMode'],
) => {
  if (!bank?.length) {
    return company
      ? `COMPANY MODE: No verified question bank exists for "${company}". Do NOT claim questions are from ${company}'s actual interview process. Use industry-standard ${company ? 'role-based' : ''} questions and say nothing about "typical ${company} questions" unless grounded in the reference examples below (there are none).`
      : 'COMPANY MODE: No target company selected. Ask role-appropriate questions grounded in resume and JD.';
  }

  const label =
    mode === 'verified'
      ? `VERIFIED REFERENCE QUESTIONS for ${company} (reported by candidates — use for STYLE and DIFFICULTY only, do NOT copy verbatim):`
      : `GENERIC INDUSTRY REFERENCE QUESTIONS (not company-specific — match difficulty/style only):`;

  return `${label}\n${bank
    .map(
      (entry, index) =>
        `${index + 1}. [${entry.type}${entry.source ? `, ${entry.source}` : ''}] ${entry.question}`,
    )
    .join('\n')}`;
};

const technicalMixRule = (interviewType: InterviewPromptType, role: string, experienceLevel: ExperienceLevel) => {
  const isTechnicalRole = /\b(?:software|sde|developer|engineer|frontend|backend|full\s*stack|data|ml|ai|devops|cloud|qa|sdet|architect|programmer)\b/i.test(role);
  if (!isTechnicalRole || interviewType === 'behavioral') {
    return 'Focus on behavioral STAR questions and situational judgment. No coding/DSA unless the JD explicitly requires it.';
  }

  if (interviewType === 'technical') {
    return experienceLevel === 'fresher'
      ? 'Include at least 2 genuine DSA/coding questions (approach + complexity, not definitions). Include 1 system-design-lite or architecture question tied to a resume project. Mix role-specific technical depth (APIs, databases, concurrency as relevant).'
      : 'Include at least 2 DSA/coding questions at appropriate depth, 1 system design or architecture question with trade-offs, and senior-level ownership/technical-decision probes.';
  }

  return experienceLevel === 'fresher'
    ? 'Mix roughly 40% behavioral STAR and 60% technical. Include at least 1-2 DSA/coding questions and project-grounded technical questions.'
    : 'Mix behavioral and technical. Include at least 1-2 DSA/coding questions, system design scaled to experience, and depth on past technical decisions.';
};

export const formatConversationHistory = (turns: ConversationTurn[]) => {
  if (!turns.length) return 'No prior conversation yet.';

  return turns
    .map((turn, index) => {
      const answer = turn.answer?.trim() || '(no answer yet)';
      return `Turn ${index + 1}:
Interviewer: ${turn.question}
Candidate: ${answer}${typeof turn.score === 'number' ? `\n(Evaluation score: ${turn.score})` : ''}`;
    })
    .join('\n\n');
};

export function buildInterviewSystemPrompt(input: PromptBuilderInput): string {
  const personaName = input.personaId ? (PERSONA_NAMES[input.personaId] ?? 'Alex Morgan') : 'Alex Morgan';
  const modeLabel = input.interviewModeLabel ?? 'Software Development Engineer';
  const modeTemplate =
    input.interviewModeTemplate ??
    'Use a balanced SDE loop: fundamentals, coding reasoning, projects, and ownership.';
  const experienceTone =
    input.experienceLevel === 'fresher'
      ? 'Candidate is a fresher/early-career. Prioritize fundamentals, coursework, internships, and personal projects. Avoid senior system-design pressure unless JD demands it.'
      : 'Candidate is experienced. Probe depth, trade-offs, past ownership, cross-team decisions, and production impact.';

  const companyLine = input.company
    ? input.companyBankMode === 'verified'
      ? `You are interviewing for ${input.company}. Match the style/difficulty of the verified reference questions provided — do not invent "official ${input.company} questions" beyond those references.`
      : `Target company "${input.company}" was selected but no verified question bank exists. Be honest: ask strong role-based questions without pretending they are ${input.company}-specific.`
    : 'No specific company target. Focus on role, resume, and JD.';

  return `You are ${personaName}, a real human interviewer conducting a live mock interview. You are NOT an AI assistant. Never say you are an AI, never mention prompts, models, or JSON.

PERSONA: ${input.personaPersonality || 'Professional, conversational, probing — like a real hiring manager.'}
ROLE: ${input.role} (${input.roleLevel ?? input.experienceLevel})
INTERVIEW TYPE: ${input.interviewType}
ROLE MODE: ${modeLabel} — ${modeTemplate}
COMPLEXITY: ${input.complexity ?? 'Intermediate'}
${companyLine}

CANDIDATE RESUME (use exact project names, technologies, companies, and schools — never paraphrase into generic categories):
${formatResumeBlock(input.candidateResume)}

JOB DESCRIPTION:
${formatJdBlock(input.jobDescription, input.jdProfile)}

${formatCompanyBankBlock(input.company, input.companyQuestionBank, input.companyBankMode)}

INTERVIEW RULES:
1. Ask ONE question at a time. Wait for the candidate's response before the next question.
2. Reference SPECIFIC resume details — actual project names, tech stack items, internship companies, college name.
3. Align questions with JD requirements when a JD is provided.
4. ${technicalMixRule(input.interviewType, input.role, input.experienceLevel)}
5. ${experienceTone}
6. Match reference question STYLE and DIFFICULTY — never copy reference questions verbatim.
7. Follow-ups must react to what the candidate ACTUALLY said — quote or reference their words. Never use boilerplate transition phrases.
8. FORBIDDEN PHRASES (never use these or close variants): ${FORBIDDEN_TRANSITION_PHRASES.map((p) => `"${p}"`).join(', ')}.
9. Vary your transitions naturally — each follow-up should sound like a real person thinking in the moment.
10. If the candidate's message is a QUESTION directed at you (not an answer), respond briefly and in-character as ${personaName}, then ask if they're ready to continue OR naturally resume with the next interview question.
11. If the candidate gives a vague/generic answer, probe for specifics from their resume or a concrete example — without template phrases.
12. Never ask standalone definition questions ("What is OOP?") — tie fundamentals to their projects or JD scenarios.
13. For coding/DSA questions, ask them to explain approach, edge cases, and time/space complexity — do not give solutions.`;
}

export function buildInitialQuestionsUserPrompt(questionCount: number, sessionSeed: string) {
  return `Generate exactly ${questionCount} interview questions for this session (SESSION: ${sessionSeed} — use only for wording variety).

Return ONLY valid JSON:
{
  "questions": [
    {
      "question": string,
      "expectedSignals": string[],
      "questionType": "behavioural" | "technical" | "situational",
      "resumeReference": string,
      "difficulty": "easy" | "easy-medium" | "medium" | "medium-hard" | "scenario" | "problem-solving" | "behavioral",
      "topic": string,
      "followUpIntent": "deepen" | "clarify" | "bridge-topic" | "challenge" | "recover-confidence"
    }
  ]
}

Rules:
- Exactly ${questionCount} questions, all distinct topics.
- First question should be a natural self-introduction opener.
- Each question must cite a specific resume or JD element in resumeReference.
- Stage difficulty from easy warm-up to harder scenarios.
- No markdown, no preamble.`;
}

export type AdaptiveTurnPromptInput = {
  conversationHistory: ConversationTurn[];
  candidateMessage: string;
  lastEvaluation?: {
    score: number;
    nextAction?: string;
    missingConcepts?: string[];
    conceptsCovered?: string[];
    feedback?: string;
  };
  followUpDecision?: {
    action: string;
    focus: string;
    reason: string;
  };
  previousQuestionTopics: string[];
  targetDifficulty?: string;
  questionsRemaining: number;
};

export function buildAdaptiveTurnUserPrompt(input: AdaptiveTurnPromptInput) {
  return `FULL CONVERSATION SO FAR:
${formatConversationHistory(input.conversationHistory)}

CANDIDATE'S LATEST MESSAGE:
"${input.candidateMessage}"

LAST EVALUATION:
${input.lastEvaluation ? JSON.stringify(input.lastEvaluation, null, 2) : 'None — this may be the candidate asking you a question instead of answering.'}

FOLLOW-UP DECISION HINT:
${input.followUpDecision ? JSON.stringify(input.followUpDecision, null, 2) : 'Infer the best next move from the conversation.'}

TOPICS ALREADY COVERED: ${input.previousQuestionTopics.join(', ') || 'none yet'}
TARGET DIFFICULTY: ${input.targetDifficulty ?? 'medium'}
QUESTIONS REMAINING IN INTERVIEW: ${input.questionsRemaining}

Determine whether the candidate's latest message is:
- "answer" — they are answering your question, OR
- "question_to_interviewer" — they are asking YOU something (team size, role scope, culture, etc.)

Return ONLY valid JSON:
{
  "candidateMessageIntent": "answer" | "question_to_interviewer",
  "interviewerReply": string | null,
  "question": {
    "question": string,
    "expectedSignals": string[],
    "questionType": "behavioural" | "technical" | "situational",
    "resumeReference": string,
    "difficulty": "easy" | "easy-medium" | "medium" | "medium-hard" | "scenario" | "problem-solving" | "behavioral",
    "topic": string,
    "followUpIntent": "deepen" | "clarify" | "bridge-topic" | "challenge" | "recover-confidence"
  }
}

Rules:
- If intent is "question_to_interviewer": set interviewerReply to a brief in-character answer (2-4 sentences), then set question to either a natural continuation of the interview OR a short "ready to continue?" prompt.
- If intent is "answer": interviewerReply should be null. Generate the next question as a genuine follow-up referencing specifics from their answer, OR move to a new planned topic if the current one is exhausted.
- The question.question field must be the complete spoken text the interviewer says aloud (include any brief transition naturally woven in — NOT as a separate template prefix).
- Do not repeat previous questions.
- Do not use forbidden boilerplate transition phrases.
- No markdown, no preamble.`;
}
