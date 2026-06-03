import React, { useState, useEffect } from 'react';
import { sessionAPI, interviewAPI } from '../services/api';
import { InterviewReportPanel } from './InterviewReportPanel';
import '../styles/Results.css';

const fmt   = (n) => Number(n || 0).toFixed(1);
const fmtDt = (v) => v ? new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

const getMetrics = (session) => {
  const questions   = session?.questions || [];
  const answered    = questions.filter(q => typeof q.score === 'number');
  const correct     = answered.filter(q => q.isCorrect);
  const expectedCount = session?.setSize || questions.length || 10;
  const averageScore  = Number(session?.averageScore || 0);
  const accuracy      = answered.length ? (correct.length / answered.length) * 100 : 0;
  const completion    = expectedCount  ? Math.min(100, (answered.length / expectedCount) * 100) : 0;
  return { answeredCount: answered.length, correctCount: correct.length, expectedCount, averageScore, accuracy, completion };
};

const getFeedback = (session, m) => {
  const skill = session?.skill || 'Practice';
  const mod   = session?.moduleLabel || 'this module';
  const strengths = [];
  const focus     = [];
  if (m.averageScore >= 85) strengths.push(`Strong performance in ${skill} ${mod}.`);
  if (m.accuracy   >= 80)  strengths.push('Most answers matched the evaluated question evidence.');
  if (m.completion >= 100) strengths.push('Completed the full question set — great discipline!');
  if (!strengths.length)   strengths.push('Session submitted successfully; you now have a baseline score.');
  if (m.averageScore < 80) focus.push(`Review ${mod} before moving too quickly into the next set.`);
  if (m.accuracy   < 70)   focus.push('Slow down on answer selection and use the prompt evidence more directly.');
  if (m.completion < 100)  focus.push('Finish every question in the set for a more accurate score.');
  if (!focus.length)        focus.push('Keep the rhythm — continue to the next unlocked module set.');
  return { strengths, focus };
};

/* Score → CSS conic-gradient degrees */
const scoreToDeg = (score) => `${(Math.min(100, Math.max(0, score)) / 100 * 360).toFixed(1)}deg`;

