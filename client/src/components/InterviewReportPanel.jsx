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

const downloadInterviewPdf = ({ selectedInterview, report, candidate, qa }) => {
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

  addHeading('Question Timeline and Feedback');
  qa.forEach((item, idx) => {
    addPageIfNeeded(90);
    doc.setDrawColor('#e5e7eb');
    doc.line(page.margin, y, page.width - page.margin, y);
    y += 18;
    addText(`Q${idx + 1}${item.score != null ? ` - Score: ${item.score}/100` : ''}`, { size: 11, style: 'bold', gap: 8 });
    addText(`Question: ${item.question}`, { gap: 8 });
    addText(`Answer: ${item.answer || item.userAnswer || 'No answer recorded'}`, { gap: 8 });
    if (item.feedback) addText(`Feedback: ${item.feedback}`, { gap: 8 });
    if (item.whatWorked) addText(`What worked: ${item.whatWorked}`, { gap: 8 });
    if (item.whatToImprove) addText(`Improve: ${item.whatToImprove}`, { gap: 12 });
    if ((item.missingConcepts || []).length > 0) addText(`Missing concepts: ${(item.missingConcepts || []).join(', ')}`, { gap: 8 });
    if ((item.technicalMistakes || []).length > 0) addText(`Technical mistakes: ${(item.technicalMistakes || []).join(', ')}`, { gap: 8 });
    if (item.samplePerfectAnswer) addText(`Sample perfect answer: ${item.samplePerfectAnswer}`, { gap: 12 });
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

          return (
            <>
              {/* Hero score card — mirrors practice .results-hero */}
              <div className="results-hero">
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
                    onClick={() => downloadInterviewPdf({ selectedInterview, report, candidate, qa })}
                  >
                    Download PDF
                  </button>
                </div>
              </div>

              {/* Score breakdown bars — mirrors practice .skill-bars */}
              <div className="skill-bars">
                <p className="skill-bars-title">Score Breakdown</p>
                <ScoreBar label="Communication" value={report.communicationScore} fillClass="accuracy" />
                <ScoreBar label="Technical"     value={report.technicalScore}     fillClass="score" />
                <ScoreBar label="Behavioural"   value={report.behavioralScore}    fillClass="completion" />
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

              {/* Q&A Transcript */}
              {qa.length > 0 && (
                <div className="skill-bars" style={{ gap: '12px' }}>
                  <p className="skill-bars-title" style={{ marginBottom: '4px' }}>
                    Full Q&amp;A Transcript · AI Feedback
                  </p>
                  {qa.map((item, idx) => {
                    const qScore = item.score;
                    const qColor = qScore != null ? scoreColor(qScore) : 'var(--text-muted)';
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

                        {/* AI feedback block */}
                        {(item.feedback || item.whatWorked || item.whatToImprove) && (
                          <div className="report-ai-feedback">
                            <div className="report-feedback-label">AI Feedback</div>
                            {item.feedback && <p>{item.feedback}</p>}
                            {item.whatWorked && (
                              <div className="report-micro-row green">{item.whatWorked}</div>
                            )}
                            {item.whatToImprove && (
                              <div className="report-micro-row amber">{item.whatToImprove}</div>
                            )}
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
                            {item.samplePerfectAnswer && (
                              <>
                                <div className="report-feedback-label">Sample Perfect Answer</div>
                                <p>{item.samplePerfectAnswer}</p>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
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
