import { z } from 'zod';
import { getRedis } from '../config/redis';
import { Interview } from '../models/Interview';
import { Report } from '../models/Report';
import { Resume } from '../models/Resume';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import {
  buildJobDescriptionProfile,
  evaluateAnswer,
  generateAdaptiveInterviewQuestion,
  generateInterviewQuestions,
  generateReport,
  transcribeAudio,
} from '../services/ai.service';
import { uploadBuffer, uploadText } from '../services/storage.service';
import { getPersonaIntro, getPersonaVoiceStyle, synthesizeSpeech } from '../services/voice.service';
import {
  buildInterviewQuestionSet,
  buildInterviewRoadmap,
  deriveInterviewRuntimeState,
  getCompanyInterviewGuidance,
} from '../services/companyQuestions.service';

const idParams = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});

export const interviewParamsSchema = idParams;

export const createInterviewSchema = z.object({
  body: z.object({
    resumeId: z.string().optional(),
    resumeText: z.string().optional(),
    resumeUrl: z.string().url().optional(),
    jobDescription: z.string().max(20000).optional(),
    roleLevel: z.enum(['Fresher', 'Mid', 'Senior', 'Lead']),
    roleDomain: z.string().min(2),
    interviewStyle: z.string().min(2).default('Mixed'),
    duration: z.coerce.number().int().refine((value) => [15, 20, 30, 45, 60].includes(value), 'Unsupported interview duration').default(30),
    personaId: z.enum(['us-american', 'us-indian', 'us-australian', 'ru-russian']).optional(),
    interviewType: z.enum(['Behavioural', 'Technical', 'Mixed']).optional(),
    complexity: z.enum(['Beginner', 'Intermediate', 'Advanced']).optional(),
    targetCompany: z.string().min(1).max(120).optional(),
  }),
});

export const startInterviewSchema = z.object({
  body: z.object({
    interviewId: z.string().optional(),
  }),
});

export const answerSchema = z.object({
  body: z.object({
    interviewId: z.string().optional(),
    question: z.string().optional(),
    answer: z.string().min(1),
  }),
});

export const speakSchema = z.object({
  body: z.object({
    text: z.string().min(1),
    voiceStyle: z.enum(['default', 'professional_female', 'professional_male', 'neutral']).default('default'),
    voiceId: z.string().min(1).optional(),
    pace: z.coerce.number().min(0.75).max(1.35).optional(),
  }),
  params: z.object({
    id: z.string().min(1),
  }),
});

const getInterviewForUser = async (id: string, userId?: string) => {
  const interview = await Interview.findOne({ _id: id, userId });
  if (!interview) {
    throw new AppError('Interview not found', 404, 'INTERVIEW_NOT_FOUND');
  }

  return interview;
};

const firstString = (value: unknown) => {
  if (Array.isArray(value)) {
    return value[0];
  }

  return typeof value === 'string' ? value : undefined;
};

const requestedInterviewId = (req: { params: { id?: unknown }; body: { interviewId?: unknown } }) =>
  firstString(req.params.id) ?? firstString(req.body.interviewId);

const writeInterviewState = async (interviewId: string, state: unknown) => {
  await getRedis().set(`interview:${interviewId}:state`, JSON.stringify(state), 'EX', 60 * 60 * 4);
};

const PERSONA_PERSONALITIES: Record<string, string> = {
  'us-american': 'Direct, confident, values concrete examples and measurable outcomes. Uses STAR method prompts.',
  'us-indian': 'Analytical, probes technical depth, asks detailed follow-up questions.',
  'us-australian': 'Relaxed but sharp, tests product thinking and communication clarity.',
  'ru-russian': 'Precise and methodical, focuses on algorithmic thinking and system design, expects rigorous well-reasoned answers.',
};

const getPersonaPersonality = (personaId?: string) =>
  personaId ? (PERSONA_PERSONALITIES[personaId] ?? '') : '';

