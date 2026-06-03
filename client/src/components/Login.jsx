import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import '../styles/Auth.css';

export const Login = ({ onSwitchToRegister }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, loading, error } = useContext(AuthContext);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try { await login(email, password); } catch { /* handled by context */ }
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
        <h1>Welcome back</h1>
        <p className="auth-card-subtitle">Sign in to continue your learning journey</p>

        <div className="google-btn-wrapper">
          <button type="button" className="google-redirect-btn" onClick={handleGoogleLogin}>
            <span className="google-icon" aria-hidden="true">G</span>
            Continue with Google
          </button>
        </div>
        <div className="auth-divider"><span>or continue with email</span></div>

        <form onSubmit={handleSubmit}>
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
              placeholder="••••••••"
              required
            />
          </div>
          {error && <p className="error">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="auth-link">
          Don't have an account?{' '}
          <button onClick={onSwitchToRegister} type="button">Create one free</button>
        </p>
      </div>
    </div>
  );
};
