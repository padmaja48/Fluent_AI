import { buildJobDescriptionProfile, evaluateAnswer, normalizeTechnicalTranscript } from '../services/ai.service';

describe('adaptive interview engine helpers', () => {
  it('builds a JD-first profile with skill graph signals', () => {
    const profile = buildJobDescriptionProfile(
      'We need a Python backend engineer with FastAPI, SQL, Docker, AWS, and REST APIs. ' +
        'Responsibilities include designing APIs, deploying services, and communicating with stakeholders. 3+ years required.',
      {
        roleLevel: 'Mid',
        roleDomain: 'Backend Engineering',
        resumeSkills: ['Python', 'MongoDB'],
      },
    );

    expect(profile.requiredSkills).toEqual(expect.arrayContaining(['Python', 'FastAPI', 'SQL', 'Docker', 'AWS', 'REST APIs']));
    expect(profile.softSkills).toContain('Communication');
    expect(profile.responsibilities.some((item) => item.toLowerCase().includes('designing apis'))).toBe(true);
    expect(profile.skillGraph.nodes.some((node) => node.skill === 'FastAPI')).toBe(true);
    expect(profile.skillGraph.edges.length).toBeGreaterThan(0);
  });

  it('normalizes technical speech-to-text terms with interview context', () => {
    const text = normalizeTechnicalTranscript('i used fast api with rest api, numpy, postgres and git hub', {
      jobDescription: 'FastAPI, PostgreSQL, REST APIs, GitHub',
      resumeSkills: ['NumPy'],
    });

    expect(text).toContain('FastAPI');
    expect(text).toContain('REST API');
    expect(text).toContain('NumPy');
    expect(text).toContain('PostgreSQL');
    expect(text).toContain('GitHub');
  });

  it('returns comparison fields and a sample perfect answer for skipped answers', async () => {
    const result = await evaluateAnswer('Explain SQL indexes with one practical example.', '(skipped)', {
      expectedSignals: ['index purpose', 'query performance', 'trade-offs'],
      roleDomain: 'Backend Engineering',
      targetCompany: 'Oracle',
      difficulty: 'medium',
      questionType: 'technical',
      topic: 'SQL',
    });

    expect(result.score).toBe(0);
    expect(result.samplePerfectAnswer).toContain('SQL');
    expect(result.missingConcepts).toEqual(expect.arrayContaining(['index purpose', 'query performance', 'trade-offs']));
    expect(result.dynamicFeedback?.areasToImprove.length).toBeGreaterThan(0);
    expect(result.dynamicFeedback?.interviewReadiness).toContain('Not interview-ready');
  });
});
