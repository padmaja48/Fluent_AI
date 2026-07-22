import React from 'react';
import { jsPDF } from 'jspdf';
import { COMPANY_OPTIONS } from '../lib/companyOptions';

/* ── Helpers ─────────────────────────────────────────────────── */
const scoreToDeg = (s) => `${(Math.min(100, Math.max(0, s || 0)) / 100 * 360).toFixed(1)}deg`;
const fmtReportDate = (v) => v
  ? new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  : '—';

const cleanText = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

const safeFilePart = (value) =>
  cleanText(value || 'interview-report')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70) || 'interview-report';

/* Score color based on value */
const scoreColor = (v) => {
  if (v >= 80) return '#10b981';
  if (v >= 60) return '#f59e0b';
  return '#ef4444';
};

const companyLabelByValue = new Map(COMPANY_OPTIONS.map((company) => [company.value, company.label]));

const titleFromSlug = (value) =>
  cleanText(value)
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const getCandidateInfo = (interview = {}) => {
  const user = typeof interview.userId === 'object' && interview.userId !== null ? interview.userId : {};
  return {
    name: cleanText(interview.candidateName || user.name) || 'Candidate',
    email: cleanText(interview.candidateEmail || user.email),
    role: cleanText(interview.roleDomain) || 'Role Not Selected',
    company: cleanText(companyLabelByValue.get(interview.targetCompany) || titleFromSlug(interview.targetCompany)) || 'General Interview',
    interviewType: cleanText(interview.interviewType || interview.interviewStyle) || 'Interview',
    duration: interview.duration ? `${interview.duration} Minutes` : 'Duration Not Selected',
    difficulty: cleanText(interview.complexity) || cleanText(interview.roleLevel) || 'Difficulty Not Selected',
    date: fmtReportDate(interview.completedAt || interview.createdAt),
  };
};

/* ── Metric bar (mirrors practice design) ────────────────────── */
const ScoreBar = ({ label, value, fillClass }) => (
  <div className="skill-bar-row">
    <span className="skill-label">{label}</span>
    <div className="skill-bar-track">
      <div
        className={`skill-bar-fill skill-bar-fill--${fillClass}`}
        style={{ width: `${Math.max(0, Math.min(100, value || 0))}%` }}
      />
    </div>
    <span className="skill-score" style={{ color: scoreColor(value || 0) }}>
      {value != null ? Number(value).toFixed(1) : '—'}
    </span>
  </div>
);

const averageScore = (items) => {
  const scored = (items || []).filter((item) => typeof item.score === 'number');
  if (!scored.length) return null;
  return Math.round(scored.reduce((sum, item) => sum + Number(item.score || 0), 0) / scored.length);
};

const sectionMatches = (item, pattern) =>
  pattern.test(`${item.question || ''} ${item.questionType || ''} ${item.resumeReference || ''} ${item.topic || ''}`);

const clampScore = (value, fallback = 0) =>
  Math.max(0, Math.min(100, Math.round(Number(value ?? fallback) || 0)));

const deriveSectionScores = ({ report, qa, selectedInterview }) => {
  const resumeItems = qa.filter((item) => sectionMatches(item, /resume|project|internship|experience|introduction|background/i));
  const problemItems = qa.filter((item) => sectionMatches(item, /scenario|problem|debug|scale|complexity|design|trade-off|production/i));
  const companyItems = qa.filter((item) => sectionMatches(item, /company|readiness|tcs|amazon|microsoft|google|accenture|deloitte|infosys|jpmorgan/i));
  const hrItems = qa.filter((item) => sectionMatches(item, /behavio|hr|star|conflict|team|communication|motivation|strength/i));
  const companyFallback = selectedInterview?.targetCompany ? report.overallScore : report.communicationScore;

  return [
    { key: 'resume', label: 'Resume Explanation', value: clampScore(averageScore(resumeItems), report.overallScore), note: 'Project and background clarity' },
    { key: 'technical', label: 'Technical Depth', value: clampScore(report.technicalScore, report.overallScore), note: 'Concept accuracy and depth' },
    { key: 'communication', label: 'Communication', value: clampScore(report.communicationScore, report.overallScore), note: 'Clarity, structure, grammar' },
    { key: 'confidence', label: 'Confidence', value: clampScore(report.confidenceScore, report.communicationScore), note: 'Answer control and certainty' },
    { key: 'problem', label: 'Problem Solving', value: clampScore(averageScore(problemItems), report.technicalScore), note: 'Debugging and trade-offs' },
    { key: 'company', label: 'Company Readiness', value: clampScore(averageScore(companyItems), companyFallback), note: 'Company fit and preparation' },
    { key: 'hr', label: 'HR Readiness', value: clampScore(averageScore(hrItems), report.behavioralScore), note: 'STAR stories and maturity' },
  ];
};

