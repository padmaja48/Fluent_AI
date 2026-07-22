export type AnswerTurnType = 'answered_well' | 'answered_weakly' | 'clarification_request' | 'deflected';

export const normalizeQuestionText = (text: string) =>
  String(text || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[?.!]+$/g, '');

export const isNearDuplicateQuestion = (left: string, right: string) => {
  const normalizedLeft = normalizeQuestionText(left);
  const normalizedRight = normalizeQuestionText(right);
  if (!normalizedLeft || !normalizedRight) return false;
  if (normalizedLeft === normalizedRight) return true;
  if (normalizedLeft.length > 40 && normalizedRight.length > 40) {
    return normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft);
  }
  return false;
};

export const dedupeTranscriptItems = <T extends { question: string }>(items: T[]): T[] => {
  const deduped: T[] = [];
  for (const item of items) {
    const previous = deduped[deduped.length - 1];
    if (previous && isNearDuplicateQuestion(previous.question, item.question)) continue;
    deduped.push(item);
  }
  return deduped;
};

export const isSelfIntroductionQuestion = (question: string) =>
  /tell me about yourself|introduce yourself|walk me through your (background|education)|who are you/i.test(question);

export const extractSpeakerNameFromAnswer = (
  answer: string,
  _question?: string,
): { name: string | null; confidence: 'high' | 'medium' | 'low' } => {
  const text = String(answer || '').trim();
  if (text.length < 5) return { name: null, confidence: 'low' };

  const patterns = [
    /\b(?:my name is|i am|i'm|this is|call me)\s+([A-Za-z]+(?:\s+[A-Za-z]+){0,3})/i,
    /^([A-Za-z]+(?:\s+[A-Za-z]+){0,3})(?:,|\s+and\s|\s+here\b)/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match?.[1]) continue;
    const name = match[1]
      .trim()
      .replace(/\b(?:sir|madam|ma'am|here)\b/gi, '')
      .trim();
    const words = name.split(/\s+/).filter(Boolean);
    if (words.length >= 1 && words.length <= 4 && name.length >= 3) {
      return {
        name: words.map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join(' '),
        confidence: /\b(?:my name is|i am|i'm)\b/i.test(text) ? 'high' : 'medium',
      };
    }
  }

  return { name: null, confidence: 'low' };
};

export const classifyAnswerTurn = (answer: string): AnswerTurnType => {
  const text = String(answer || '').toLowerCase();
  if (
    /could you explain|did not understand|don't understand|do not understand|can you repeat|what do you mean|second part of the question|clarify|explain me that|explain that part/i.test(
      text,
    )
  ) {
    return 'clarification_request';
  }
  if (/don't know|do not know|not sure|skip|no idea|pass\b|can't answer|cannot answer/i.test(text) && text.length < 90) {
    return 'deflected';
  }
  if (text.trim().split(/\s+/).filter(Boolean).length < 25) return 'answered_weakly';
  return 'answered_well';
};

export const inferQuestionTypeFromContent = (
  question: string,
  interviewMode?: string,
  declaredType?: string,
): 'behavioural' | 'technical' | 'situational' => {
  const normalized = String(question || '').toLowerCase();

  if (
    /tell me about a time|star|conflict|teamwork|motivation|strength|weakness|career goal|why (this|our) (role|company)|behavio|communication style|working with others/i.test(
      normalized,
    )
  ) {
    return 'behavioural';
  }
  if (/scenario|suppose|what would you do if|production incident|under load|if .* fail/i.test(normalized)) {
    return 'situational';
  }
  if (
    /algorithm|complexity|implement|write code|coding|data structure|leetcode|sql query|architecture|debug|system design|api design|time complexity|space complexity/i.test(
      normalized,
    )
  ) {
    return 'technical';
  }
  if (interviewMode === 'hr_behavioral') return 'behavioural';
  if (declaredType === 'behavioural' || declaredType === 'behavioral') return 'behavioural';
  if (declaredType === 'situational') return 'situational';
  if (declaredType === 'technical') return 'technical';
  if (/how did .+ factor in|what would you do differently today/i.test(normalized)) {
    return interviewMode === 'hr_behavioral' ? 'behavioural' : 'situational';
  }
  return 'behavioural';
};

export const buildClarificationIdealAnswer = (question: string, coreIdeal: string) =>
  `When a question is unclear, briefly restate what you understood and ask which part needs clarification. After the interviewer clarifies "${question}", answer directly: ${coreIdeal}`;

export const buildDifficultyProgressionSummary = (
  transcript: Array<{ difficulty?: string; score?: number }>,
): string[] =>
  transcript.map((item, index) => {
    const difficulty = item.difficulty || 'medium';
    const score = item.score ?? 0;
    const label = difficulty.replace(/-/g, ' ');
    if (score >= 70) return `Q${index + 1} (${label}): Strong response with clear evidence.`;
    if (score >= 45) return `Q${index + 1} (${label}): Partial answer; depth or structure needs work.`;
    if (score > 0) return `Q${index + 1} (${label}): Weak answer; key points were missing.`;
    return `Q${index + 1} (${label}): Not answered or too vague to score.`;
  });

export const computeCompanyReadinessScore = (
  transcript: Array<{ answer?: string; score?: number }>,
  options: { targetCompany?: string; overallScore: number },
): number => {
  const answered = transcript.filter((item) => String(item.answer || '').trim().length >= 10);
  if (!answered.length) return Math.max(0, Math.round(options.overallScore * 0.45));

  const companyToken = String(options.targetCompany || '')
    .toLowerCase()
    .replace(/[-_]+/g, ' ')
    .trim()
    .split(/\s+/)[0];

  let companySignals = 0;
  let roleFitSignals = 0;
  let scoreSum = 0;

  for (const item of answered) {
    const answer = String(item.answer || '').toLowerCase();
    scoreSum += item.score ?? 0;
    if (companyToken && answer.includes(companyToken)) companySignals += 1;
    if (/\b(researched|read about|mission|values|culture|customers|why this company|why here|why join)\b/i.test(answer)) {
      companySignals += 1;
    }
    if (/\b(internship|project|experience|implemented|collaborated|stakeholder|managed|delivered)\b/i.test(answer)) {
      roleFitSignals += 1;
    }
  }

  const averageScore = scoreSum / answered.length;
  const mentionRatio = companyToken ? Math.min(1, companySignals / Math.max(1, answered.length)) : 0.35;
  const roleFitRatio = Math.min(1, roleFitSignals / answered.length);
  const readiness = averageScore * 0.55 + mentionRatio * 100 * 0.25 + roleFitRatio * 100 * 0.2;
  const rounded = Math.round(Math.max(0, Math.min(100, readiness)));

  if (options.targetCompany && rounded === Math.round(options.overallScore) && companySignals === 0) {
    return Math.max(0, rounded - 10);
  }
  return rounded;
};

export const aggregateSessionStrengths = (
  transcript: Array<{
    score?: number;
    answer?: string;
    dynamicFeedback?: { strengths?: string[] };
  }>,
  whatWorkedList: string[] = [],
): string[] => {
  const perQuestion = transcript.flatMap((item) => item.dynamicFeedback?.strengths || []).filter(Boolean);
  const fromWhatWorked = whatWorkedList.filter(
    (item) => item && !/nothing|no specific|no answer|no meaningful|not recorded/i.test(item),
  );
  const strengths = [...new Set([...perQuestion, ...fromWhatWorked])].slice(0, 4);

  if (transcript.length > 0 && transcript.every((item) => String(item.answer || '').trim().length > 0)) {
    strengths.push('Attempted every question in the session without skipping the flow.');
  }
  if (transcript.some((item) => classifyAnswerTurn(String(item.answer || '')) === 'clarification_request')) {
    strengths.push('Asked for clarification when a question was unclear instead of guessing blindly.');
  }
  if (strengths.length === 0 && transcript.some((item) => (item.score ?? 0) > 0)) {
    strengths.push('Provided at least partial relevant content on some questions.');
  }
  if (strengths.length === 0) {
    strengths.push('Stayed engaged through the interview and completed the session.');
  }

  return [...new Set(strengths)].slice(0, 4);
};
