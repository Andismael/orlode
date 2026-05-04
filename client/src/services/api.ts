import axios from 'axios';
import { auth } from './firebase';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach Firebase ID token to every request
api.interceptors.request.use(async (config) => {
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Unwrap { success, data } envelope so callers get r.data = the payload directly.
// IMPORTANT: use r.data (NOT r.data.data) everywhere. Defensive pattern: r.data?.x ?? r.data
api.interceptors.response.use(
  (response) => {
    const body = response.data as Record<string, unknown>;
    if (body && typeof body === 'object' && 'success' in body && 'data' in body) {
      response.data = body.data;
    }
    return response;
  },
  (error: unknown) => {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        // Only force logout if there's truly no user. Otherwise let the caller handle —
        // a single endpoint returning 401 shouldn't blow up the whole session.
        if (!auth.currentUser) {
          auth.signOut();
          window.location.href = '/login';
        }
      }
      const message = (error.response?.data as { message?: string })?.message ?? error.message;
      const enriched: any = new Error(message);
      enriched.response = error.response;
      enriched.status = error.response?.status;
      return Promise.reject(enriched);
    }
    return Promise.reject(error);
  }
);

export default api;
