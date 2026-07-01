import { buildInterviewQuestionSet } from '../services/companyQuestions.service';

describe('company question composition', () => {
  it('always starts interviews with introduce yourself', () => {
    const questions = buildInterviewQuestionSet({
      duration: 15,
      targetCompany: undefined,
      generatedQuestions: [
        {
          question: 'Explain your React project architecture.',
          expectedSignals: ['component structure'],
          questionType: 'technical',
          resumeReference: 'React project',
        },
      ],
    });

    expect(questions[0].question).toBe('Introduce yourself.');
    expect(questions).toHaveLength(2);
  });

  it('adds TCS-specific practice questions after the opener', () => {
    const questions = buildInterviewQuestionSet({
      duration: 30,
      targetCompany: 'tcs',
      generatedQuestions: [
        {
          question: 'Describe your most relevant backend project.',
          expectedSignals: ['ownership'],
          questionType: 'technical',
          resumeReference: 'backend project',
        },
      ],
    });

    expect(questions[0].question).toBe('Introduce yourself.');
    expect(questions[1].question).toContain('TCS');
    expect(questions).toHaveLength(6);
  });

  it('adds finance-specific questions for banking companies', () => {
    const questions = buildInterviewQuestionSet({
      duration: 30,
      targetCompany: 'jpmorgan-chase',
      generatedQuestions: [],
    });

    expect(questions[0].question).toBe('Introduce yourself.');
    expect(questions[1].question).toContain('JPMorgan Chase');
    expect(questions.some((item) => item.resumeReference?.includes('financial'))).toBe(true);
  });

  it('adds healthcare-specific questions for healthcare companies', () => {
    const questions = buildInterviewQuestionSet({
      duration: 30,
      targetCompany: 'medtronic',
      generatedQuestions: [],
    });

    expect(questions[0].question).toBe('Introduce yourself.');
    expect(questions[1].question).toContain('Medtronic');
    expect(questions.some((item) => item.resumeReference?.includes('health'))).toBe(true);
  });

  it('prioritizes generated JD-focused questions when requested', () => {
    const questions = buildInterviewQuestionSet({
      duration: 30,
      targetCompany: 'tcs',
      prioritizeGenerated: true,
      generatedQuestions: [
        {
          question: 'How would you build a React and Node.js feature from this JD?',
          expectedSignals: ['React', 'Node.js'],
          questionType: 'technical',
          resumeReference: 'JD technologies: React, Node.js',
        },
      ],
    });

    expect(questions[0].question).toBe('Introduce yourself.');
    expect(questions[1].resumeReference).toContain('JD technologies');
    expect(questions.some((item) => item.question.includes('TCS'))).toBe(true);
  });
});
