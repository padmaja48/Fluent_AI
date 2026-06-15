import React from 'react';

/* ── Helpers ─────────────────────────────────────────────────── */
const scoreToDeg = (s) => `${(Math.min(100, Math.max(0, s || 0)) / 100 * 360).toFixed(1)}deg`;
const fmtDt = (v) => v
  ? new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  : '—';

const PERSONA_NAMES = {
  'us-indian':    { name: 'Priya Sharma', title: 'Engineering Manager' },
  'us-australian':{ name: 'Ananya Rao', title: 'Product Director' },
  'ru-russian':   { name: 'Rahul Menon', title: 'Principal Engineer' },
  'us-american':  { name: 'Ryan Carter', title: 'Senior Tech Lead' },
};

const getPersona = (id) => PERSONA_NAMES[id] || { name: id || 'Interviewer', title: 'AI Interviewer' };

/* Score color based on value */
const scoreColor = (v) => {
  if (v >= 80) return '#10b981';
  if (v >= 60) return '#f59e0b';
  return '#ef4444';
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
            const p = getPersona(iv.personaId);
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
                  <span className="session-item-title">{p.name}</span>
                  <span className="session-item-sub">{p.title}</span>
                  <span className="session-item-sub">
                    {iv.interviewType || iv.interviewStyle} · {iv.duration} min
                  </span>
                  <span className="session-item-sub">{fmtDt(iv.completedAt || iv.createdAt)}</span>
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
          const p = getPersona(selectedInterview.personaId);
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
                  <h3>{p.name} · {p.title}</h3>
                  <p>{selectedInterview.interviewType || selectedInterview.interviewStyle} interview · {selectedInterview.duration} min</p>
                  <p>{selectedInterview.roleDomain} · {selectedInterview.roleLevel}</p>
                  <div className="results-info-badges">
                    <span className="results-badge results-badge--accent">
                      {qa.length} question{qa.length !== 1 ? 's' : ''}
                    </span>
                    <span className="results-badge">
                      📅 {fmtDt(selectedInterview.completedAt || selectedInterview.createdAt)}
                    </span>
                    {selectedInterview.complexity && (
                      <span className="results-badge">{selectedInterview.complexity}</span>
                    )}
                  </div>
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
                              <div className="report-micro-row green">✓ {item.whatWorked}</div>
                            )}
                            {item.whatToImprove && (
                              <div className="report-micro-row amber">→ {item.whatToImprove}</div>
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
