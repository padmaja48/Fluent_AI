import React, { useState, useEffect } from 'react';
import { sessionAPI, interviewAPI } from '../services/api';
import { InterviewReportPanel } from './InterviewReportPanel';
import '../styles/Results.css';

const fmt   = (n) => Number(n || 0).toFixed(1);
const fmtDt = (v) => v ? new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
const fmtDuration = (seconds) => {
  const total = Number(seconds || 0);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return mins ? `${mins}m ${secs}s` : `${secs}s`;
};
const cleanStudentFeedback = (text = '') =>
  String(text || '')
    .replace(/[^.]*validated locally[^.]*\./gi, '')
    .replace(/[^.]*answer key[^.]*\./gi, '')
    .replace(/[^.]*no ai evaluation[^.]*\./gi, '')
    .replace(/[^.]*ai evaluation cost[^.]*\./gi, '')
    .replace(/[^.]*mechanical estimate only[^.]*\./gi, '')
    .replace(/[^.]*without ai cost[^.]*\./gi, '')
    .replace(/\s+/g, ' ')
    .trim();
const isTestSession = (session) => session?.skill === 'Mixed' && session?.moduleType === 'mixed-test';
const getQuestionDoc = (item) =>
  item?.questionId && typeof item.questionId === 'object' ? item.questionId : null;
const PRACTICE_SKILLS = ['Listening', 'Speaking', 'Reading', 'Writing'];
const PRACTICE_SKILL_BY_SECTION = {
  'Sentence Correction': 'Writing',
  'Error Detection': 'Writing',
  'Fill in the Blanks': 'Writing',
  'Choose the Correct Sentence': 'Writing',
  Vocabulary: 'Writing',
  'Sentence Completion': 'Writing',
  'Reading Comprehension': 'Reading',
};

