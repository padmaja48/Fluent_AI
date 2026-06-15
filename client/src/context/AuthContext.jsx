import React, { createContext, useState, useCallback, useEffect } from 'react';
import { authAPI } from '../services/api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('accessToken') || localStorage.getItem('token'));
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(Boolean(token));
  const [error, setError] = useState(null);

  useEffect(() => {
    if (window.location.pathname !== '/auth/callback') {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const callbackToken = params.get('accessToken');
    if (!callbackToken) {
      setInitializing(false);
      setError('Google sign-in failed');
      window.history.replaceState({}, document.title, '/');
      return;
    }

    localStorage.setItem('accessToken', callbackToken);
    localStorage.setItem('token', callbackToken);
    setToken(callbackToken);
    setInitializing(true);
    window.history.replaceState({}, document.title, '/');
  }, []);

  useEffect(() => {
    const loadProfile = async () => {
      if (!token) {
        setInitializing(false);
        return;
      }

      try {
        const response = await authAPI.getProfile();
        setUser(response.data);
      } catch (err) {
        setToken(null);
        localStorage.removeItem('accessToken');
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
      } finally {
        setInitializing(false);
      }
    };

    loadProfile();
  }, [token]);

  const refreshProfile = useCallback(async () => {
    if (!token) return null;
    const response = await authAPI.getProfile();
    setUser(response.data);
    return response.data;
  }, [token]);

  const register = useCallback(async (name, email, password, level) => {
    setLoading(true);
    setError(null);
    try {
      const response = await authAPI.register(name, email, password, level);
      const { accessToken, token: legacyToken, refreshToken, user: userData } = response.data;
      const newToken = accessToken || legacyToken;
      setToken(newToken);
      setUser(userData);
      localStorage.setItem('accessToken', newToken);
      localStorage.setItem('token', newToken);
      if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
      return response.data;
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      const response = await authAPI.login(email, password);
      const { accessToken, token: legacyToken, refreshToken, user: userData } = response.data;
      const newToken = accessToken || legacyToken;
      setToken(newToken);
      setUser(userData);
      localStorage.setItem('accessToken', newToken);
      localStorage.setItem('token', newToken);
      if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
      return response.data;
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const loginWithGoogle = useCallback(async (credential) => {
    setLoading(true);
    setError(null);
    try {
      const response = await authAPI.googleLogin(credential);
      const { accessToken, token: legacyToken, refreshToken, user: userData } = response.data;
      const newToken = accessToken || legacyToken;
      setToken(newToken);
      setUser(userData);
      localStorage.setItem('accessToken', newToken);
      localStorage.setItem('token', newToken);
      if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
      return response.data;
    } catch (err) {
      setError(err.response?.data?.error || 'Google sign-in failed');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('accessToken');
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, initializing, error, register, login, loginWithGoogle, logout, refreshProfile, setUser }}>
      {children}
    </AuthContext.Provider>
  );
};
