import React from 'react';
import '../styles/Sidebar.css';

const Icons = {
  dashboard: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  ),
  profile: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  practice: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
    </svg>
  ),
  tests: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
    </svg>
  ),
  interview: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
    </svg>
  ),
  results: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  ),
  logout: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  ),
};

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: Icons.dashboard },
  { id: 'profile',   label: 'Profile',   icon: Icons.profile },
  { id: 'practice',  label: 'Practice',  icon: Icons.practice },
  { id: 'tests',     label: 'Tests',     icon: Icons.tests },
  { id: 'interview', label: 'Interview', icon: Icons.interview },
  { id: 'results',   label: 'Results',   icon: Icons.results },
];

const ThemeIcon = ({ isDark }) =>
  isDark ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none"/>
      <line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/>
      <line x1="4.22" y1="4.22" x2="6.34" y2="6.34"/><line x1="17.66" y1="17.66" x2="19.78" y2="19.78"/>
      <line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/>
      <line x1="4.22" y1="19.78" x2="6.34" y2="17.66"/><line x1="17.66" y1="6.34" x2="19.78" y2="4.22"/>
    </svg>
  );

const initialsFor = (name = '') =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'U';

const Sidebar = ({ currentView, onViewChange, onLogout, themeToggle, isDark, onToggleTheme, user }) => (
  <aside className="sidebar">
    <div className="sidebar-top">
      <div className="sidebar-header">
        <div className="logo">F</div>
        <span className="brand">Fluent<span>AI</span></span>
      </div>
      <div className="sidebar-user-card">
        <div className="sidebar-user-avatar">
          {user?.profileImageUrl ? <img src={user.profileImageUrl} alt="" /> : <span>{initialsFor(user?.name)}</span>}
        </div>
        <div className="sidebar-user-meta">
          <strong>{user?.name || 'Learner'}</strong>
          <span>{user?.level || 'A1'}</span>
        </div>
      </div>
    </div>

    <nav className="sidebar-nav">
      {navItems.map(({ id, icon, label }) => (
        <button
          key={id}
          type="button"
          className={`nav-item${currentView === id ? ' active' : ''}`}
          onClick={() => onViewChange(id)}
        >
          <span className="icon">{icon}</span>
          <span className="label">{label}</span>
        </button>
      ))}

      {/* Mobile-only: theme toggle and sign-out appear inline in the bottom nav */}
      <button
        type="button"
        className="nav-item mobile-only-nav"
        onClick={onToggleTheme}
        aria-label="Toggle theme"
      >
        <span className="icon"><ThemeIcon isDark={isDark} /></span>
        <span className="label">{isDark ? 'Dark' : 'Light'}</span>
      </button>

      <button
        type="button"
        className="nav-item mobile-only-nav nav-logout"
        onClick={onLogout}
        aria-label="Sign out"
      >
        <span className="icon">{Icons.logout}</span>
        <span className="label">Sign out</span>
      </button>
    </nav>

    {/* Desktop-only footer */}
    <div className="sidebar-footer">
      {themeToggle}
      <button type="button" className="logout-btn" onClick={onLogout}>
        <span className="icon">{Icons.logout}</span>
        Sign out
      </button>
    </div>

  </aside>
);

export default Sidebar;
