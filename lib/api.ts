/**
 * Centralized API helper.
 * All client-side requests go through these functions.
 * When backend endpoints are ready, only the base URLs / paths need updating.
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, headers = {} } = options;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || data.message || "Request failed");
  }

  return data as T;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const authApi = {
  register: (payload: {
    name: string;
    username: string;
    email: string;
    password: string;
    city?: string;
    skills?: string[];
  }) => request("/api/auth/register", { method: "POST", body: payload }),

  login: (payload: { identifier: string; password: string }) =>
    request("/api/auth/login", { method: "POST", body: payload }),

  logout: () => request("/api/auth/logout", { method: "POST" }),

  me: () => request("/api/auth/me"),
};

// ─── User / Profile ───────────────────────────────────────────────────────────

export const userApi = {
  getProfile: () => request("/api/user/profile"),

  updateProfile: (payload: Partial<{
    name: string;
    phone: string;
    city: string;
    state: string;
    country: string;
    skills: string[];
    education: unknown[];
    experiences: unknown[];
  }>) => request("/api/user/profile", { method: "PUT", body: payload }),

  changePassword: (payload: {
    currentPassword: string;
    newPassword: string;
  }) => request("/api/user/password", { method: "PUT", body: payload }),

  uploadResume: (formData: FormData) =>
    fetch(`${BASE_URL}/api/user/resume`, {
      method: "POST",
      body: formData,
      credentials: "include",
    }).then((r) => r.json()),
};

// ─── Internships ──────────────────────────────────────────────────────────────

export const internshipApi = {
  list: (params: Record<string, string | number | boolean | string[]>) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (Array.isArray(v)) {
        v.forEach((item) => query.append(k, item));
      } else {
        query.set(k, String(v));
      }
    });
    return request(`/api/internships?${query.toString()}`);
  },

  getById: (id: string) => request(`/api/internships/${id}`),

  apply: (id: string) =>
    request(`/api/internships/${id}/apply`, { method: "POST" }),

  save: (id: string) =>
    request(`/api/internships/${id}/save`, { method: "POST" }),

  unsave: (id: string) =>
    request(`/api/internships/${id}/save`, { method: "DELETE" }),

  // TODO: connect to recommender model
  getRecommended: () => request("/api/internships/recommended"),
};
