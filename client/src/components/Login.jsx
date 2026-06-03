import React, { useState, useContext } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { AuthContext } from '../context/AuthContext';
import '../styles/Auth.css';

export const Login = ({ onSwitchToRegister }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, loginWithGoogle, loading, error } = useContext(AuthContext);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try { await login(email, password); } catch { /* handled by context */ }
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
        <h1>Welcome back</h1>
        <p className="auth-card-subtitle">Sign in to continue your learning journey</p>

        <div className="google-btn-wrapper">
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => {}}
            width="340"
            text="signin_with"
            shape="rectangular"
            theme="outline"
          />
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