const buildContextFromInterview = (interview: Awaited<ReturnType<typeof getInterviewForUser>>) => ({
  roleLevel: interview.roleLevel,
  roleDomain: interview.roleDomain,
  interviewStyle: (interview as any).interviewType ?? interview.interviewStyle,
  duration: interview.duration,
  resumeText: interview.resumeText,
  jobDescription: (interview as any).jobDescription,
  personaId: (interview as any).personaId,
  personaPersonality: getPersonaPersonality((interview as any).personaId),
  interviewType: (interview as any).interviewType,
  complexity: (interview as any).complexity,
  targetCompany: (interview as any).targetCompany,
  resumeSkills: (interview as any).resumeSkills ?? [],
  resumeExperienceLevel: (interview as any).resumeExperienceLevel ?? '',
  resumeSuggestedQuestions: (interview as any).resumeSuggestedQuestions ?? [],
  resumeSummary: (interview as any).resumeSummary ?? '',
});

const averageMetric = (previous: number | undefined, next: number | undefined, count: number) => {
  if (typeof next !== 'number') return previous;
  if (count <= 1 || typeof previous !== 'number') return Math.round(next);
  return Math.round(((previous * (count - 1)) + next) / count);
};

const getPublicState = (interview: Awaited<ReturnType<typeof getInterviewForUser>>) => ({
  status: interview.status,
  currentQuestionIndex: interview.currentQuestionIndex,
  currentQuestion: interview.questions[interview.currentQuestionIndex],
  totalQuestions: (interview as any).totalPlannedQuestions ?? interview.questions.length,
  questions: interview.questions,
  liveScores: (interview as any).liveScores ?? {},
});

const toGeneratedQuestion = (item: any) => ({
  question: item.question,
  expectedSignals: item.expectedSignals ?? [],
  questionType: item.questionType,
  resumeReference: item.resumeReference,
  difficulty: item.difficulty,
  topic: item.topic,
  followUpIntent: item.followUpIntent,
});

const isRequiredCoverageQuestion = (question?: { resumeReference?: string }) =>
  Boolean(question?.resumeReference && /^(Skill coverage|Skill deep dive|Skill production scenario):/i.test(question.resumeReference));

export const logViolationSchema = z.object({
  body: z.object({
    type: z.string().min(1),
    description: z.string().optional(),
  }),
  params: z.object({ id: z.string().min(1) }),
});

export const logViolation = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { type, description } = req.body as { type: string; description?: string };
  const interview = await Interview.findOneAndUpdate(
    { _id: id, userId: req.userId },
    { $push: { violations: { type, description: description ?? '', timestamp: new Date() } } },
    { new: true },
  );
  if (!interview) throw new AppError('Interview not found', 404, 'INTERVIEW_NOT_FOUND');
  res.json({ violations: interview.violations });
});

export const createInterview = asyncHandler(async (req, res) => {
  let resumeSkills: string[] = [];
  let resumeExperienceLevel = '';
  let resumeSuggestedQuestions: string[] = [];
  let resumeSummary = '';
  let resumeText = req.body.resumeText ?? '';

  if (req.body.resumeId) {
    const resume = await Resume.findOne({ _id: req.body.resumeId, userId: req.userId });
    if (resume) {
      resumeText = resume.rawText ?? resumeText;
      resumeSkills = resume.analysis?.skills ?? [];
      resumeExperienceLevel = resume.analysis?.experienceLevel ?? '';
      resumeSuggestedQuestions = resume.analysis?.suggestedQuestions ?? [];
      resumeSummary = resume.analysis?.summary ?? '';
    }
  }

  const jdProfile = buildJobDescriptionProfile(req.body.jobDescription, {
    roleLevel: req.body.roleLevel,
    roleDomain: req.body.roleDomain,
    resumeSkills,
  });
  const companyGuidance = getCompanyInterviewGuidance(req.body.targetCompany);
  const interviewRoadmap = buildInterviewRoadmap({
    resumeText,
    resumeSkills,
    resumeSummary,
    roleDomain: req.body.roleDomain,
    roleLevel: req.body.roleLevel,
    duration: req.body.duration ?? 30,
    complexity: req.body.complexity,
    targetCompany: req.body.targetCompany,
    jdProfile,
    companyGuidance,
  });
  const interviewState = deriveInterviewRuntimeState({
    roadmap: interviewRoadmap,
    transcript: [],
  });

  const interview = await Interview.create({
    userId: req.userId,
    ...req.body,
    resumeText,
    resumeSkills,
    resumeExperienceLevel,
    resumeSuggestedQuestions,
    resumeSummary,
    jdProfile,
    companyGuidance,
    interviewRoadmap,
    interviewState,
    totalPlannedQuestions: interviewRoadmap.targetQuestionCount,
    liveScores: {},
    status: 'Setup',
  });

  res.status(201).json(interview);
});

