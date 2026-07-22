import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { userAPI, interviewAPI, sessionAPI } from '../services/api';
import { InterviewFlowSteps } from './interview/InterviewFlowSteps';
import '../styles/Dashboard.css';

const skillMeta = {
  Listening: {
    short: 'L',
    title: 'Listening',
    description: 'Audio comprehension, intent, details, and action tracking.',
  },
  Speaking: {
    short: 'S',
    title: 'Speaking',
    description: 'Fluency, structure, pronunciation, and follow-up handling.',
  },
  Reading: {
    short: 'R',
    title: 'Reading',
    description: 'Main ideas, details, vocabulary, purpose, and inference.',
  },
  Writing: {
    short: 'W',
    title: 'Writing',
    description: 'Sentence control, cohesion, tone, and argument building.',
  },
};

const skillOrder = ['Listening', 'Speaking', 'Reading', 'Writing'];

export const Dashboard = ({ setCurrentView, onResumePractice, onStartPracticeSkill }) => {
  const { user } = useContext(AuthContext);
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [interviews, setInterviews] = useState([]);
  const [inProgressSessions, setInProgressSessions] = useState([]);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const [response, ivRes, ipRes] = await Promise.all([
          userAPI.getDashboard(),
          interviewAPI.getUserInterviews().catch(() => ({ data: [] })),
          sessionAPI.getInProgress().catch(() => ({ data: [] })),
        ]);
        setDashboardData(response.data);
        setInterviews(ivRes.data || []);
        setInProgressSessions(ipRes.data || []);
      } catch (err) {
        console.error('Failed to fetch dashboard:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  if (loading) return <div className="loading">Loading...</div>;

  const { user: userData, recentActivity = [], totals = {}, practice = {} } = dashboardData || {};
  const displayUser = userData || user || {};
  const skillStats = practice.skillStats || {};
  const formatScore = (score) => Number(score || 0).toFixed(1);

  const startSkill = (skill) => {
    if (onStartPracticeSkill) {
      onStartPracticeSkill(skill);
      return;
    }
    setCurrentView?.('practice');
  };

  return (
    <div className="dashboard">
      <div className="dashboard-hero">
        <div className="dashboard-hero-copy">
          <span className="dashboard-kicker">AI Mock Interview Platform</span>
          <h1>Fluent_AI turns your resume into a live interview practice session.</h1>
          <p>
            Upload a resume, choose your target role, answer adaptive interviewer questions, and review a detailed feedback report.
          </p>
          <div className="dashboard-hero-actions">
            <button type="button" className="dashboard-primary-cta" onClick={() => setCurrentView?.('interview')}>
              Start AI Interview
            </button>
            <button type="button" className="dashboard-secondary-cta" onClick={() => setCurrentView?.('results')}>
              View Reports
            </button>
          </div>
        </div>
        <div className="dashboard-hero-flow">
          <InterviewFlowSteps activeIndex={0} compact />
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Practice sessions</div>
          <div className="stat-val">{practice.totalSessions || 0}</div>
          <div className="stat-sub">{practice.totalQuestions || 0} questions answered</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Avg. score</div>
          <div className="stat-val">{formatScore(practice.averageScore)}</div>
          <div className="stat-sub">Across completed practice sets</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Current streak</div>
          <div className="stat-val">{practice.streak || 0}</div>
          <div className="stat-sub">days</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Interviews</div>
          <div className="stat-val">{totals.interviews || 0}</div>
          <div className="stat-sub">completed</div>
        </div>
      </div>

      <div className="dashboard-section-head">
        <div>
          <span className="dashboard-kicker">LSRW Practice</span>
          <h2>Choose a skill to continue</h2>
        </div>
      </div>

      <div className="modules-grid">
        {skillOrder.map((skill) => {
          const meta = skillMeta[skill];
          const stats = skillStats[skill] || {};
          return (
            <button key={skill} type="button" className="module-card" onClick={() => startSkill(skill)}>
              <div className="mc-icon">{meta.short}</div>
              <div className="module-copy">
                <h3>{meta.title}</h3>
                <p>{meta.description}</p>
              </div>
              <div className="module-metrics">
                <span>{stats.currentLevel || displayUser.level || 'A1'}</span>
                <span>{stats.completedSets || 0} sets</span>
                <span>{formatScore(stats.averageScore)} avg</span>
              </div>
            </button>
          );
        })}
      </div>

      {inProgressSessions.length > 0 && (
        <>
          <div className="dashboard-section-head">
            <div>
              <span className="dashboard-kicker">In Progress</span>
              <h2>Continue where you left off</h2>
            </div>
          </div>
          <div className="db-continue-grid">
            {inProgressSessions.map(({ session, questions, answeredCount }) => {
              const total = questions?.length || session.setSize || 10;
              const done = answeredCount || 0;
              const pct = total > 0 ? Math.round((done / total) * 100) : 0;
              const icon = skillMeta[session.skill]?.short || 'P';
              return (
                <div key={session._id} className="db-continue-card">
                  <div className="db-continue-icon">{icon}</div>
                  <div className="db-continue-info">
                    <div className="db-continue-title">
                      {session.skill} · {session.level}
                    </div>
                    <div className="db-continue-sub">
                      {session.moduleLabel || `Set ${session.setNumber || ''}`} · {done}/{total} answered
                    </div>
                    <div className="db-continue-bar">
                      <div className="db-continue-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="db-continue-pct">{pct}% complete</div>
                  </div>
                  <button
                    className="db-continue-btn"
                    onClick={() => onResumePractice && onResumePractice({ session, questions })}
                  >
                    Continue →
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {interviews.length > 0 && (
        <>
          <div className="dashboard-section-head">
            <div>
              <span className="dashboard-kicker">Interviews</span>
              <h2>Recent interview history</h2>
            </div>
          </div>
          <div className="db-interview-table-wrap">
            <table className="db-interview-table">
              <thead>
                <tr><th>Date</th><th>Domain</th><th>Type</th><th>Duration</th><th>Score</th></tr>
              </thead>
              <tbody>
                {interviews.slice(0, 6).map(iv => (
                  <tr key={iv._id}>
                    <td>{new Date(iv.createdAt).toLocaleDateString()}</td>
                    <td>{iv.roleDomain}</td>
                    <td>{iv.interviewType || iv.interviewStyle || '—'}</td>
                    <td>{iv.duration} min</td>
                    <td>{iv.totalScore ? `${Math.round(iv.totalScore)}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};
