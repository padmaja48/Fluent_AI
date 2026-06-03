import React, { useState, useContext } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { AuthContext } from '../context/AuthContext';
import '../styles/Auth.css';

export const Register = ({ onSwitchToLogin }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [level, setLevel] = useState('B1');
  const { register, loginWithGoogle, loading, error } = useContext(AuthContext);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try { await register(name, email, password, level); } catch { /* handled */ }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    try { await loginWithGoogle(credentialResponse.credential); } catch { /* handled */ }
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
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => {}}
            width="340"
            text="signup_with"
            shape="rectangular"
            theme="outline"
          />
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
