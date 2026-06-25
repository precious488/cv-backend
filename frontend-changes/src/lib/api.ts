/**
 * api.ts — Centralized API client for craft-your-career frontend.
 * Replaces all localStorage-direct access with proper backend calls.
 */

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:80/api';

// ─── Token management ─────────────────────────────────────────
const TOKEN_KEY = 'cyc_access_token';
const REFRESH_KEY = 'cyc_refresh_token';

export function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setTokens(access: string, refresh: string): void {
  localStorage.setItem(TOKEN_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
}
export function clearTokens(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}
export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

// ─── Core fetch wrapper ───────────────────────────────────────
let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

async function processRefreshQueue(newToken: string): Promise<void> {
  refreshQueue.forEach((resolve) => resolve(newToken));
  refreshQueue = [];
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  const token = getAccessToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  // Auto-refresh on 401
  if (res.status === 401) {
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      clearTokens();
      window.location.href = '/login';
      throw new Error('Session expired');
    }

    if (isRefreshing) {
      // Wait for the ongoing refresh
      return new Promise((resolve, reject) => {
        refreshQueue.push((newToken) => {
          headers['Authorization'] = `Bearer ${newToken}`;
          fetch(`${BASE_URL}${path}`, { ...options, headers })
            .then((r) => r.json())
            .then(resolve)
            .catch(reject);
        });
      });
    }

    isRefreshing = true;
    try {
      const refreshRes = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!refreshRes.ok) {
        clearTokens();
        window.location.href = '/login';
        throw new Error('Session expired');
      }

      const { data } = await refreshRes.json();
      setTokens(data.accessToken, data.refreshToken);
      await processRefreshQueue(data.accessToken);

      // Retry the original request
      headers['Authorization'] = `Bearer ${data.accessToken}`;
      const retryRes = await fetch(`${BASE_URL}${path}`, { ...options, headers });
      return retryRes.json() as Promise<T>;
    } finally {
      isRefreshing = false;
    }
  }

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ error: res.statusText }));
    throw new APIError(errorBody.error ?? 'Request failed', res.status, errorBody);
  }

  // Document download — return blob
  const contentType = res.headers.get('Content-Type') ?? '';
  if (contentType.includes('application/pdf')) {
    return res.blob() as unknown as T;
  }

  return res.json() as Promise<T>;
}

export class APIError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: unknown
  ) {
    super(message);
    this.name = 'APIError';
  }
}

// ─── Auth API ─────────────────────────────────────────────────
export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: 'free' | 'pro' | 'admin';
}

export interface AuthResponse {
  success: boolean;
  data: { user: AuthUser; accessToken: string; refreshToken: string };
}

export const authAPI = {
  register: (payload: { email: string; password: string; fullName: string }) =>
    apiFetch<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify(payload) }),

  login: (payload: { email: string; password: string }) =>
    apiFetch<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(payload) }),

  logout: (refreshToken: string) =>
    apiFetch('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) }),

  me: () => apiFetch<{ success: boolean; data: AuthUser }>('/auth/me'),

  changePassword: (payload: { currentPassword: string; newPassword: string }) =>
    apiFetch('/auth/change-password', { method: 'PUT', body: JSON.stringify(payload) }),
};

// ─── Resume API ───────────────────────────────────────────────
export interface ResumeFromAPI {
  _id: string;
  userId: string;
  title: string;
  personalInfo: {
    fullName: string; email: string; phone: string;
    location: string; title: string; website: string; linkedin: string;
  };
  summary: string;
  experience: Array<{ id: string; company: string; position: string; startDate: string; endDate: string; current: boolean; description: string }>;
  education: Array<{ id: string; school: string; degree: string; field: string; startDate: string; endDate: string; description: string }>;
  skills: string[];
  projects: Array<{ id: string; name: string; description: string; technologies: string; link: string }>;
  certifications: Array<{ id: string; name: string; issuer: string; date: string }>;
  languages: string[];
  template: 'modern' | 'classic' | 'minimal' | 'corporate';
  createdAt: string;
  updatedAt: string;
}

export const resumeAPI = {
  list: () => apiFetch<{ success: boolean; data: ResumeFromAPI[] }>('/resumes'),
  get: (id: string) => apiFetch<{ success: boolean; data: ResumeFromAPI }>(`/resumes/${id}`),
  create: (data: Partial<ResumeFromAPI>) =>
    apiFetch<{ success: boolean; data: ResumeFromAPI }>('/resumes', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<ResumeFromAPI>) =>
    apiFetch<{ success: boolean; data: ResumeFromAPI }>(`/resumes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => apiFetch(`/resumes/${id}`, { method: 'DELETE' }),
  duplicate: (id: string) =>
    apiFetch<{ success: boolean; data: ResumeFromAPI }>(`/resumes/${id}/duplicate`, { method: 'POST' }),
};

// ─── Document API ─────────────────────────────────────────────
export const documentAPI = {
  generatePDF: async (resumeData: unknown): Promise<Blob> => {
    return apiFetch<Blob>('/documents/generate', {
      method: 'POST',
      body: JSON.stringify({ resumeData, format: 'pdf' }),
    });
  },
};

// ─── ATS API ──────────────────────────────────────────────────
export interface ATSResult {
  overallScore: number;
  breakdown: {
    keywordMatch: number;
    sectionCompleteness: number;
    formattingScore: number;
    quantifiableAchievements: number;
    actionVerbs: number;
  };
  matchedKeywords: string[];
  missingKeywords: string[];
  suggestions: string[];
  sectionScores: Record<string, number>;
}

export const atsAPI = {
  analyze: (resumeData: unknown, jobDescription?: string, cvId?: string) =>
    apiFetch<{ success: boolean; data: ATSResult }>('/ats/analyze', {
      method: 'POST',
      body: JSON.stringify({ resumeData, jobDescription, cvId }),
    }),
};

// ─── AI API ───────────────────────────────────────────────────
export const aiAPI = {
  improveSummary: (payload: { currentSummary: string; jobTitle?: string; skills?: string[] }) =>
    apiFetch<{ success: boolean; data: { improved: string } }>('/ai/improve-summary', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  generateBullets: (payload: { position: string; company?: string; existingDescription?: string; numberOfPoints?: number }) =>
    apiFetch<{ success: boolean; data: { bullets: string[] } }>('/ai/bullet-points', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  suggestSkills: (payload: { jobTitle: string; existingSkills?: string[]; experience?: string }) =>
    apiFetch<{ success: boolean; data: { skills: string[] } }>('/ai/suggest-skills', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  autocomplete: (payload: { field: 'summary' | 'description' | 'projectDescription'; partialText: string; context?: object }) =>
    apiFetch<{ success: boolean; data: { suggestion: string } }>('/ai/autocomplete', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

// ─── Profile API ──────────────────────────────────────────────
export const profileAPI = {
  get: () => apiFetch<{ success: boolean; data: unknown }>('/profile/me'),
  update: (data: unknown) =>
    apiFetch('/profile/me', { method: 'PUT', body: JSON.stringify(data) }),
};
