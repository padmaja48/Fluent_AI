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
  personaId?: string;
  personaPersonality?: string;
  interviewType?: string;
  complexity?: string;
  resumeSkills?: string[];
  resumeExperienceLevel?: string;
  resumeSuggestedQuestions?: string[];
  resumeSummary?: string;
};

export type GeneratedQuestion = {
  question: string;
  expectedSignals: string[];
  questionType?: 'behavioural' | 'technical' | 'situational';
  resumeReference?: string;
};

export type AnswerEvaluation = {
  score: number;
  feedback: string;
  communicationScore: number;
  technicalScore: number;
  behavioralScore: number;
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
  overallScore: number;
  strengths: string[];
  improvements: string[];
  recommendations: string[];
  transcriptSummary: string;
  questionAnalysis?: QuestionAnalysisItem[];
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

export const transcribeAudio = async (file: Express.Multer.File) => {
  const client = env.AI_PROVIDER === 'groq' ? groq : openai;
  const model = env.AI_PROVIDER === 'groq' ? env.GROQ_WHISPER_MODEL : env.WHISPER_MODEL;

  if (!client) {
    return {
      text: `Transcription unavailable locally for ${file.originalname}. Configure ${env.AI_PROVIDER.toUpperCase()}_API_KEY to enable speech recognition.`,
      model,
    };
  }

  const uploadedFile = await toFile(file.buffer, file.originalname, { type: file.mimetype });
  const response = await client.audio.transcriptions.create({
    file: uploadedFile,
    model,
  });

  return {
    text: response.text,
    model,
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
    text,
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

INTERVIEW TYPE: ${context.interviewType ?? 'Mixed'} | ROLE: ${context.roleDomain} ${context.roleLevel} | COMPLEXITY: ${context.complexity ?? 'Intermediate'}
STYLE RULE: ${styleInstruction}
COMPLEXITY RULE: ${complexityNote}

ABSOLUTE RULES — violating any rule makes the output unusable:
1. Generate EXACTLY ${questionCount} questions — no more, no fewer
2. Every question MUST target something SPECIFIC from this resume (a named skill, project, technology, or role). No generic or copy-paste questions.
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

Return ONLY valid JSON. No markdown fences, no preamble, no explanation.
{
  "questions": [ ... ]
}`,
    {
      questions: [
        {
          question: 'Walk me through the most impactful project on your resume and the technical decisions you made.',
          expectedSignals: ['ownership', 'technical trade-offs', 'measurable outcome'],
          questionType: 'technical',
          resumeReference: 'most recent role',
        },
        {
          question: 'Describe a challenging problem you had to debug in production and how you resolved it.',
          expectedSignals: ['systematic diagnosis', 'tooling used', 'prevention measures'],
          questionType: 'technical',
          resumeReference: 'general',
        },
        {
          question: 'Tell me about a time you had to learn a new technology quickly under pressure.',
          expectedSignals: ['self-directed learning', 'resourcefulness', 'applied outcome'],
          questionType: 'behavioural',
          resumeReference: 'general',
        },
      ],
    },
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

Return ONLY a JSON object:
{
  "score": number (0-100, strict),
  "feedback": string (2-3 sentences, reference the actual answer content — what was good or missing),
  "communicationScore": number (0-100),
  "technicalScore": number (0-100),
  "behavioralScore": number (0-100)
}`,
    {
      score: 0,
      feedback: 'Unable to evaluate this answer. No meaningful content was detected.',
      communicationScore: 0,
      technicalScore: 0,
      behavioralScore: 0,
    },
  );
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
  transcript: Array<{ question: string; answer?: string; feedback?: string; score?: number; questionType?: string; resumeReference?: string }>
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
  "overallScore": number (0-100, strict — must reflect actual answer quality),
  "strengths": string[] (only include real strengths evidenced in the answers — empty array if none),
  "improvements": string[] (3-5 specific, honest improvement areas based on what was missing),
  "recommendations": string[] (3-5 concrete, actionable next steps),
  "transcriptSummary": string (honest 2-3 sentence summary of actual performance),
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
      overallScore: Math.round(precomputedAvg),
      strengths: answeredCount > 0 ? ['Some questions were attempted'] : [],
      improvements: ['Provide specific, structured answers to each question', 'Use the STAR method for behavioral questions'],
      recommendations: ['Practice answering interview questions aloud', 'Prepare concrete examples from past experience'],
      transcriptSummary: `The candidate answered ${answeredCount} of ${totalCount} questions with an average score of ${Math.round(precomputedAvg)}.`,
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