const getMetrics = (session) => {
  const questions   = session?.questions || [];
  const scored      = questions.filter(q => typeof q.score === 'number');
  const answered    = scored.filter(q => q.userAnswer);
  const skipped     = scored.filter(q => !q.userAnswer);
  const correct     = answered.filter(q => q.isCorrect);
  const wrong       = answered.filter(q => !q.isCorrect);
  const expectedCount = session?.setSize || questions.length || 10;
  const averageScore  = Number(session?.averageScore || 0);
  const accuracy      = answered.length ? (correct.length / answered.length) * 100 : 0;
  const completion    = expectedCount  ? Math.min(100, (scored.length / expectedCount) * 100) : 0;
  return {
    answeredCount: answered.length,
    skippedCount: skipped.length,
    wrongCount: wrong.length,
    correctCount: correct.length,
    expectedCount,
    averageScore,
    accuracy,
    completion,
    timeTakenSeconds: Number(session?.durationSeconds || 0),
  };
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

const getRecommendations = (session, metrics, skillRows, reviewItems) => {
  const weakSkills = skillRows
    .filter((row) => row.answered > 0 && (row.averageScore < 70 || row.correct / row.answered < 0.7))
    .sort((a, b) => a.averageScore - b.averageScore);
  const weakestSkill = weakSkills[0]?.skill;
  const practiceSkill = PRACTICE_SKILL_BY_SECTION[weakestSkill] || (PRACTICE_SKILLS.includes(weakestSkill) ? weakestSkill : null);
  const missedFocus = Array.from(new Set(
    reviewItems
      .filter((item) => !item.isCorrect)
      .flatMap((item) => item.question?.hints || [])
      .filter((hint) => /^Focus:/i.test(hint))
      .map((hint) => hint.replace(/^Focus:\s*/i, '')),
  ));
  const recommendations = [];

  if (weakestSkill) {
    recommendations.push(`Prioritize ${weakestSkill}: it is the lowest section in this attempt.`);
  }
  if (missedFocus.length) {
    recommendations.push(`Review these recurring topics: ${missedFocus.slice(0, 3).join(', ')}.`);
  }
  if (metrics.accuracy < 70) {
    recommendations.push('Slow down before choosing an option; most errors came from answer accuracy, not completion.');
  }
  if (metrics.completion < 100) {
    recommendations.push('Finish every question before submitting so the score reflects your real level.');
  }
  if (!recommendations.length) {
    recommendations.push('Move to the next unlocked test, then compare section scores for consistency.');
  }

  return {
    weakestSkill,
    practiceSkill,
    missedFocus,
    recommendations,
    canPracticeWeakSkill: Boolean(practiceSkill),
    canRetake: isTestSession(session),
  };
};

/* Score → CSS conic-gradient degrees */
const scoreToDeg = (score) => `${(Math.min(100, Math.max(0, score)) / 100 * 360).toFixed(1)}deg`;

export const Results = ({ onPracticeSkill, onRetakeTest }) => {
  const [activeTab, setActiveTab] = useState('practice');

  const [sessions,         setSessions]         = useState([]);
  const [selectedSessionId,setSelectedSessionId]= useState(null);
  const [detailedSession,  setDetailedSession]  = useState(null);
  const [detailLoading,    setDetailLoading]    = useState(false);
  const [loading,          setLoading]          = useState(true);

  const [interviews,       setInterviews]       = useState([]);
  const [selectedInterview,setSelectedInterview]= useState(null);
  const [interviewReport,  setInterviewReport]  = useState(null);
  const [reportLoading,    setReportLoading]    = useState(false);
  const [interviewsLoaded, setInterviewsLoaded] = useState(false);

  useEffect(() => {
    const requestedSessionId = localStorage.getItem('selectedResultsSessionId');
    sessionAPI.getUserSessions()
      .then(res => {
        const done = res.data
          .filter(s => s.status === 'Completed')
          .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
        setSessions(done);
        const requested = done.find((session) => session._id === requestedSessionId);
        const firstPractice = done.find((session) => !isTestSession(session));
        const firstTest = done.find(isTestSession);
        const next = requested || firstPractice || firstTest || null;
        setSelectedSessionId(next?._id || null);
        if (requested && isTestSession(requested)) setActiveTab('tests');
        if (requested && !isTestSession(requested)) setActiveTab('practice');
        if (!requested && !firstPractice && firstTest) setActiveTab('tests');
        localStorage.removeItem('selectedResultsSessionId');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedSessionId) {
      setDetailedSession(null);
      return;
    }
    setDetailLoading(true);
    sessionAPI.getSession(selectedSessionId)
      .then((res) => setDetailedSession(res.data))
      .catch(() => setDetailedSession(null))
      .finally(() => setDetailLoading(false));
  }, [selectedSessionId]);

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

  const selectedSummary = sessions.find((session) => session._id === selectedSessionId) || null;
  const selectedSession = detailedSession?._id === selectedSessionId ? detailedSession : selectedSummary;
  const visibleSessions = activeTab === 'tests'
    ? sessions.filter(isTestSession)
    : sessions.filter((session) => !isTestSession(session));
  const metrics  = selectedSession ? getMetrics(selectedSession)  : null;
  const feedback = metrics ? getFeedback(selectedSession, metrics) : null;
  const reviewItems = (selectedSession?.questions || []).map((item, idx) => {
    const question = getQuestionDoc(item);
    return {
      index: idx + 1,
      answer: item,
      question,
      selectedAnswer: item.userAnswer || '',
      correctAnswer: question?.correctAnswer || '',
      explanation: cleanStudentFeedback(question?.explanation),
      isCorrect: Boolean(item.isCorrect),
      isSkipped: typeof item.score === 'number' && !item.userAnswer,
      score: typeof item.score === 'number' ? item.score : 0,
    };
  });
  const skillRows = selectedSession?.testBreakdown?.length
    ? selectedSession.testBreakdown
    : Object.values(reviewItems.reduce((acc, item) => {
      const skill = item.question?.moduleLabel || item.question?.skill || selectedSession?.skill || 'Practice';
      const current = acc[skill] || { skill, total: 0, answered: 0, correct: 0, wrong: 0, skipped: 0, totalScore: 0, averageScore: 0 };
      current.total += 1;
      current.answered += typeof item.answer.score === 'number' && !item.isSkipped ? 1 : 0;
      current.correct += item.isCorrect ? 1 : 0;
      current.wrong += typeof item.answer.score === 'number' && !item.isSkipped && !item.isCorrect ? 1 : 0;
      current.skipped += item.isSkipped ? 1 : 0;
      current.totalScore += item.score;
      current.averageScore = current.total ? current.totalScore / current.total : 0;
      acc[skill] = current;
      return acc;
    }, {}));
  const recommendations = selectedSession && metrics
    ? getRecommendations(selectedSession, metrics, skillRows, reviewItems)
    : null;

  return (
    <div className="results-page">

      {/* ── Tab switcher ─────────────────────────────── */}
      <div className="results-tabs">
        <button
          className={`results-tab${activeTab === 'practice'   ? ' active' : ''}`}
          onClick={() => {
            setActiveTab('practice');
            const next = sessions.find((session) => !isTestSession(session));
            setSelectedSessionId(next?._id || null);
          }}
        >
          Practice Sessions
        </button>
        <button
          className={`results-tab${activeTab === 'tests' ? ' active' : ''}`}
          onClick={() => {
            setActiveTab('tests');
            const next = sessions.find(isTestSession);
            setSelectedSessionId(next?._id || null);
          }}
        >
          Level Tests
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
      {(activeTab === 'practice' || activeTab === 'tests') && !selectedSession && (
        <div className="results-empty">
          <h2>No {activeTab === 'tests' ? 'level tests' : 'practice sessions'} yet</h2>
          <p>Finish one attempt to see the full analysis here.</p>
        </div>
      )}

      {/* ── Practice tab — content ───────────────────── */}
      {(activeTab === 'practice' || activeTab === 'tests') && selectedSession && (
        <div className="practice-layout">

          {/* Left: session list */}
          <div className="sessions-panel">
            <div className="sessions-panel-header">
              <h3>{activeTab === 'tests' ? 'Completed Tests' : 'Completed Sessions'}</h3>
              <span className="sessions-panel-count">{visibleSessions.length}</span>
            </div>
            <div className="sessions-list">
              {visibleSessions.map(s => {
                const m = getMetrics(s);
                return (
                  <div
                    key={s._id}
                    className={`session-item${selectedSession._id === s._id ? ' active' : ''}`}
                    onClick={() => setSelectedSessionId(s._id)}
                  >
                    <span className="session-item-dot" />
                    <div className="session-item-body">
                      <span className="session-item-title">{s.skill} {s.level}</span>
                      <span className="session-item-sub">
                        {s.testLabel || s.moduleLabel || 'Practice'} · Set {s.moduleSetNumber || s.setNumber || '—'}
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
                  {selectedSession.testLabel || `${selectedSession.skill} ${selectedSession.level} · ${selectedSession.moduleLabel || 'Practice'}`}
                </h3>
                <p>
                  {isTestSession(selectedSession)
                    ? `Question range ${selectedSession.startOrder || '—'}-${selectedSession.endOrder || '—'}`
                    : `Module ${selectedSession.moduleOrder || '—'} · Set ${selectedSession.moduleSetNumber || selectedSession.setNumber || '—'}`}
                </p>
                <div className="results-info-badges">
                  <span className="results-badge results-badge--accent">
                    ✓ {metrics.correctCount}/{metrics.expectedCount} correct
                  </span>
                  <span className="results-badge">
                    {metrics.wrongCount} wrong
                  </span>
                  <span className="results-badge">
                    {metrics.skippedCount} skipped
                  </span>
                  <span className="results-badge">
                    {fmtDt(selectedSession.updatedAt || selectedSession.createdAt)}
                  </span>
                  <span className="results-badge">
                    Time {fmtDuration(metrics.timeTakenSeconds)}
                  </span>
                </div>
              </div>
            </div>

            {activeTab === 'tests' && (
              <div className="test-analysis-grid">
                {skillRows.map((row) => (
                  <div key={row.skill} className={`test-analysis-card ${row.averageScore >= 80 ? 'strong' : row.averageScore < 70 ? 'weak' : ''}`}>
                    <span>{row.skill}</span>
                    <strong>{fmt(row.averageScore)}</strong>
                    <small>{row.correct}/{row.total || row.answered} correct · {row.wrong || 0} wrong · {row.skipped || 0} skipped</small>
                    <small>{row.averageScore >= 80 ? 'Strength' : row.averageScore < 70 ? 'Weakness' : 'Developing'}</small>
                  </div>
                ))}
              </div>
            )}

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

            {activeTab === 'tests' && recommendations && (
              <div className="recommendation-panel">
                <div>
                  <span className="recommendation-kicker">Personalized Recommendations</span>
                  <h4>What to Practice Next</h4>
                </div>
                <ul>
                  {recommendations.recommendations.map((item) => <li key={item}>{item}</li>)}
                </ul>
                <div className="recommendation-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={!recommendations.canPracticeWeakSkill}
                    onClick={() => recommendations.practiceSkill && onPracticeSkill?.(recommendations.practiceSkill)}
                  >
                    Practice Weakest Section
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={!recommendations.canRetake}
                    onClick={() => onRetakeTest?.()}
                  >
                    Retake Similar Test
                  </button>
                </div>
              </div>
            )}

            <div className="review-panel">
              <div className="review-panel-header">
                <h4>{activeTab === 'tests' ? 'Question Review' : 'Session Review'}</h4>
                <span>{detailLoading ? 'Loading details...' : `${reviewItems.length} questions`}</span>
              </div>
              <div className="review-list">
                {reviewItems.map((item) => (
                  <div key={`${item.index}-${item.question?._id || item.index}`} className={`review-card${item.isCorrect ? ' correct' : 'incorrect'}${item.isSkipped ? ' skipped' : ''}`}>
                    <div className="review-card-head">
                      <span>Question {item.index}</span>
                      <strong>{item.question?.moduleLabel || item.question?.skill || selectedSession.skill}</strong>
                      <small>{fmt(item.score)}/100</small>
                    </div>
                    {item.question?.passageText && (
                      <div className="review-passage">
                        {String(item.question.passageText).split('\n').map((line, lineIdx) => <p key={lineIdx}>{line}</p>)}
                      </div>
                    )}
                    <p className="review-question">{item.question?.stem || 'Question details unavailable.'}</p>
                    {item.question?.options?.length > 0 && (
                      <div className="review-options">
                        {item.question.options.map((option, optionIdx) => {
                          const selected = item.selectedAnswer === option.text;
                          const correct = option.isCorrect;
                          return (
                            <div
                              key={`${item.index}-${optionIdx}`}
                              className={`review-option${selected ? ' selected' : ''}${correct ? ' correct' : ''}`}
                            >
                              <span>{String.fromCharCode(65 + optionIdx)}</span>
                              <p>{option.text}</p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {!item.question?.options?.length && (
                      <div className="review-free-answer">
                        <strong>Your answer</strong>
                        <p>{item.selectedAnswer || 'No answer submitted.'}</p>
                      </div>
                    )}
                    <div className="review-explanation">
                      <strong>{item.isSkipped ? 'Skipped' : item.isCorrect ? 'Correct' : 'Needs review'}</strong>
                      {!item.isCorrect && item.correctAnswer && <p>Correct answer: {item.correctAnswer}</p>}
                      {item.explanation && <p>{item.explanation}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default Results;