const splitFeedbackSentence = (feedback, label) => {
  const match = cleanText(feedback).match(new RegExp(`${label}:\\s*([^.]*(?:\\.[^A-Z]*)?)`, 'i'));
  return cleanText(match?.[1]);
};

const getQuestionFeedbackParts = (item) => {
  const correct = item.whatWorked ||
    splitFeedbackSentence(item.feedback, 'Correct') ||
    item.dynamicFeedback?.strengths?.[0] ||
    ((item.conceptsCovered || []).length ? `Covered ${(item.conceptsCovered || []).slice(0, 3).join(', ')}.` : 'No clear correct concept was recorded.');
  const missing = item.whatToImprove ||
    splitFeedbackSentence(item.feedback, 'Missing') ||
    item.dynamicFeedback?.areasToImprove?.[0] ||
    ((item.missingConcepts || []).length ? `Missing ${(item.missingConcepts || []).slice(0, 3).join(', ')}.` : 'No specific missing concept was recorded.');
  const concepts = Array.from(new Set([
    ...(item.missingConcepts || []),
    ...(item.technicalMistakes || []),
    ...(item.wrongTerminology || []),
    ...(item.dynamicFeedback?.missingConcepts || []),
  ].filter(Boolean))).slice(0, 5);
  const ideal = item.idealAnswer || item.samplePerfectAnswer || 'A strong answer should directly address the question, include a concrete example, mention trade-offs, and explain validation or impact.';
  const improved = item.samplePerfectAnswer || item.idealAnswer || `Improve this answer by covering: ${concepts.join(', ') || 'the expected signals'}, then add one specific project example.`;

  return { correct, missing, ideal, concepts, improved };
};

const deriveLearningRoadmap = ({ report, sectionScores, qa }) => {
  const weakSections = sectionScores.filter((section) => section.value < 70);
  const missed = Array.from(new Set([
    ...(report.missedConcepts || []),
    ...(report.areasForImprovement || []),
    ...qa.flatMap((item) => item.missingConcepts || []),
  ].filter(Boolean))).slice(0, 6);
  const roadmap = [];

  weakSections.forEach((section) => {
    if (section.key === 'technical') roadmap.push('Revise the weakest technical concepts and explain each with one project example.');
    else if (section.key === 'resume') roadmap.push('Practice a 90-second project architecture explanation from problem to outcome.');
    else if (section.key === 'communication') roadmap.push('Practice answers aloud using a clear opening, evidence, and conclusion.');
    else if (section.key === 'confidence') roadmap.push('Reduce hesitant language and state assumptions before answering.');
    else if (section.key === 'problem') roadmap.push('Practice debugging scenarios with steps, metrics, trade-offs, and rollback plan.');
    else if (section.key === 'company') roadmap.push('Prepare company-specific focus areas and connect them to your resume examples.');
    else if (section.key === 'hr') roadmap.push('Improve STAR answers for teamwork, conflict, ownership, and learning stories.');
  });

  missed.slice(0, 4).forEach((item) => roadmap.push(`Revise ${item}.`));
  (report.recommendedLearningResources || report.recommendations || []).slice(0, 3).forEach((item) => roadmap.push(item));

  return Array.from(new Set(roadmap)).slice(0, 7);
};

