import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import '../styles/Auth.css';

export const Register = ({ onSwitchToLogin }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [level, setLevel] = useState('B1');
  const { register, loading, error } = useContext(AuthContext);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try { await register(name, email, password, level); } catch { /* handled */ }
  };

  const handleGoogleLogin = () => {
    window.location.href = '/api/auth/google';
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-card-logo">
          <div className="logo-mark">F</div>
          <span className="logo-name">Fluent<span>AI</span></span>
        </div>
        <h1>Create your account</h1>
        <p className="auth-card-subtitle">Start mastering English with AI-powered practice</p>

        <div className="google-btn-wrapper">
          <button type="button" className="google-redirect-btn" onClick={handleGoogleLogin}>
            <span className="google-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
              </svg>
            </span>
            Continue with Google
          </button>
        </div>
        <div className="auth-divider"><span>or continue with email</span></div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Arjun Kumar"
              required
            />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 8 characters"
              required
            />
          </div>
          <div className="form-group">
            <label>English Level (CEFR)</label>
            <select value={level} onChange={(e) => setLevel(e.target.value)}>
              <option value="A1">A1 — Beginner</option>
              <option value="A2">A2 — Elementary</option>
              <option value="B1">B1 — Intermediate</option>
              <option value="B2">B2 — Upper Intermediate</option>
              <option value="C1">C1 — Advanced</option>
              <option value="C2">C2 — Mastery</option>
            </select>
          </div>
          {error && <p className="error">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="auth-link">
          Already have an account?{' '}
          <button onClick={onSwitchToLogin} type="button">Sign in</button>
        </p>
      </div>
    </div>
  );
};
