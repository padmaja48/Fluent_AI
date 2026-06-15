import { z } from 'zod';
import { getRedis } from '../config/redis';
import { Interview } from '../models/Interview';
import { Report } from '../models/Report';
import { Resume } from '../models/Resume';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import { evaluateAnswer, generateInterviewQuestions, generateReport, transcribeAudio } from '../services/ai.service';
import { uploadBuffer, uploadText } from '../services/storage.service';
import { getPersonaIntro, getPersonaVoiceStyle, normalizeSarvamSpeaker, synthesizeSpeech } from '../services/voice.service';

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
    roleLevel: z.enum(['Fresher', 'Mid', 'Senior', 'Lead']),
    roleDomain: z.string().min(2),
    interviewStyle: z.string().min(2).default('Mixed'),
    duration: z.coerce.number().int().min(15).max(60).default(30),
    personaId: z.enum(['us-american', 'us-indian', 'us-australian', 'ru-russian']).optional(),
    interviewType: z.enum(['Behavioural', 'Technical', 'Mixed']).optional(),
    complexity: z.enum(['Beginner', 'Intermediate', 'Advanced']).optional(),
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
    speaker: z.enum(['priya', 'rahul', 'meera', 'arjun']).optional(),
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

  const interview = await Interview.create({
    userId: req.userId,
    ...req.body,
    resumeText,
    resumeSkills,
    resumeExperienceLevel,
    resumeSuggestedQuestions,
    resumeSummary,
    status: 'Setup',
  });

  res.status(201).json(interview);
});

export const getUserInterviews = asyncHandler(async (req, res) => {
  const interviews = await Interview.find({ userId: req.userId }).sort({ createdAt: -1 });
  res.json(interviews);
});

export const getInterview = asyncHandler(async (req, res) => {
  const interviewId = requestedInterviewId(req);
  if (!interviewId) {
    throw new AppError('Interview id is required', 400, 'INTERVIEW_ID_REQUIRED');
  }

  const interview = await getInterviewForUser(interviewId, req.userId);
  res.json(interview);
});

export const startInterview = asyncHandler(async (req, res) => {
  const interviewId = requestedInterviewId(req);
  if (!interviewId) {
    throw new AppError('Interview id is required', 400, 'INTERVIEW_ID_REQUIRED');
  }

  const interview = await getInterviewForUser(interviewId, req.userId);

  if (interview.questions.length === 0) {
    const generated = await generateInterviewQuestions({
      roleLevel: interview.roleLevel,
      roleDomain: interview.roleDomain,
      interviewStyle: (interview as any).interviewType ?? interview.interviewStyle,
      duration: interview.duration,
      resumeText: interview.resumeText,
      personaId: (interview as any).personaId,
      personaPersonality: getPersonaPersonality((interview as any).personaId),
      interviewType: (interview as any).interviewType,
      complexity: (interview as any).complexity,
      resumeSkills: (interview as any).resumeSkills ?? [],
      resumeExperienceLevel: (interview as any).resumeExperienceLevel ?? '',
      resumeSuggestedQuestions: (interview as any).resumeSuggestedQuestions ?? [],
      resumeSummary: (interview as any).resumeSummary ?? '',
    });

    interview.questions = generated.questions;
  }

  interview.status = 'In Progress';
  interview.startedAt = interview.startedAt ?? new Date();
  await interview.save();

  const state = {
    status: interview.status,
    currentQuestionIndex: interview.currentQuestionIndex,
    currentQuestion: interview.questions[interview.currentQuestionIndex],
    totalQuestions: interview.questions.length,
  };

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

  const evaluation = await evaluateAnswer(currentQuestion, req.body.answer);

  if (interview.questions[questionIndex]) {
    interview.questions[questionIndex].userAnswer = req.body.answer;
    interview.questions[questionIndex].feedback = evaluation.feedback;
    interview.questions[questionIndex].score = evaluation.score;
  } else {
    interview.questions.push({
      question: currentQuestion,
      userAnswer: req.body.answer,
      feedback: evaluation.feedback,
      score: evaluation.score,
    });
  }

  interview.currentQuestionIndex = questionIndex + 1; // may exceed length; that signals completion
  await interview.save();

  const state = {
    status: interview.status,
    currentQuestionIndex: interview.currentQuestionIndex,
    currentQuestion: interview.questions[interview.currentQuestionIndex],
    totalQuestions: interview.questions.length,
  };

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
  res.json(cached ? JSON.parse(cached) : { status: interview.status, currentQuestionIndex: interview.currentQuestionIndex });
});

export const synthesizeQuestion = asyncHandler(async (req, res) => {
  const interviewId = requestedInterviewId(req);
  if (!interviewId) {
    throw new AppError('Interview id is required', 400, 'INTERVIEW_ID_REQUIRED');
  }

  await getInterviewForUser(interviewId, req.userId);
  const audio = await synthesizeSpeech(req.body.text, req.body.voiceStyle, undefined, req.body.speaker, {
    context: 'interview',
    pace: 1.0,
  });
  res.setHeader('X-TTS-Cache-Key', audio.cacheKey);
  res.setHeader('Cache-Control', 'private, max-age=86400');
  res.type(audio.contentType).send(audio.buffer);
});

/* ── Persona voice preview (no interview session required) ─────── */
export const personaPreviewSchema = z.object({
  body: z.object({
    personaId: z.enum(['us-american', 'us-indian', 'us-australian', 'ru-russian']),
    speaker: z.enum(['priya', 'rahul', 'meera', 'arjun']).optional(),
  }),
});

export const personaVoicePreview = asyncHandler(async (req, res) => {
  const { personaId } = req.body as { personaId: string };
  const speaker = req.body.speaker ? normalizeSarvamSpeaker(req.body.speaker) : undefined;
  const intro = getPersonaIntro(personaId);
  const voiceStyle = getPersonaVoiceStyle(personaId);
  const audio = await synthesizeSpeech(intro, voiceStyle, personaId, speaker, {
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

  await getInterviewForUser(interviewId, req.userId);
  const transcription = await transcribeAudio(req.file);
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