const downloadInterviewPdf = ({ selectedInterview, report, candidate, qa, sectionScores, learningRoadmap }) => {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const page = {
    width: doc.internal.pageSize.getWidth(),
    height: doc.internal.pageSize.getHeight(),
    margin: 48,
  };
  const contentWidth = page.width - page.margin * 2;
  let y = page.margin;

  const addPageIfNeeded = (needed = 32) => {
    if (y + needed <= page.height - page.margin) return;
    doc.addPage();
    y = page.margin;
  };

  const addText = (text, { size = 10, style = 'normal', color = '#111827', gap = 10, indent = 0 } = {}) => {
    const lines = doc.splitTextToSize(cleanText(text) || '-', contentWidth - indent);
    const lineHeight = size * 1.35;
    addPageIfNeeded(lines.length * lineHeight + gap);
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    doc.setTextColor(color);
    doc.text(lines, page.margin + indent, y);
    y += lines.length * lineHeight + gap;
  };

  const addHeading = (text) => {
    y += y === page.margin ? 0 : 8;
    addText(text, { size: 14, style: 'bold', color: '#111827', gap: 12 });
  };

  const addList = (items) => {
    const values = (items || []).filter(Boolean);
    if (!values.length) {
      addText('- None recorded.', { indent: 10 });
      return;
    }
    values.forEach((item) => addText(`- ${item}`, { indent: 10, gap: 6 }));
    y += 4;
  };

  doc.setFillColor('#4f46e5');
  doc.rect(0, 0, page.width, 90, 'F');
  doc.setTextColor('#ffffff');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('Candidate Interview Report', page.margin, 38);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`${candidate.name} - ${candidate.role} - ${candidate.date}`, page.margin, 62);
  y = 118;

  addHeading('Overview');
  addText(`Overall Score: ${report.overallScore != null ? Number(report.overallScore).toFixed(1) : '-'} / 100`);
  if (candidate.email) addText(`Candidate Email: ${candidate.email}`);
  addText(`Applied Role: ${candidate.role}`);
  addText(`Target Company: ${candidate.company}`);
  addText(`Interview Type: ${candidate.interviewType} | Duration: ${candidate.duration} | Difficulty: ${candidate.difficulty}`);
  addText(`Scores: Communication ${report.communicationScore ?? '-'}, Technical ${report.technicalScore ?? '-'}, Behavioural ${report.behavioralScore ?? '-'}`);

  addHeading('Section-Wise Scorecard');
  sectionScores.forEach((section) => addText(`${section.label}: ${section.value}/100 - ${section.note}`, { gap: 7 }));

  if (report.transcriptSummary) {
    addHeading('AI Summary');
    addText(report.transcriptSummary);
  }

  addHeading('Strengths');
  addList(report.strengths);

  addHeading('Areas to Improve');
  addList(report.improvements);

  if ((report.recommendations || []).length > 0) {
    addHeading('Recommendations');
    addList(report.recommendations);
  }

  addHeading('Personalized Learning Roadmap');
  addList(learningRoadmap);

  addHeading('Question Timeline and Feedback');
  qa.forEach((item, idx) => {
    const feedbackParts = getQuestionFeedbackParts(item);
    addPageIfNeeded(90);
    doc.setDrawColor('#e5e7eb');
    doc.line(page.margin, y, page.width - page.margin, y);
    y += 18;
    addText(`Q${idx + 1}${item.score != null ? ` - Score: ${item.score}/100` : ''}`, { size: 11, style: 'bold', gap: 8 });
    addText(`Question: ${item.question}`, { gap: 8 });
    addText(`Answer: ${item.answer || item.userAnswer || 'No answer recorded'}`, { gap: 8 });
    addText(`What was correct: ${feedbackParts.correct}`, { gap: 8 });
    addText(`What was missing: ${feedbackParts.missing}`, { gap: 8 });
    addText(`Ideal answer: ${feedbackParts.ideal}`, { gap: 8 });
    addText(`Concepts to revise: ${feedbackParts.concepts.length ? feedbackParts.concepts.join(', ') : 'No specific concepts recorded.'}`, { gap: 8 });
    addText(`Suggested improved answer: ${feedbackParts.improved}`, { gap: 12 });
  });

  const fileName = `${safeFilePart(candidate.name)}-${safeFilePart(candidate.role)}-report.pdf`;
  doc.save(fileName);
};

