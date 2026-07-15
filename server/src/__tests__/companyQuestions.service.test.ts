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

    expect(roadmap.targetQuestionCount).toBeGreaterThanOrEqual(18);
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

    expect(questions).toHaveLength(roadmap.targetQuestionCount);
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

    const firstFourAfterIntro = questions.slice(1, 5).map((question) => question.resumeReference ?? '');
    expect(firstFourAfterIntro.some((reference) => /^Role-specific Questions|Projects|Internship \/ Work Experience|Certifications/.test(reference))).toBe(true);
    expect(firstFourAfterIntro.filter((reference) => /^Skill coverage:/.test(reference))).toHaveLength(1);
  });

  it('uses role-specific marketing questions instead of coding prompts for digital marketing interviews', () => {
    const roadmap = buildInterviewRoadmap({
      roleDomain: 'digital marketing',
      roleLevel: 'Fresher',
      duration: 45,
      complexity: 'Advanced',
      targetCompany: 'flipkart',
      resumeSkills: ['SEO', 'Google Ads', 'Social Media Marketing', 'Google Analytics'],
    });

    const questions = buildInterviewQuestionSet({
      duration: 45,
      targetCompany: 'flipkart',
      generatedQuestions: [],
      interviewRoadmap: roadmap,
    });

    const questionText = questions.map((question) => question.question).join(' ');
    expect(questionText).toContain('digital marketing');
    expect(questionText).toContain('SEO');
    expect(questionText).not.toMatch(/coding-style|Data Structures|Algorithms|complexity|engineers|production-ready|technical interview/i);
    expect(questions.some((question) => question.resumeReference?.startsWith('Role Scenario / Problem Solving:'))).toBe(true);
  });

  it('keeps fresher software interviews grounded in resume skills without generic system design', () => {
    const roadmap = buildInterviewRoadmap({
      roleDomain: 'Software Engineering',
      roleLevel: 'Fresher',
      duration: 15,
      complexity: 'Beginner',
      resumeSkills: ['Artificial Intelligence', 'Machine Learning', 'Python'],
      resumeText: [
        'Padmaja',
        'Education',
        'B.Tech Artificial Intelligence and Machine Learning',
        'Projects',
        'AI Interview Platform - Python and Machine Learning',
        'Internship',
        'AI Intern at Intellibiotics',
      ].join('\n'),
    });

    const questions = buildInterviewQuestionSet({
      duration: 15,
      generatedQuestions: [],
      interviewRoadmap: roadmap,
    });

    const questionText = questions.map((question) => question.question).join(' ');
    expect(roadmap.sections.some((section) => section.key === 'system_design')).toBe(false);
    expect(questionText).toMatch(/Artificial Intelligence|Machine Learning|Python|AI Interview Platform/i);
    expect(questionText).not.toMatch(/system design|Design around Scalability|cover APIs, storage, scaling/i);
    expect(questionText).not.toContain('approach Software Engineering from requirements to implementation and testing');
    expect(questions.some((question) => question.resumeReference === 'Role-specific Questions: Software Engineering')).toBe(false);
    expect(questions.some((question) => question.resumeReference === 'Role focus: Software Engineering')).toBe(false);
  });

  it('does not ask repeated skill-checklist questions back to back', () => {
    const roadmap = buildInterviewRoadmap({
      roleDomain: 'Software Engineering',
      roleLevel: 'Fresher',
      duration: 15,
      complexity: 'Beginner',
      resumeSkills: ['Python', 'TypeScript', 'SQL'],
      resumeText: ['Projects', 'AI Interview Platform - Python, TypeScript, SQL'].join('\n'),
    });

    const questions = buildInterviewQuestionSet({
      duration: 15,
      generatedQuestions: [],
      interviewRoadmap: roadmap,
    });

    const firstThreeAfterIntro = questions.slice(1, 4).map((question) => question.resumeReference ?? '');
    expect(firstThreeAfterIntro.filter((reference) => /^Skill coverage:/.test(reference)).length).toBeLessThan(3);
    expect(questions.map((question) => question.question).join(' ')).not.toMatch(/let's evaluate your .* skills/i);
  });

  it('uses data analyst resume skills instead of generic debugging prompts', () => {
    const roadmap = buildInterviewRoadmap({
      roleDomain: 'Data Analyst',
      roleLevel: 'Fresher',
      duration: 15,
      complexity: 'Beginner',
      resumeSkills: ['SQL', 'Power BI', 'Excel', 'Python'],
      resumeText: [
        'Padmaja',
        'Internship',
        'Data Analyst Intern at Telebotics',
        'Worked with SQL, Power BI, Excel, and Python to clean data and create dashboards.',
      ].join('\n'),
    });

    const questions = buildInterviewQuestionSet({
      duration: 15,
      generatedQuestions: [],
      interviewRoadmap: roadmap,
    });

    const questionText = questions.map((question) => question.question).join(' ');
    expect(questionText).toMatch(/SQL|Power BI|Excel|Python|dashboard|data cleaning/i);
    expect(questionText).not.toMatch(/involving debugging|debug them|debug or prevent|role responsibilities/i);
    expect(questions.some((question) => question.resumeReference === 'Role-specific Questions: role responsibilities')).toBe(false);
    expect(questions.some((question) => question.resumeReference === 'Role focus: role responsibilities')).toBe(false);
  });

  it('makes selected role and resume skills the majority of interview questions', () => {
    const roadmap = buildInterviewRoadmap({
      roleDomain: 'digital marketing',
      roleLevel: 'Fresher',
      duration: 15,
      complexity: 'Beginner',
      targetCompany: 'flipkart',
      resumeSkills: ['SEO'],
    });

    const questions = buildInterviewQuestionSet({
      duration: 15,
      targetCompany: 'flipkart',
      generatedQuestions: [],
      interviewRoadmap: roadmap,
    });
    const roleOrSkillQuestions = questions.filter((question) =>
      /^(Skill coverage|Skill deep dive|Skill production scenario|Role-specific Questions|Role Scenario \/ Problem Solving|Role focus|Role follow-up):/i.test(question.resumeReference ?? ''),
    );

    expect(roleOrSkillQuestions.length).toBeGreaterThan(questions.length / 2);
    expect(questions.some((question) => question.resumeReference?.startsWith('Company-specific Questions:'))).toBe(true);
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

  it('extracts coursework and interests into the resume interview profile', () => {
    const roadmap = buildInterviewRoadmap({
      roleDomain: 'Software Engineer',
      roleLevel: 'Fresher',
      duration: 20,
      complexity: 'Beginner',
      resumeSkills: ['Python'],
      resumeText: [
        'Education',
        'B.Tech Computer Science, Example Institute, CGPA: 8.9',
        'Relevant Coursework',
        'Data Structures and Algorithms',
        'Database Management Systems',
        'Areas of Interest',
        'AI product development',
      ].join('\n'),
    });

    expect(roadmap.resumeProfile.candidateInformation.cgpa).toBe('8.9');
    expect(roadmap.resumeProfile.coursework).toEqual(expect.arrayContaining(['Data Structures and Algorithms', 'Database Management Systems']));
    expect(roadmap.resumeProfile.interests).toContain('AI product development');
    expect(roadmap.sections.some((section) => section.key === 'coursework')).toBe(true);
  });

  it('starts each important project with an architecture question before deeper project prompts', () => {
    const roadmap = buildInterviewRoadmap({
      roleDomain: 'Full Stack Developer',
      roleLevel: 'Fresher',
      duration: 30,
      complexity: 'Intermediate',
      resumeSkills: ['React', 'Node.js', 'MongoDB'],
      resumeText: [
        'Projects',
        'Blood Donation Platform - React, Node.js, MongoDB',
        'PDF Knowledge Chatbot - LangChain, Python, Vector Databases',
      ].join('\n'),
    });

    const questions = buildInterviewQuestionSet({
      duration: 30,
      generatedQuestions: [],
      interviewRoadmap: roadmap,
    });

    const bloodQuestion = questions.find((question) => question.resumeReference === 'Projects: Blood Donation Platform');
    const chatbotQuestion = questions.find((question) => question.resumeReference === 'Projects: PDF Knowledge Chatbot');

    expect(bloodQuestion?.question).toMatch(/complete architecture|user entry point|flow/i);
    expect(chatbotQuestion?.question).toMatch(/complete architecture|user entry point|flow/i);
  });

  it('keeps interview order resume-led before role and company sections', () => {
    const roadmap = buildInterviewRoadmap({
      roleDomain: 'Software Development',
      roleLevel: 'Fresher',
      duration: 30,
      complexity: 'Intermediate',
      targetCompany: 'microsoft',
      resumeSkills: ['React', 'Node.js', 'SQL'],
      resumeText: [
        'Education',
        'B.Tech Computer Science',
        'Projects',
        'Interview Intelligence Engine - React, Node.js, SQL',
        'Internship',
        'Software Developer Intern at Fluent AI',
        'Certifications',
        'HackerRank SQL Basic',
      ].join('\n'),
    });

    const questions = buildInterviewQuestionSet({
      duration: 30,
      targetCompany: 'microsoft',
      generatedQuestions: [],
      interviewRoadmap: roadmap,
    });

    const references = questions.map((question) => question.resumeReference ?? '');
    const firstRoleIndex = references.findIndex((reference) => /^(Role-specific Questions|Role Scenario \/ Problem Solving|Coding \/ Problem Solving|Company-specific Questions):/.test(reference));
    const projectIndex = references.findIndex((reference) => reference.startsWith('Projects:'));
    const internshipIndex = references.findIndex((reference) => reference.startsWith('Internship / Work Experience:'));
    const certIndex = references.findIndex((reference) => reference.startsWith('Certifications:'));

    expect(references[0]).toBe('candidate overview');
    expect(projectIndex).toBeGreaterThan(0);
    expect(internshipIndex).toBeGreaterThan(projectIndex);
    expect(certIndex).toBeGreaterThan(internshipIndex);
    expect(firstRoleIndex).toBeGreaterThan(projectIndex);
  });

  it('uses practical company fallback wording instead of disconnected definition questions', () => {
    const questions = buildInterviewQuestionSet({
      duration: 30,
      targetCompany: 'tcs',
      generatedQuestions: [],
    });

    const questionText = questions.map((question) => question.question).join(' ');

    expect(questionText).not.toMatch(/\bWhat is OOP\b|\bWhat is Python\b|\bWhat is SQL\b|Difference between GET and POST/i);
    expect(questionText).toMatch(/coursework|projects|TCS-style/i);
  });
});