export const Results = () => {
  const [activeTab, setActiveTab] = useState('practice');

  const [sessions,         setSessions]         = useState([]);
  const [selectedSession,  setSelectedSession]  = useState(null);
  const [loading,          setLoading]          = useState(true);

  const [interviews,       setInterviews]       = useState([]);
  const [selectedInterview,setSelectedInterview]= useState(null);
  const [interviewReport,  setInterviewReport]  = useState(null);
  const [reportLoading,    setReportLoading]    = useState(false);
  const [interviewsLoaded, setInterviewsLoaded] = useState(false);

  useEffect(() => {
    sessionAPI.getUserSessions()
      .then(res => {
        const done = res.data
          .filter(s => s.status === 'Completed')
          .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
        setSessions(done);
        setSelectedSession(done[0] || null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (activeTab === 'interviews' && !interviewsLoaded) {
      setInterviewsLoaded(true);
      interviewAPI.getUserInterviews().then(res => {
        const done = res.data.filter(i => i.status === 'Completed');
        setInterviews(done);
        if (done.length > 0) loadReport(done[0]._id);
      }).catch(() => {});
    }
  }, [activeTab, interviewsLoaded]);

  const loadReport = async (id) => {
    setReportLoading(true);
    try {
      const res = await interviewAPI.getReport(id);
      setSelectedInterview(res.data.interview);
      setInterviewReport(res.data.report);
    } catch {}
    finally { setReportLoading(false); }
  };

  if (loading) return <div className="loading">Loading results…</div>;

  const metrics  = selectedSession ? getMetrics(selectedSession)  : null;
  const feedback = metrics ? getFeedback(selectedSession, metrics) : null;

  return (
    <div className="results-page">

      {/* ── Tab switcher ─────────────────────────────── */}
      <div className="results-tabs">
        <button
          className={`results-tab${activeTab === 'practice'   ? ' active' : ''}`}
          onClick={() => setActiveTab('practice')}
        >
          Practice Sessions
        </button>
        <button
          className={`results-tab${activeTab === 'interviews' ? ' active' : ''}`}
          onClick={() => setActiveTab('interviews')}
        >
          Interview Reports
        </button>
      </div>

      {/* ── Interview tab ────────────────────────────── */}
      {activeTab === 'interviews' && (
        <InterviewReportPanel
          interviews={interviews}
          selectedInterview={selectedInterview}
          report={interviewReport}
          onSelect={loadReport}
          loading={reportLoading}
        />
      )}

      {/* ── Practice tab — empty ─────────────────────── */}
      {activeTab === 'practice' && !selectedSession && (
        <div className="results-empty">
          <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>📊</div>
          <h2>No sessions yet</h2>
          <p>Finish a practice set to see your dynamic results here.</p>
        </div>
      )}

      {/* ── Practice tab — content ───────────────────── */}
      {activeTab === 'practice' && selectedSession && (
        <div className="practice-layout">

          {/* Left: session list */}
          <div className="sessions-panel">
            <div className="sessions-panel-header">
              <h3>Completed Sessions</h3>
              <span className="sessions-panel-count">{sessions.length}</span>
            </div>
            <div className="sessions-list">
              {sessions.map(s => {
                const m = getMetrics(s);
                return (
                  <div
                    key={s._id}
                    className={`session-item${selectedSession._id === s._id ? ' active' : ''}`}
                    onClick={() => setSelectedSession(s)}
                  >
                    <span className="session-item-dot" />
                    <div className="session-item-body">
                      <span className="session-item-title">{s.skill} {s.level}</span>
                      <span className="session-item-sub">
                        {s.moduleLabel || 'Practice'} · Set {s.moduleSetNumber || s.setNumber || '—'}
                      </span>
                      <span className="session-item-sub">{fmtDt(s.updatedAt || s.createdAt)}</span>
                    </div>
                    <span className="session-item-score">{fmt(m.averageScore)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: detail */}
          <div className="results-detail">

            {/* Hero score */}
            <div className="results-hero">
              <div
                className="score-ring"
                style={{ '--score-deg': scoreToDeg(metrics.averageScore) }}
              >
                <div className="score-text">
                  {fmt(metrics.averageScore)}
                  <span className="score-text-label">Score</span>
                </div>
              </div>
              <div className="results-info">
                <h3>
                  {selectedSession.skill} {selectedSession.level} · {selectedSession.moduleLabel || 'Practice'}
                </h3>
                <p>Module {selectedSession.moduleOrder || '—'} · Set {selectedSession.moduleSetNumber || selectedSession.setNumber || '—'}</p>
                <div className="results-info-badges">
                  <span className="results-badge results-badge--accent">
                    ✓ {metrics.correctCount}/{metrics.expectedCount} correct
                  </span>
                  <span className="results-badge">
                    📅 {fmtDt(selectedSession.updatedAt || selectedSession.createdAt)}
                  </span>
                  <span className="results-badge">
                    {Math.round(metrics.completion)}% complete
                  </span>
                </div>
              </div>
            </div>

            {/* Metric bars */}
            <div className="skill-bars">
              <p className="skill-bars-title">Performance Breakdown</p>
              {[
                { label: 'Score',      value: metrics.averageScore, cls: 'fill-score'      },
                { label: 'Accuracy',   value: metrics.accuracy,     cls: 'fill-accuracy'   },
                { label: 'Completion', value: metrics.completion,   cls: 'fill-completion' },
              ].map(bar => (
                <div key={bar.label} className="skill-bar-row">
                  <span className="skill-label">{bar.label}</span>
                  <div className="skill-bar-track">
                    <div
                      className={`skill-bar-fill skill-bar-fill--${bar.label.toLowerCase()}`}
                      style={{ width: `${Math.max(0, Math.min(100, bar.value))}%` }}
                    />
                  </div>
                  <span className="skill-score">{fmt(bar.value)}</span>
                </div>
              ))}
            </div>

            {/* Feedback cards */}
            <div className="feedback-cards">
              <div className="feedback-card feedback-card--strengths">
                <h4>Strengths</h4>
                <ul>
                  {feedback.strengths.map(item => <li key={item}>{item}</li>)}
                </ul>
              </div>
              <div className="feedback-card feedback-card--focus">
                <h4>Focus Areas</h4>
                <ul>
                  {feedback.focus.map(item => <li key={item}>{item}</li>)}
                </ul>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default Results;