/* ── Main Panel ──────────────────────────────────────────────── */
export const InterviewReportPanel = ({ interviews, selectedInterview, report, onSelect, loading }) => {

  if (!interviews || interviews.length === 0) {
    return (
      <div className="results-empty">
        <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🎤</div>
        <h2>No interview reports yet</h2>
        <p>Complete an AI mock interview to see your detailed report here.</p>
      </div>
    );
  }

  return (
    <div className="practice-layout">

      {/* ── LEFT: Interview list ─────────────────────── */}
      <div className="sessions-panel">
        <div className="sessions-panel-header">
          <h3>Completed Interviews</h3>
          <span className="sessions-panel-count">{interviews.length}</span>
        </div>
        <div className="sessions-list">
          {interviews.map((iv) => {
            const candidate = getCandidateInfo(iv);
            const score = iv.totalScore != null ? Number(iv.totalScore).toFixed(1) : null;
            const isActive = selectedInterview?._id === iv._id;
            return (
              <div
                key={iv._id}
                className={`session-item${isActive ? ' active' : ''}`}
                onClick={() => onSelect(iv._id)}
              >
                <span className="session-item-dot" />
                <div className="session-item-body">
                  <span className="session-item-title">{candidate.name}</span>
                  <span className="session-item-sub">{candidate.role}</span>
                  <span className="session-item-sub">{candidate.company}</span>
                  <span className="session-item-sub">
                    {candidate.interviewType} · {candidate.duration}
                  </span>
                  <span className="session-item-sub">{candidate.date}</span>
                </div>
                {score != null && (
                  <span className="session-item-score" style={{ color: scoreColor(Number(score)) }}>
                    {score}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── RIGHT: Report detail ─────────────────────── */}
      <div className="results-detail">

        {loading && (
          <div className="results-empty" style={{ padding: '60px 20px' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>⏳</div>
            <p>Loading report…</p>
          </div>
        )}

        {!loading && report && selectedInterview && (() => {
          const candidate = getCandidateInfo(selectedInterview);
          const qa = report.questionAnalysis?.length
            ? report.questionAnalysis
            : (selectedInterview.questions || []);
          const sectionScores = deriveSectionScores({ report, qa, selectedInterview });
          const learningRoadmap = deriveLearningRoadmap({ report, sectionScores, qa });

          return (
            <>
              <div className="results-hero report-scorecard-hero">
                <div
                  className="score-ring"
                  style={{ '--score-deg': scoreToDeg(report.overallScore) }}
                >
                  <div className="score-text">
                    {report.overallScore != null ? Number(report.overallScore).toFixed(1) : '—'}
                    <span className="score-text-label">Overall</span>
                  </div>
                </div>
                <div className="results-info">
                  <div className="report-candidate-heading">
                    <h3>{candidate.name}</h3>
                    <p>{candidate.role} Candidate</p>
                    {candidate.email && <span>{candidate.email}</span>}
                  </div>
                  <div className="report-meta-grid">
                    <div><span>Applied Role</span><strong>{candidate.role}</strong></div>
                    <div><span>Target Company</span><strong>{candidate.company}</strong></div>
                    <div><span>Interview Type</span><strong>{candidate.interviewType}</strong></div>
                    <div><span>Duration</span><strong>{candidate.duration}</strong></div>
                    <div><span>Difficulty</span><strong>{candidate.difficulty}</strong></div>
                    <div><span>Interview Date</span><strong>{candidate.date}</strong></div>
                    <div><span>Question Count</span><strong>{qa.length} question{qa.length !== 1 ? 's' : ''}</strong></div>
                    <div><span>Overall Score</span><strong>{report.overallScore != null ? `${Number(report.overallScore).toFixed(1)}%` : '—'}</strong></div>
                  </div>
                  <button
                    type="button"
                    className="report-download-btn"
                    onClick={() => downloadInterviewPdf({ selectedInterview, report, candidate, qa, sectionScores, learningRoadmap })}
                  >
                    Download PDF
                  </button>
                </div>
              </div>

              <section className="report-scorecard-section">
                <div className="report-section-heading">
                  <span>Professional Scorecard</span>
                  <h3>Section-wise interview readiness</h3>
                </div>
                <div className="report-section-score-grid">
                  {sectionScores.map((section) => (
                    <div key={section.key} className="report-section-score-card">
                      <div
                        className="report-mini-ring"
                        style={{
                          '--score-deg': scoreToDeg(section.value),
                          '--score-color': scoreColor(section.value),
                        }}
                      >
                        <strong>{section.value}</strong>
                      </div>
                      <div>
                        <h4>{section.label}</h4>
                        <p>{section.note}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <div className="skill-bars report-metric-bars">
                <p className="skill-bars-title">Core Metrics</p>
                <ScoreBar label="Communication" value={report.communicationScore} fillClass="accuracy" />
                <ScoreBar label="Technical"     value={report.technicalScore}     fillClass="score" />
                <ScoreBar label="Behavioural"   value={report.behavioralScore}    fillClass="completion" />
                <ScoreBar label="Confidence"    value={report.confidenceScore}    fillClass="score" />
              </div>

              {/* Strengths + Improvements — mirrors practice .feedback-cards */}
              <div className="feedback-cards">
                <div className="feedback-card feedback-card--strengths">
                  <h4>Strengths</h4>
                  <ul>
                    {(report.strengths || []).length > 0
                      ? (report.strengths || []).map((s, i) => <li key={i}>{s}</li>)
                      : <li>No specific strengths recorded for this session.</li>
                    }
                  </ul>
                </div>
                <div className="feedback-card feedback-card--focus">
                  <h4>Areas to Improve</h4>
                  <ul>
                    {(report.improvements || []).map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              </div>

              {/* AI Summary */}
              {report.transcriptSummary && (
                <div className="skill-bars" style={{ gap: '0' }}>
                  <p className="skill-bars-title" style={{ marginBottom: '10px' }}>AI Summary</p>
                  <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', lineHeight: '1.7', margin: 0 }}>
                    {report.transcriptSummary}
                  </p>
                </div>
              )}

              {/* Recommendations */}
              {(report.recommendations || []).length > 0 && (
                <div className="skill-bars" style={{ gap: '0' }}>
                  <p className="skill-bars-title" style={{ marginBottom: '12px' }}>Recommendations</p>
                  <ul className="report-recommendations">
                    {report.recommendations.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                </div>
              )}

              <section className="report-scorecard-section report-roadmap-section">
                <div className="report-section-heading">
                  <span>Learning Roadmap</span>
                  <h3>What to practice next</h3>
                </div>
                <ol className="report-roadmap-list">
                  {learningRoadmap.length > 0
                    ? learningRoadmap.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)
                    : <li>Continue practicing role-specific answers and review the lowest question scores.</li>
                  }
                </ol>
              </section>

              {((report.missedConcepts || []).length > 0 || (report.recommendedLearningResources || []).length > 0 || report.hiringRecommendation) && (
                <div className="feedback-cards">
                  <div className="feedback-card feedback-card--focus">
                    <h4>Concepts to Improve</h4>
                    <ul>
                      {(report.missedConcepts || []).length > 0
                        ? report.missedConcepts.slice(0, 8).map((item, i) => <li key={i}>{item}</li>)
                        : <li>No missed concepts recorded.</li>
                      }
                    </ul>
                  </div>
                  <div className="feedback-card feedback-card--strengths">
                    <h4>Next Learning Steps</h4>
                    <ul>
                      {(report.recommendedLearningResources || []).length > 0
                        ? report.recommendedLearningResources.slice(0, 6).map((item, i) => <li key={i}>{item}</li>)
                        : <li>Continue practicing role-specific interview answers.</li>
                      }
                    </ul>
                    {report.hiringRecommendation && (
                      <p style={{ margin: '10px 0 0', fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                        <strong style={{ color: 'var(--text)' }}>Hiring signal:</strong> {report.hiringRecommendation}
                        {report.hiringRecommendationReason ? ` - ${report.hiringRecommendationReason}` : ''}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {(report.difficultyProgression || []).length > 0 && (
                <div className="skill-bars" style={{ gap: '10px' }}>
                  <p className="skill-bars-title" style={{ marginBottom: '4px' }}>Difficulty Progression</p>
                  <div className="report-difficulty-strip">
                    {report.difficultyProgression.map((difficulty, index) => (
                      <span key={`${difficulty}-${index}`}>Q{index + 1}: {difficulty}</span>
                    ))}
                  </div>
                  {report.followUpQuality && (
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
                      {report.followUpQuality}
                    </p>
                  )}
                </div>
              )}

              {/* Q&A Transcript */}
              {qa.length > 0 && (
                <section className="report-scorecard-section" style={{ gap: '12px' }}>
                  <div className="report-section-heading">
                    <span>Question-by-question Feedback</span>
                    <h3>Detailed answer review</h3>
                  </div>
                  {qa.map((item, idx) => {
                    const qScore = item.score;
                    const qColor = qScore != null ? scoreColor(qScore) : 'var(--text-muted)';
                    const feedbackParts = getQuestionFeedbackParts(item);
                    return (
                      <div key={idx} className="report-qa-card">
                        {/* Question header row */}
                        <div className="report-qa-header">
                          <span className="report-q-num">Q{idx + 1}</span>
                          {item.questionType && (
                            <span className={`report-q-type type-${item.questionType}`}>
                              {item.questionType}
                            </span>
                          )}
                          {item.resumeReference && item.resumeReference !== 'general' && (
                            <span className="report-q-ref">{item.resumeReference}</span>
                          )}
                          {qScore != null && (
                            <span className="report-q-score" style={{ color: qColor }}>
                              {qScore}/100
                            </span>
                          )}
                        </div>

                        {/* Question */}
                        <div className="report-question">{item.question}</div>

                        {/* Answer */}
                        <div className="report-answer">
                          {item.answer || item.userAnswer
                            ? (item.answer || item.userAnswer)
                            : <em className="report-no-answer">No answer recorded</em>
                          }
                        </div>

                        <div className="report-answer-feedback-grid">
                          <div className="report-feedback-box report-feedback-box--correct">
                            <span>What was correct</span>
                            <p>{feedbackParts.correct}</p>
                          </div>
                          <div className="report-feedback-box report-feedback-box--missing">
                            <span>What was missing</span>
                            <p>{feedbackParts.missing}</p>
                          </div>
                          <div className="report-feedback-box">
                            <span>Ideal answer</span>
                            <p>{feedbackParts.ideal}</p>
                          </div>
                          <div className="report-feedback-box">
                            <span>Concepts to revise</span>
                            {feedbackParts.concepts.length > 0
                              ? (
                                <div className="report-concept-tags">
                                  {feedbackParts.concepts.map((concept) => <em key={concept}>{concept}</em>)}
                                </div>
                              )
                              : <p>No specific revision concepts recorded.</p>
                            }
                          </div>
                          <div className="report-feedback-box report-feedback-box--wide">
                            <span>Suggested improved answer</span>
                            <p>{feedbackParts.improved}</p>
                          </div>
                        </div>

                        {(item.feedback || item.dynamicFeedback) && (
                          <details className="report-ai-feedback">
                            <summary>Additional evaluator notes</summary>
                            {item.feedback && <p>{item.feedback}</p>}
                            {item.dynamicFeedback?.communication && (
                              <p><strong>Communication:</strong> {item.dynamicFeedback.communication}</p>
                            )}
                            {item.dynamicFeedback?.confidence && (
                              <p><strong>Confidence:</strong> {item.dynamicFeedback.confidence}</p>
                            )}
                            {(item.conceptsCovered || []).length > 0 && (
                              <p><strong>Concepts covered:</strong> {(item.conceptsCovered || []).join(', ')}</p>
                            )}
                            {(item.missingConcepts || []).length > 0 && (
                              <p><strong>Missing concepts:</strong> {(item.missingConcepts || []).join(', ')}</p>
                            )}
                            {(item.technicalMistakes || []).length > 0 && (
                              <p><strong>Technical mistakes:</strong> {(item.technicalMistakes || []).join(', ')}</p>
                            )}
                            {(item.wrongTerminology || []).length > 0 && (
                              <p><strong>Terminology issues:</strong> {(item.wrongTerminology || []).join(', ')}</p>
                            )}
                            {item.dynamicFeedback?.practicalUnderstanding && (
                              <p><strong>Practical understanding:</strong> {item.dynamicFeedback.practicalUnderstanding}</p>
                            )}
                            {item.dynamicFeedback?.interviewReadiness && (
                              <p><strong>Interview readiness:</strong> {item.dynamicFeedback.interviewReadiness}</p>
                            )}
                            {(item.dynamicFeedback?.nextLearningSuggestions || []).length > 0 && (
                              <p><strong>Learning suggestions:</strong> {item.dynamicFeedback.nextLearningSuggestions.join(' ')}</p>
                            )}
                          </details>
                        )}
                      </div>
                    );
                  })}
                </section>
              )}
            </>
          );
        })()}

        {!loading && !report && selectedInterview && (
          <div className="results-empty" style={{ padding: '60px 20px' }}>
            <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📋</div>
            <h2>Report not available</h2>
            <p>The report for this interview could not be loaded.</p>
          </div>
        )}
      </div>
    </div>
  );
};