export const getUserInterviews = asyncHandler(async (req, res) => {
  const interviews = await Interview.find({ userId: req.userId })
    .populate('userId', 'name email')
    .sort({ createdAt: -1 });
  res.json(interviews);
});

export const getInterview = asyncHandler(async (req, res) => {
  const interviewId = requestedInterviewId(req);
  if (!interviewId) {
    throw new AppError('Interview id is required', 400, 'INTERVIEW_ID_REQUIRED');
  }

  const interview = await getInterviewForUser(interviewId, req.userId);
  await interview.populate('userId', 'name email');
  res.json(interview);
});

export const startInterview = asyncHandler(async (req, res) => {
  const interviewId = requestedInterviewId(req);
  if (!interviewId) {
    throw new AppError('Interview id is required', 400, 'INTERVIEW_ID_REQUIRED');
  }

  const interview = await getInterviewForUser(interviewId, req.userId);

  if (!(interview as any).jdProfile) {
    (interview as any).jdProfile = buildJobDescriptionProfile((interview as any).jobDescription, {
      roleLevel: interview.roleLevel,
      roleDomain: interview.roleDomain,
      resumeSkills: (interview as any).resumeSkills ?? [],
    });
  }
  if (!(interview as any).companyGuidance) {
    (interview as any).companyGuidance = getCompanyInterviewGuidance((interview as any).targetCompany);
  }
  if (!(interview as any).interviewRoadmap) {
    (interview as any).interviewRoadmap = buildInterviewRoadmap({
      resumeText: interview.resumeText,
      resumeSkills: (interview as any).resumeSkills ?? [],
      resumeSummary: (interview as any).resumeSummary,
      roleDomain: interview.roleDomain,
      roleLevel: interview.roleLevel,
      duration: interview.duration,
      complexity: (interview as any).complexity,
      targetCompany: (interview as any).targetCompany,
      jdProfile: (interview as any).jdProfile,
      companyGuidance: (interview as any).companyGuidance,
    });
  }
  if (!(interview as any).interviewState) {
    (interview as any).interviewState = deriveInterviewRuntimeState({
      roadmap: (interview as any).interviewRoadmap,
      transcript: [],
    });
  }
  (interview as any).totalPlannedQuestions =
    (interview as any).interviewRoadmap?.targetQuestionCount ?? (interview as any).totalPlannedQuestions;

  if (interview.questions.length === 0) {
    const generated = await generateInterviewQuestions(buildContextFromInterview(interview));

    interview.questions = buildInterviewQuestionSet({
      generatedQuestions: generated.questions,
      targetCompany: (interview as any).targetCompany,
      duration: interview.duration,
      interviewRoadmap: (interview as any).interviewRoadmap,
      prioritizeGenerated: Boolean((interview as any).jobDescription?.trim()),
    });
  }

  interview.status = 'In Progress';
  interview.startedAt = interview.startedAt ?? new Date();
  await interview.save();

  const state = getPublicState(interview);

  await writeInterviewState(String(interview._id), state);
  res.json({ interview, state });
});

