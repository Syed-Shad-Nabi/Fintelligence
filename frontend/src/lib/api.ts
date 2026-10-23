import axios, { AxiosInstance } from "axios";
import { getToken, clearAuth } from "./auth";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// Attach JWT token automatically
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 by clearing auth
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      clearAuth();
      if (typeof window !== "undefined") window.location.href = "/";
    }
    return Promise.reject(err);
  }
);

export default api;

// ─── Auth ────────────────────────────────────────────────────────────────────

export const authApi = {
  signup: (username: string, email: string, password: string) =>
    api.post("/api/auth/signup", { username, email, password }),
  login: (username: string, password: string) =>
    api.post("/api/auth/login", { username, password }),
  me: () => api.get("/api/auth/me"),
};

// ─── Analysis ────────────────────────────────────────────────────────────────

export const analysisApi = {
  upload: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return api.post("/api/analysis/upload", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  status: (reportId: string) => api.get(`/api/analysis/status/${reportId}`),
};

// ─── Reports ─────────────────────────────────────────────────────────────────

export const reportsApi = {
  list: () => api.get("/api/reports/"),
  get: (id: string) => api.get(`/api/reports/${id}`),
  delete: (id: string) => api.delete(`/api/reports/${id}`),
};

// ─── Insights (on-demand metric explanations) ─────────────────────────────────

export const insightsApi = {
  generate: (reportId: string) => api.get(`/api/analysis/insights/${reportId}`),
};

// ─── System ──────────────────────────────────────────────────────────────────

export const systemApi = {
  modelInfo: () => api.get("/api/system/model-info"),
};

// ─── Chat (SSE) ───────────────────────────────────────────────────────────────

export function streamChat(
  message: string,
  reportId: string | null,
  history: { role: string; content: string }[],
  onToken: (token: string) => void,
  onDone: () => void,
  onError: (err: string) => void
) {
  const token = getToken();
  fetch(`${BASE_URL}/api/analysis/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ message, report_id: reportId, history }),
  })
    .then(async (res) => {
      if (!res.ok) {
        onError(`Server error: ${res.status}`);
        return;
      }
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const payload = line.slice(6).trim();
            if (payload === "[DONE]") {
              onDone();
              return;
            }
            try {
              const parsed = JSON.parse(payload);
              if (parsed.content) onToken(parsed.content);
            } catch {
              // skip malformed
            }
          }
        }
      }
      onDone();
    })
    .catch((e) => onError(String(e)));
}
