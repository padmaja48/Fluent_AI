import React, { useEffect, useRef, useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { Login } from './Login';
import { Register } from './Register';
import { Dashboard } from './Dashboard';
import Profile from './Profile';
import { Practice } from './Practice';
import { MixedTests } from './MixedTests';
import { Interview } from './Interview';
import { Results } from './Results';
import { Admin } from './Admin';
import { AdminLogin } from './AdminLogin';
import Sidebar from './Sidebar';
import '../styles/App.css';
import '../styles/TestGuard.css';

export const App = () => {
  const { token, user, initializing, logout } = useContext(AuthContext);
  const [currentView, setCurrentView] = useState(() => localStorage.getItem('currentView') || 'dashboard');
  const [showLogin, setShowLogin] = useState(true);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const [navWarning, setNavWarning] = useState(null); // { targetView }
  const [resumeTarget, setResumeTarget] = useState(null); // in-progress session to resume in Practice
  const [practiceStartSkill, setPracticeStartSkill] = useState(null);
  const testActiveRef = useRef(false); // MixedTests sets this to true when session is live
  const isAdminRoute = window.location.pathname.startsWith('/admin');

  // MixedTests calls this to register/unregister test-in-progress state
  const registerTestActive = (active) => { testActiveRef.current = active; };

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
  };

  const isDark = theme === 'dark';

  /* The toggle pill — reused in sidebar row & floating header */
  const togglePill = (
    <span
      role="switch"
      aria-checked={isDark}
      className={`ttp-pill${isDark ? ' ttp-pill--dark' : ''}`}
      aria-hidden="true"
    >
      <span className="ttp-track">
        <span className="ttp-knob">
          {isDark
            ? <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            : <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="4" fill="currentColor" stroke="none"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="4.22" y1="4.22" x2="6.34" y2="6.34"/><line x1="17.66" y1="17.66" x2="19.78" y2="19.78"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/><line x1="4.22" y1="19.78" x2="6.34" y2="17.66"/><line x1="17.66" y1="6.34" x2="19.78" y2="4.22"/></svg>
          }
        </span>
      </span>
    </span>
  );

  /* Full-width sidebar row (icon + label + pill) */
  const themeToggle = (
    <button
      type="button"
      className="theme-toggle-row"
      onClick={toggleTheme}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      {/* icon */}
      <span className="ttr-icon" aria-hidden="true">
        {isDark
          ? <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4" fill="currentColor" stroke="none"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="4.22" y1="4.22" x2="6.34" y2="6.34"/><line x1="17.66" y1="17.66" x2="19.78" y2="19.78"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/><line x1="4.22" y1="19.78" x2="6.34" y2="17.66"/><line x1="17.66" y1="6.34" x2="19.78" y2="4.22"/></svg>
        }
      </span>
      {/* label */}
      <span className="ttr-label">{isDark ? 'Dark mode' : 'Light mode'}</span>
      {/* sliding pill */}
      {togglePill}
    </button>
  );

  const handleSetView = (view) => {
    if (testActiveRef.current && view !== 'tests') {
      setNavWarning({ targetView: view });
      return;
    }
    setCurrentView(view);
    localStorage.setItem('currentView', view);
  };

  const confirmLeave = () => {
    if (navWarning) {
      testActiveRef.current = false;
      setCurrentView(navWarning.targetView);
      localStorage.setItem('currentView', navWarning.targetView);
      setNavWarning(null);
    }
  };

  const handleLogout = () => {
    logout();
    localStorage.removeItem('currentView');
    setCurrentView('dashboard');
    setShowLogin(true);
    testActiveRef.current = false;
    setNavWarning(null);
  };

  // Floating pill for pages outside the sidebar (auth, admin, loading)
  const floatingToggle = <div className="theme-toggle-float">{themeToggle}</div>;

  if (initializing) {
    return (
      <>
        {floatingToggle}
        <div className="loading">Loading...</div>
      </>
    );
  }

  if (isAdminRoute) {
    if (!token) {
      return (
        <>
          {floatingToggle}
          <AdminLogin />
        </>
      );
    }

    if (user?.role !== 'admin') {
      return (
        <>
          {floatingToggle}
          <div className="admin-standalone">
            <div className="admin-denied-card">
              <span className="auth-kicker">Admin Portal</span>
              <h1>Access denied</h1>
              <p>This page is only available for admin accounts.</p>
              <div className="admin-denied-actions">
                <button type="button" className="btn-primary" onClick={handleLogout}>
                  Sign out
                </button>
                <button type="button" className="logout-btn" onClick={() => { window.location.href = '/'; }}>
                  Student app
                </button>
              </div>
            </div>
          </div>
        </>
      );
    }

    return (
      <>
        <div className="admin-standalone">
          <div className="admin-shell">
            <div className="admin-topbar">
              {/* Left: brand + badge */}
              <div className="admin-topbar-brand">
                <div className="admin-topbar-logo">F</div>
                <div className="admin-topbar-brand-text">
                  <div className="admin-topbar-name">
                    Fluent<span>AI</span>
                    <span className="admin-topbar-badge">Admin</span>
                  </div>
                  <div className="admin-topbar-sub">Content Management System</div>
                </div>
              </div>

              {/* Right: actions */}
              <div className="admin-topbar-actions">
                {/* Theme toggle pill inline */}
                <button
                  type="button"
                  className="admin-topbar-theme-btn"
                  onClick={toggleTheme}
                  aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
                >
                  {isDark
                    ? <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                    : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4" fill="currentColor" stroke="none"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="4.22" y1="4.22" x2="6.34" y2="6.34"/><line x1="17.66" y1="17.66" x2="19.78" y2="19.78"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/><line x1="4.22" y1="19.78" x2="6.34" y2="17.66"/><line x1="17.66" y1="6.34" x2="19.78" y2="4.22"/></svg>
                  }
                  {isDark ? 'Dark' : 'Light'}
                </button>

                <div className="admin-topbar-divider" />

                <button
                  type="button"
                  className="admin-topbar-action-btn"
                  onClick={() => { window.location.href = '/'; }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
                  </svg>
                  Student app
                </button>

                <button
                  type="button"
                  className="admin-topbar-logout-btn"
                  onClick={handleLogout}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                  Sign out
                </button>
              </div>
            </div>
            <div className="admin-scroll-body">
              <Admin />
            </div>
          </div>
        </div>
      </>
    );
  }

  if (!token) {
    return (
      <>
        {floatingToggle}
        {showLogin ? (
          <Login onSwitchToRegister={() => setShowLogin(false)} />
        ) : (
          <Register onSwitchToLogin={() => setShowLogin(true)} />
        )}
      </>
    );
  }

  return (
    <div className="app-container">
      <Sidebar currentView={currentView} onViewChange={handleSetView} onLogout={handleLogout} themeToggle={themeToggle} isDark={isDark} onToggleTheme={toggleTheme} user={user} />
      <div className="main-content">
        {navWarning && (
          <div className="test-nav-warning">
            <span>Your test is still in progress. Are you sure you want to leave?</span>
            <div className="test-nav-warning-actions">
              <button type="button" className="test-nav-confirm" onClick={confirmLeave}>
                Yes, leave test
              </button>
              <button type="button" className="test-nav-cancel" onClick={() => setNavWarning(null)}>
                Stay in test
              </button>
            </div>
          </div>
        )}
        <div className="topbar">
          <h1>
            {currentView === 'dashboard' && 'Dashboard'}
            {currentView === 'profile' && 'Profile'}
            {currentView === 'practice' && 'Practice Hub'}
            {currentView === 'tests' && 'Level Tests'}
            {currentView === 'interview' && 'AI Mock Interview'}
            {currentView === 'results' && 'Session Results'}
          </h1>
          <div className="topbar-actions" />
        </div>
        <div className="content-area">
          {currentView === 'dashboard' && (
            <Dashboard
              setCurrentView={handleSetView}
              onStartPracticeSkill={(skill) => {
                setPracticeStartSkill(skill);
                handleSetView('practice');
              }}
              onResumePractice={(target) => {
                setResumeTarget(target);
                handleSetView('practice');
              }}
            />
          )}
          {currentView === 'profile' && <Profile />}
          {currentView === 'practice' && (
            <Practice
              resumeSession={resumeTarget}
              initialSkill={practiceStartSkill}
              onInitialSkillConsumed={() => setPracticeStartSkill(null)}
              onMounted={() => setResumeTarget(null)}
              onGoToDashboard={() => handleSetView('dashboard')}
            />
          )}
          {currentView === 'tests' && (
            <MixedTests
              onTestActiveChange={registerTestActive}
              onGoToResults={(sessionId) => {
                if (sessionId) localStorage.setItem('selectedResultsSessionId', sessionId);
                handleSetView('results');
              }}
            />
          )}
          {currentView === 'interview' && <Interview setCurrentView={handleSetView} />}
          {currentView === 'results' && (
            <Results
              onPracticeSkill={(skill) => {
                setPracticeStartSkill(skill);
                handleSetView('practice');
              }}
              onRetakeTest={() => handleSetView('tests')}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
