import axios from 'axios';

const defaultApiUrl =
  typeof window !== 'undefined' && import.meta.env.PROD
    ? window.location.origin
    : 'http://localhost:4000';
const rawApiUrl = (import.meta.env.VITE_API_URL || defaultApiUrl).replace(/\/$/, '');
const API_BASE_URL = rawApiUrl.endsWith('/api') ? rawApiUrl : `${rawApiUrl}/api`;

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const refreshToken = localStorage.getItem('refreshToken');

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const response = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          refreshToken ? { refreshToken } : {},
          { withCredentials: true },
        );
        localStorage.setItem('accessToken', response.data.accessToken);
        localStorage.setItem('token', response.data.accessToken);
        localStorage.setItem('refreshToken', response.data.refreshToken);
        originalRequest.headers.Authorization = `Bearer ${response.data.accessToken}`;
        return api(originalRequest);
      } catch {
        // Refresh failed — clear tokens and let caller handle 401
        localStorage.removeItem('accessToken');
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
      }
    }

    return Promise.reject(error);
  }
);

// Auth endpoints
export const authAPI = {
  register: (name, email, password, level) =>
    api.post('/auth/register', { name, email, password, level }),
  login: (email, password) =>
    api.post('/auth/login', { email, password }),
  googleLogin: (credential) => api.post('/auth/google', { credential }),
  verifyEmail: (email, otp) => api.post('/auth/verify-email', { email, otp }),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (email, otp, password) => api.post('/auth/reset-password', { email, otp, password }),
  refresh: (refreshToken) => api.post('/auth/refresh', { refreshToken }),
  logout: (refreshToken) => api.post('/auth/logout', { refreshToken }),
  getProfile: () => api.get('/auth/profile'),
};

// User endpoints
export const userAPI = {
  getDashboard: () => api.get('/users/dashboard'),
  updateProfile: (dataOrName, level) =>
    typeof dataOrName === 'object'
      ? api.put('/users/profile', dataOrName)
      : api.put('/users/profile', { name: dataOrName, level }),
  changePassword: (currentPassword, newPassword) =>
    api.post('/users/change-password', { currentPassword, newPassword }),
  getAllUsers: () => api.get('/users/all'),
};

// Questions endpoints
export const questionAPI = {
  getQuestions: (skill, level, params = {}) =>
    api.get('/questions', { params: { skill, level, ...params } }),
  getQuestion: (id) => api.get(`/questions/${id}`),
  createQuestion: (data) => api.post('/questions', data),
  updateQuestion: (id, data) => api.put(`/questions/${id}`, data),
  deleteQuestion: (id) => api.delete(`/questions/${id}`),
  uploadAudio: (formData) =>
    api.post('/questions/upload-audio', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  bulkInsert: (questions) => api.post('/questions/bulk', { questions }),
  getRandom: (skill, level, limit = 10) =>
    api.get('/questions', { params: { skill, level, random: true, limit, status: 'Active' } }),
};

export const cefrContentAPI = {
  list: (params = {}) => api.get('/cefr-content', { params }),
};

// Session endpoints
export const sessionAPI = {
  createSession: (skill, level, setNumber, moduleOrder, moduleSetNumber) =>
    api.post('/sessions', { skill, level, setNumber, moduleOrder, moduleSetNumber }),
  getJourney: () => api.get('/sessions/journey'),
  getTestJourney: () => api.get('/sessions/tests/journey'),
  createMixedTest: (level, testNumber) => api.post('/sessions/tests', { level, testNumber }),
  getSession: (id) => api.get(`/sessions/${id}`),
  getUserSessions: () => api.get('/sessions/user-sessions'),
  getInProgress: () => api.get('/sessions/in-progress'),
  submitAnswer: (sessionId, questionId, answer, isCorrect, score) =>
    api.post('/sessions/answer', { sessionId, questionId, answer, isCorrect, score }),
  submitSession: (sessionId, duration, skillBreakdown) =>
    api.post('/sessions/submit', { sessionId, duration, skillBreakdown }),
  checkSpeaking: (formData) =>
    api.post('/sessions/speaking/check', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  getImageDescriptionImages: (level) =>
    api.get('/sessions/speaking/image-description/images', { params: { level } }),
  checkImageDescription: (formData) =>
    api.post('/sessions/speaking/image-description/check', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  checkWriting: (prompt, level, criteria, userText) =>
    api.post('/sessions/writing/check', { prompt, level, criteria, userText }),
};

export const ttsAPI = {
  synthesize: (text, speaker = 'priya', options = {}) =>
    api.post('/tts', { text, speaker, ...options }, { responseType: 'blob' }),
};

// Interview endpoints
export const interviewAPI = {
  createInterview: (data) => api.post('/interviews', data),
  startInterview: (interviewId) =>
    api.post('/interviews/start', { interviewId }),
  submitAnswer: (interviewId, question, answer) =>
    api.post('/interviews/answer', { interviewId, question, answer }),
  completeInterview: (interviewId, feedback, totalScore) =>
    api.post('/interviews/complete', { interviewId, feedback, totalScore }),
  getState: (interviewId) => api.get(`/interviews/${interviewId}/state`),
  speak: (interviewId, text, voiceStyle = 'default') =>
    api.post(`/interviews/${interviewId}/speak`, { text, voiceStyle }, { responseType: 'blob' }),
  transcribe: (interviewId, formData) =>
    api.post(`/interviews/${interviewId}/transcribe`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  uploadRecording: (interviewId, formData) =>
    api.post(`/interviews/${interviewId}/recording`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  getUserInterviews: () => api.get('/interviews/user-interviews'),
  logViolation: (id, type, description) =>
    api.patch(`/interviews/${id}/violation`, { type, description }),
  getReport: (id) => api.get(`/interviews/${id}/report`),
  personaPreview: (personaId) =>
    api.post('/interviews/persona-preview', { personaId }, { responseType: 'blob' }),
};

// Test endpoints
export const testAPI = {
  list: (level) => api.get('/tests', { params: level ? { level } : {} }),
  get: (id) => api.get(`/tests/${id}`),
  getQuestions: (id) => api.get(`/tests/${id}/questions`),
  create: (data) => api.post('/tests', data),
  update: (id, data) => api.put(`/tests/${id}`, data),
  delete: (id) => api.delete(`/tests/${id}`),
};

// Admin analytics
export const adminAPI = {
  getUserAnalytics: (userId) => api.get(`/users/${userId}/analytics`),
  getAllUsers: () => api.get('/users/all'),
};

export const resumeAPI = {
  upload: (formData) =>
    api.post('/resumes', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  getHistory: () => api.get('/resumes'),
  getResume: (id) => api.get(`/resumes/${id}`),
};

export const scheduleAPI = {
  create: (data) => api.post('/schedules', data),
  list: () => api.get('/schedules'),
  reschedule: (id, data) => api.put(`/schedules/${id}`, data),
  cancel: (id) => api.delete(`/schedules/${id}`),
};

export const reportAPI = {
  list: () => api.get('/reports'),
  get: (id) => api.get(`/reports/${id}`),
};

export default api;