export const submitAnswer = asyncHandler(async (req, res) => {
  const interviewId = requestedInterviewId(req);
  if (!interviewId) {
    throw new AppError('Interview id is required', 400, 'INTERVIEW_ID_REQUIRED');
  }

  const interview = await getInterviewForUser(interviewId, req.userId);
  const questionIndex = interview.currentQuestionIndex;
  const currentQuestion = interview.questions[questionIndex]?.question ?? req.body.question;

  if (!currentQuestion) {
    throw new AppError('No active question found', 400, 'NO_ACTIVE_QUESTION');
  }

  const activeQuestion = interview.questions[questionIndex];
  const evaluation = await evaluateAnswer(currentQuestion, req.body.answer, {
    expectedSignals: activeQuestion?.expectedSignals ?? [],
    roleDomain: interview.roleDomain,
    roleLevel: interview.roleLevel,
    targetCompany: (interview as any).targetCompany,
    difficulty: activeQuestion?.difficulty,
    questionType: activeQuestion?.questionType,
    topic: activeQuestion?.topic,
  });

  if (interview.questions[questionIndex]) {
    interview.questions[questionIndex].userAnswer = req.body.answer;
    interview.questions[questionIndex].feedback = evaluation.feedback;
    interview.questions[questionIndex].score = evaluation.score;
    interview.questions[questionIndex].idealAnswer = evaluation.idealAnswer;
    interview.questions[questionIndex].samplePerfectAnswer = evaluation.samplePerfectAnswer;
    interview.questions[questionIndex].conceptsCovered = evaluation.conceptsCovered;
    interview.questions[questionIndex].missingConcepts = evaluation.missingConcepts;
    interview.questions[questionIndex].incorrectStatements = evaluation.incorrectStatements;
    interview.questions[questionIndex].wrongTerminology = evaluation.wrongTerminology;
    interview.questions[questionIndex].technicalMistakes = evaluation.technicalMistakes;
    interview.questions[questionIndex].dynamicFeedback = evaluation.dynamicFeedback;
  } else {
    interview.questions.push({
      question: currentQuestion,
      userAnswer: req.body.answer,
      feedback: evaluation.feedback,
      score: evaluation.score,
      idealAnswer: evaluation.idealAnswer,
      samplePerfectAnswer: evaluation.samplePerfectAnswer,
      conceptsCovered: evaluation.conceptsCovered,
      missingConcepts: evaluation.missingConcepts,
      incorrectStatements: evaluation.incorrectStatements,
      wrongTerminology: evaluation.wrongTerminology,
      technicalMistakes: evaluation.technicalMistakes,
      dynamicFeedback: evaluation.dynamicFeedback,
    });
  }

  const answeredCount = interview.questions.filter((item) => typeof item.score === 'number').length;
  const liveScores = (interview as any).liveScores ?? {};
  (interview as any).liveScores = {
    confidence: averageMetric(liveScores.confidence, evaluation.confidenceScore, answeredCount),
    completeness: averageMetric(liveScores.completeness, evaluation.completenessScore, answeredCount),
    depth: averageMetric(liveScores.depth, evaluation.depthScore, answeredCount),
    terminology: averageMetric(liveScores.terminology, evaluation.terminologyScore, answeredCount),
    grammar: averageMetric(liveScores.grammar, evaluation.grammarScore, answeredCount),
    vocabulary: averageMetric(liveScores.vocabulary, evaluation.vocabularyScore, answeredCount),
    domain: averageMetric(liveScores.domain, evaluation.domainScore, answeredCount),
  };

  const nextIndex = questionIndex + 1;
  const targetQuestionCount = (interview as any).totalPlannedQuestions ?? interview.questions.length;
  const answeredTranscript = interview.questions.slice(0, nextIndex).map((item) => ({
    question: item.question,
    answer: item.userAnswer,
    score: item.score,
    feedback: item.feedback,
    questionType: item.questionType,
    resumeReference: item.resumeReference,
    difficulty: item.difficulty,
    topic: item.topic,
    idealAnswer: (item as any).idealAnswer,
    samplePerfectAnswer: (item as any).samplePerfectAnswer,
    conceptsCovered: (item as any).conceptsCovered,
    missingConcepts: (item as any).missingConcepts,
    incorrectStatements: (item as any).incorrectStatements,
    wrongTerminology: (item as any).wrongTerminology,
    technicalMistakes: (item as any).technicalMistakes,
    dynamicFeedback: (item as any).dynamicFeedback,
  }));
  (interview as any).interviewState = deriveInterviewRuntimeState({
    roadmap: (interview as any).interviewRoadmap,
    transcript: answeredTranscript,
  });

  if (nextIndex < targetQuestionCount) {
    const previousQuestionDocs = interview.questions.slice(0, nextIndex);
    const previousQuestions = previousQuestionDocs.map(toGeneratedQuestion);
    const lastQuestion = toGeneratedQuestion(interview.questions[questionIndex]);
    const plannedNextQuestion = interview.questions[nextIndex];
    const nextQuestion = isRequiredCoverageQuestion(plannedNextQuestion)
      ? toGeneratedQuestion(plannedNextQuestion)
      : await generateAdaptiveInterviewQuestion({
      ...buildContextFromInterview(interview),
      previousQuestions,
      transcript: previousQuestionDocs.map((item) => ({
        question: item.question,
        answer: item.userAnswer,
        score: item.score,
        feedback: item.feedback,
        questionType: item.questionType,
        resumeReference: item.resumeReference,
        difficulty: item.difficulty,
        topic: item.topic,
        idealAnswer: (item as any).idealAnswer,
        samplePerfectAnswer: (item as any).samplePerfectAnswer,
        conceptsCovered: (item as any).conceptsCovered,
        missingConcepts: (item as any).missingConcepts,
        incorrectStatements: (item as any).incorrectStatements,
        wrongTerminology: (item as any).wrongTerminology,
        technicalMistakes: (item as any).technicalMistakes,
        dynamicFeedback: (item as any).dynamicFeedback,
      })),
      lastQuestion,
      lastAnswer: req.body.answer,
      lastEvaluation: evaluation,
      targetQuestionCount,
      currentQuestionIndex: questionIndex,
      jdProfile: (interview as any).jdProfile,
      companyGuidance: (interview as any).companyGuidance,
      interviewRoadmap: (interview as any).interviewRoadmap,
      interviewState: (interview as any).interviewState,
    });

    if (interview.questions[nextIndex]) {
      interview.questions[nextIndex] = nextQuestion;
    } else {
      interview.questions.push(nextQuestion);
    }
    interview.markModified('questions');
  }
  interview.markModified('interviewState');

  interview.currentQuestionIndex = nextIndex; // may equal target count; that signals completion
  await interview.save();

  const state = getPublicState(interview);

  await writeInterviewState(String(interview._id), state);
  res.json({ interview, evaluation, state });
});

