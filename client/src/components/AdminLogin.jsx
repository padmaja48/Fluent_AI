import React, { useContext, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import '../styles/Auth.css';

export const AdminLogin = () => {
  const { login, logout, loading } = useContext(AuthContext);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    try {
      const response = await login(email, password);
      if (response.user?.role !== 'admin') {
        logout();
        setError('This portal is restricted to admin accounts.');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Admin login failed.');
    }
  };

  return (
    <div className="auth-container admin-auth">
      <div className="auth-card">
        <div className="auth-card-logo">
          <div className="logo-mark">F</div>
          <span className="logo-name">Fluent<span>AI</span></span>
        </div>
        <span className="auth-kicker">Admin Portal</span>
        <h1>Admin sign in</h1>
        <p className="auth-card-subtitle">Restricted to admin accounts only</p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
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
            {loading ? 'Signing in...' : 'Open admin'}
          </button>
        </form>
        <p className="auth-link">
          Student app? <button type="button" onClick={() => { window.location.href = '/'; }}>Go to student login</button>
        </p>
      </div>
    </div>
  );
};
