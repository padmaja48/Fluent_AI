import {
  buildInterviewQuestionSet,
  buildInterviewRoadmap,
  deriveInterviewRuntimeState,
  getInterviewQuestionCount,
} from '../services/companyQuestions.service';

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
    expect(questions).toHaveLength(10);
  });

  it('uses realistic duration-based question counts', () => {
    expect(getInterviewQuestionCount(15)).toBe(10);
    expect(getInterviewQuestionCount(30)).toBe(18);
    expect(getInterviewQuestionCount(45)).toBe(26);
    expect(getInterviewQuestionCount(60)).toBe(34);
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

  it('falls back to roadmap and role questions for unknown companies', () => {
    const roadmap = buildInterviewRoadmap({
      roleDomain: 'AI Engineer',
      roleLevel: 'Mid',
      duration: 15,
      complexity: 'Intermediate',
      targetCompany: 'Example Labs',
      resumeSkills: ['Python', 'Machine Learning', 'RAG'],
    });
    const questions = buildInterviewQuestionSet({
      duration: 15,
      targetCompany: 'Example Labs',
      generatedQuestions: [],
      interviewRoadmap: roadmap,
    });

    expect(questions[0].question).toBe('Introduce yourself.');
    expect(questions.some((item) => item.resumeReference?.startsWith('Role-specific Questions:'))).toBe(true);
    expect(questions.some((item) => item.resumeReference?.startsWith('Company-specific Questions:'))).toBe(true);
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

  it('builds an internal roadmap from resume projects, skills, internship, and certifications', () => {
    const roadmap = buildInterviewRoadmap({
      roleDomain: 'Full Stack Developer',
      roleLevel: 'Fresher',
      duration: 30,
      complexity: 'Intermediate',
      targetCompany: 'amazon',
      resumeSkills: ['Python', 'React', 'Node.js', 'SQL', 'AWS'],
      resumeText: [
        'Padma Rao',
        'Education',
        'B.Tech Computer Science, Fluent Institute, CGPA: 8.7',
        'Projects',
        'AI Mock Interview Engine - React, Node.js, MongoDB, OpenAI',
        'Expense Tracker Platform - Python, SQL, AWS',
        'Internship',
        'Software Developer Intern at Acme Labs - built REST APIs',
        'Certifications',
        'AWS Cloud Practitioner',
        'Google AI Essentials',
      ].join('\n'),
    });

    expect(roadmap.targetQuestionCount).toBe(18);
    expect(roadmap.sections.map((section) => section.key)).toEqual(
      expect.arrayContaining(['projects', 'internship', 'certifications', 'company_specific', 'behavioral', 'hr']),
    );
    expect(roadmap.resumeProfile.projects).toEqual(expect.arrayContaining(['AI Mock Interview Engine', 'Expense Tracker Platform']));
    expect(roadmap.resumeProfile.certifications).toEqual(expect.arrayContaining(['AWS Cloud Practitioner', 'Google AI Essentials']));

    const questions = buildInterviewQuestionSet({
      duration: 30,
      targetCompany: 'amazon',
      generatedQuestions: [],
      interviewRoadmap: roadmap,
    });

    expect(questions).toHaveLength(18);
    expect(questions.some((question) => question.resumeReference?.startsWith('Projects:'))).toBe(true);
    expect(questions.some((question) => question.resumeReference?.startsWith('Certifications:'))).toBe(true);
  });

  it('adds at least one connected skill-coverage question for every detected technical skill', () => {
    const skills = ['Python', 'SQL', 'JavaScript', 'React', 'AWS', 'Machine Learning'];
    const roadmap = buildInterviewRoadmap({
      roleDomain: 'AI Engineer',
      roleLevel: 'Mid',
      duration: 30,
      complexity: 'Intermediate',
      resumeSkills: skills,
      resumeText: ['Projects', 'ML Dashboard - Python, SQL, JavaScript, React, AWS, Machine Learning'].join('\n'),
    });

    const questions = buildInterviewQuestionSet({
      duration: 30,
      targetCompany: undefined,
      generatedQuestions: [],
      interviewRoadmap: roadmap,
    });

    skills.forEach((skill) => {
      expect(questions.some((question) => question.resumeReference === `Skill coverage: ${skill}`)).toBe(true);
    });
    const coverageBlock = questions.slice(1, 1 + skills.length);
    expect(coverageBlock.every((question) => question.resumeReference?.startsWith('Skill coverage:'))).toBe(true);
  });

  it('derives runtime state with completed projects and covered concepts', () => {
    const roadmap = buildInterviewRoadmap({
      roleDomain: 'Backend Developer',
      roleLevel: 'Mid',
      duration: 30,
      complexity: 'Intermediate',
      resumeText: ['Projects', 'Payment API - Node.js and SQL', 'Analytics Worker - Python'].join('\n'),
      resumeSkills: ['Node.js', 'SQL', 'Python'],
    });

    const state = deriveInterviewRuntimeState({
      roadmap,
      transcript: [
        { question: 'Explain Payment API architecture.', topic: 'Payment API' },
        { question: 'What was hard in Payment API?', topic: 'Payment API' },
        { question: 'How did Payment API scale?', topic: 'Payment API' },
        { question: 'Explain SQL indexes.', topic: 'SQL' },
      ],
    });

    expect(state.projects_completed).toContain('Payment API');
    expect(state.skills_completed).toContain('SQL');
    expect(state.questions_asked).toBe(4);
    expect(state.remaining_time).toBeGreaterThan(0);
  });
});