export const completeInterview = asyncHandler(async (req, res) => {
  const interviewId = requestedInterviewId(req);
  if (!interviewId) {
    throw new AppError('Interview id is required', 400, 'INTERVIEW_ID_REQUIRED');
  }

  const interview = await getInterviewForUser(interviewId, req.userId);
  if (interview.status === 'Completed') {
    const report = await Report.findOne({ interviewId: interview._id }).sort({ createdAt: -1 });
    await interview.populate('userId', 'name email');
    await getRedis().del(`interview:${interview._id}:state`);
    res.json({ interview, report });
    return;
  }

  const transcript = interview.questions.map((item) => ({
    question: item.question,
    answer: item.userAnswer,
    feedback: item.feedback,
    score: item.score,
    questionType: (item as any).questionType,
    resumeReference: (item as any).resumeReference,
    difficulty: (item as any).difficulty,
    topic: (item as any).topic,
    idealAnswer: (item as any).idealAnswer,
    samplePerfectAnswer: (item as any).samplePerfectAnswer,
    conceptsCovered: (item as any).conceptsCovered,
    missingConcepts: (item as any).missingConcepts,
    incorrectStatements: (item as any).incorrectStatements,
    wrongTerminology: (item as any).wrongTerminology,
    technicalMistakes: (item as any).technicalMistakes,
    dynamicFeedback: (item as any).dynamicFeedback,
  }));
  const aiReport = await generateReport(transcript);
  const storedReport = await uploadText(JSON.stringify(aiReport, null, 2), `interview-${interview._id}.json`, 'reports');

  const report = await Report.create({
    userId: req.userId,
    interviewId: interview._id,
    reportUrl: storedReport.url,
    ...aiReport,
    questionAnalysis: aiReport.questionAnalysis ?? [],
  });

  interview.status = 'Completed';
  interview.completedAt = new Date();
  interview.totalScore = aiReport.overallScore;
  interview.scores = {
    communication: aiReport.communicationScore,
    technical: aiReport.technicalScore,
    behavioral: aiReport.behavioralScore,
  };
  interview.feedbackSummary = {
    strengths: aiReport.strengths,
    improvements: aiReport.improvements,
    overallFeedback: aiReport.transcriptSummary,
  };
  interview.reportUrl = storedReport.url;
  await interview.save();
  await interview.populate('userId', 'name email');

  await getRedis().del(`interview:${interview._id}:state`);
  res.json({ interview, report });
});

