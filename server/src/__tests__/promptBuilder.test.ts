import {
  buildInterviewSystemPrompt,
  formatConversationHistory,
  mapExperienceLevel,
  mapInterviewPromptType,
} from '../services/promptBuilder';
import { getCompanyQuestions, listAvailableCompanyBanks } from '../services/companyQuestionBank';

describe('promptBuilder', () => {
  it('maps experience and interview types', () => {
    expect(mapExperienceLevel('Fresher')).toBe('fresher');
    expect(mapExperienceLevel('Senior')).toBe('experienced');
    expect(mapInterviewPromptType('Technical')).toBe('technical');
    expect(mapInterviewPromptType('Mixed')).toBe('mixed');
  });

  it('includes resume specifics and forbids boilerplate transitions', () => {
    const prompt = buildInterviewSystemPrompt({
      candidateResume: {
        candidateInformation: { name: 'Jane Doe', college: 'IIT Delhi' },
        skills: {
          programmingLanguages: ['Python'],
          frameworks: ['FastAPI'],
          libraries: [],
          databases: ['PostgreSQL'],
          cloudTechnologies: ['AWS'],
          operatingSystems: [],
          developerTools: ['Git'],
          versionControl: ['Git'],
          technicalSkills: ['REST APIs'],
          softSkills: [],
        },
        projects: ['Smart Inventory Tracker — Flask + PostgreSQL'],
        internships: ['Amazon SDE Intern 2024'],
        workExperience: [],
        certifications: [],
        coursework: ['Data Structures'],
        achievements: [],
        hackathons: [],
        researchPapers: [],
        publications: [],
        leadership: [],
        positionsOfResponsibility: [],
        strengths: [],
        areasOfInterest: [],
        interests: [],
      },
      jobDescription: 'Backend engineer with Python and AWS.',
      company: 'Amazon',
      role: 'Software Engineer',
      experienceLevel: 'fresher',
      companyQuestionBank: [
        { question: 'Two-sum style coding question', type: 'coding', source: 'reported 2024' },
      ],
      companyBankMode: 'verified',
      interviewType: 'technical',
      roleLevel: 'Fresher',
    });

    expect(prompt).toContain('Smart Inventory Tracker');
    expect(prompt).toContain('Jane Doe');
    expect(prompt).toContain('VERIFIED REFERENCE QUESTIONS');
    expect(prompt).toContain('DSA/coding');
    expect(prompt).toContain("Let's make that more concrete");
  });

  it('formats conversation history for stateless model calls', () => {
    const history = formatConversationHistory([
      { question: 'Tell me about your project X.', answer: 'I built X using React.' },
    ]);

    expect(history).toContain('Interviewer: Tell me about your project X.');
    expect(history).toContain('Candidate: I built X using React.');
  });

  it('marks generic mode honestly when no verified bank exists', () => {
    const prompt = buildInterviewSystemPrompt({
      candidateResume: { summary: 'Backend developer', skills: ['Node.js'], rawText: 'Built APIs' },
      company: 'Unknown Startup',
      role: 'Software Engineer',
      experienceLevel: 'experienced',
      companyQuestionBank: null,
      companyBankMode: 'none',
      interviewType: 'mixed',
    });

    expect(prompt).toContain('No verified question bank');
    expect(prompt).not.toContain('VERIFIED REFERENCE QUESTIONS');
  });
});

describe('companyQuestionBank', () => {
  it('loads verified Amazon questions for software engineers', () => {
    const result = getCompanyQuestions('Amazon', 'Software Engineer', 'fresher', 4);
    expect(result).not.toBeNull();
    expect(result?.mode).toBe('verified');
    expect(result?.questions.length).toBeGreaterThan(0);
    expect(result?.questions.some((item) => item.type === 'coding')).toBe(true);
  });

  it('falls back to generic pool for unknown companies', () => {
    const result = getCompanyQuestions('Some Unknown Corp', 'Software Engineer', 'fresher', 4);
    expect(result).not.toBeNull();
    expect(result?.mode).toBe('generic');
  });

  it('lists seeded company banks', () => {
    const banks = listAvailableCompanyBanks();
    expect(banks).toEqual(expect.arrayContaining(['amazon', 'google', 'microsoft']));
  });
});