export const getInterviewState = asyncHandler(async (req, res) => {
  const interviewId = requestedInterviewId(req);
  if (!interviewId) {
    throw new AppError('Interview id is required', 400, 'INTERVIEW_ID_REQUIRED');
  }

  const interview = await getInterviewForUser(interviewId, req.userId);
  const cached = await getRedis().get(`interview:${interview._id}:state`);
  res.json(cached ? JSON.parse(cached) : getPublicState(interview));
});

export const synthesizeQuestion = asyncHandler(async (req, res) => {
  const interviewId = requestedInterviewId(req);
  if (!interviewId) {
    throw new AppError('Interview id is required', 400, 'INTERVIEW_ID_REQUIRED');
  }

  const interview = await getInterviewForUser(interviewId, req.userId);
  const personaId = (interview as any).personaId as string | undefined;
  const voiceStyle = personaId ? getPersonaVoiceStyle(personaId) : req.body.voiceStyle;
  const audio = await synthesizeSpeech(req.body.text, voiceStyle, personaId, undefined, {
    context: 'interview',
    pace: req.body.pace ?? 1.0,
    voiceId: req.body.voiceId,
  });
  res.setHeader('X-TTS-Cache-Key', audio.cacheKey);
  res.setHeader('Cache-Control', 'private, max-age=86400');
  res.type(audio.contentType).send(audio.buffer);
});

/* ── Persona voice preview (no interview session required) ─────── */
export const personaPreviewSchema = z.object({
  body: z.object({
    personaId: z.enum(['us-american', 'us-indian', 'us-australian', 'ru-russian']),
    voiceId: z.string().min(1).optional(),
  }),
});

export const personaVoicePreview = asyncHandler(async (req, res) => {
  const { personaId } = req.body as { personaId: string };
  const intro = getPersonaIntro(personaId);
  const voiceStyle = getPersonaVoiceStyle(personaId);
  const audio = await synthesizeSpeech(intro, voiceStyle, personaId, undefined, {
    context: 'preview',
    pace: 1.0,
  });
  res.setHeader('X-TTS-Cache-Key', audio.cacheKey);
  res.setHeader('X-TTS-Text', encodeURIComponent(intro));
  res.setHeader('X-TTS-Persona-Id', personaId);
  res.setHeader('Cache-Control', 'private, max-age=86400');
  res.type(audio.contentType).send(audio.buffer);
});

export const transcribeRecording = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError('Audio file is required', 400, 'FILE_REQUIRED');
  }

  const interviewId = requestedInterviewId(req);
  if (!interviewId) {
    throw new AppError('Interview id is required', 400, 'INTERVIEW_ID_REQUIRED');
  }

  const interview = await getInterviewForUser(interviewId, req.userId);
  const transcription = await transcribeAudio(req.file, {
    roleDomain: interview.roleDomain,
    currentQuestion: interview.questions[interview.currentQuestionIndex]?.question,
    jobDescription: (interview as any).jobDescription,
    resumeSkills: (interview as any).resumeSkills ?? [],
  });
  res.json(transcription);
});

export const uploadRecording = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError('Recording file is required', 400, 'FILE_REQUIRED');
  }

  const interviewId = requestedInterviewId(req);
  if (!interviewId) {
    throw new AppError('Interview id is required', 400, 'INTERVIEW_ID_REQUIRED');
  }

  const interview = await getInterviewForUser(interviewId, req.userId);
  const stored = await uploadBuffer(req.file, 'recordings');
  interview.recordingUrl = stored.url;
  await interview.save();

  res.json({ interview, recording: stored });
});
