import { apiClient } from "@/lib/api-client";

// ================= TYPES =================

export interface User {
  username: string;
  email?: string;
  role: "user" | "premium" | "admin";
  isPremium: boolean;
  isEmailVerified?: boolean;
  createdAt?: string;
  quotaUsed: number;
  quotaLimit: number;
  quotaRemaining?: number;
  quotaExhausted?: boolean;
  dailyScrapedToday: number;
  dailyLimit: number;
  summaryCount?: number;
}

export interface Journal {
  _id: string;
  judul: string;
  author_info: string;
  tahun: string;
  abstrak_lengkap: string;
  Kategori: string;
  Relevansi: number;
  citationCount: number;
  link: string;
  source: string;
  isBook: boolean;
  keyword: string;
  journal: string;
  isDuplicateSuspect: string;
  duplicateOf: string;
  Akses: string;
}

export interface SavedJournal extends Journal {
  note?: string;
  savedAt: string;
}

export interface Stats {
  total: number;
  byYear: { label: string; count: number }[];
  bySource: { label: string; count: number }[];
  byCategory: { label: string; count: number }[];
}

// ================= API ENDPOINTS =================

export const api = {
  // --- AUTH ---
  auth: {
    register: async (data: any) => {
      const res = await apiClient.post("/api/auth/register", data);
      return res.data;
    },
    login: async (data: any) => {
      const res = await apiClient.post("/api/auth/login", data);
      return res.data; // { success, username, role, isPremium, quotaUsed, ... }
    },
    logout: async () => {
      const res = await apiClient.post("/api/auth/logout");
      return res.data;
    },
    me: async () => {
      const res = await apiClient.get("/api/auth/me");
      return res.data; // { loggedIn: boolean, username?, role? }
    },
  },

  // --- PROFILE ---
  profile: {
    get: async (): Promise<User> => {
      const res = await apiClient.get("/api/profile");
      return res.data;
    },
    updateUsername: async (username: string) => {
      const res = await apiClient.patch("/api/profile/username", { username });
      return res.data;
    },
    updatePassword: async (data: any) => {
      const res = await apiClient.patch("/api/profile/password", data);
      return res.data;
    },
    activatePremium: async (token: string) => {
      const res = await apiClient.post("/api/activate-premium", { token });
      return res.data;
    },
  },

  // --- JOURNALS (Scraped Data) ---
  journals: {
    getAll: async (): Promise<Journal[]> => {
      const res = await apiClient.get("/api/data");
      return res.data;
    },
    delete: async (ids?: string[]) => {
      const res = await apiClient.delete("/api/data", { data: { ids } });
      return res.data;
    },
  },

  // --- SAVED JOURNALS ---
  saved: {
    getAll: async (): Promise<SavedJournal[]> => {
      const res = await apiClient.get("/api/saved");
      return res.data;
    },
    save: async (journal: Journal) => {
      const res = await apiClient.post("/api/saved", journal);
      return res.data;
    },
    delete: async (id: string) => {
      const res = await apiClient.delete(`/api/saved/${id}`);
      return res.data;
    },
    updateNote: async (id: string, note: string) => {
      const res = await apiClient.patch(`/api/saved/${id}/note`, { note });
      return res.data;
    },
    getStats: async (): Promise<Stats> => {
      const res = await apiClient.get("/api/saved/stats");
      return res.data;
    },
  },

  // --- SCRAPE ---
  scrape: {
    start: async (data: {
      keyword: string;
      source: "scholar" | "scopus" | "semantic";
      yearFrom?: string;
      yearTo?: string;
      target?: number;
      clearData?: boolean;
      apiKey?: string;
    }) => {
      const res = await apiClient.post("/api/scrape", data);
      return res.data; // { status: "queued", jobId, queuePosition }
    },
    getActiveJob: async () => {
      const res = await apiClient.get("/api/scrape/my-active-job");
      return res.data; // { jobId, status, queuePosition, progress }
    },
    cancel: async (jobId: string) => {
      const res = await apiClient.post(`/api/scrape/${jobId}/cancel`);
      return res.data;
    },
  },

  // --- AI SUMMARY ---
  summary: {
    generate: async (journalIds: string[], language: "id" | "en") => {
      const res = await apiClient.post("/api/summary", { journalIds, language });
      return res.data; // { summary, journalCount }
    },
  },

  // --- ADMIN ---
  admin: {
    getUsers: async () => {
      const res = await apiClient.get("/api/admin/users");
      return res.data;
    },
    deleteUser: async (id: string) => {
      const res = await apiClient.delete(`/api/admin/users/${id}`);
      return res.data;
    },
    verifyUserEmail: async (id: string) => {
      const res = await apiClient.patch(`/api/admin/users/${id}/verify`);
      return res.data;
    },
    promoteUser: async (id: string) => {
      const res = await apiClient.patch(`/api/admin/users/${id}/promote`);
      return res.data;
    },
    generateToken: async (id: string) => {
      const res = await apiClient.post(`/api/admin/users/${id}/generate-token`);
      return res.data;
    },
    getJournals: async () => {
      const res = await apiClient.get("/api/admin/journals");
      return res.data;
    },
    deleteJournal: async (id: string) => {
      const res = await apiClient.delete(`/api/admin/journals/${id}`);
      return res.data;
    },
    deleteAllJournals: async () => {
      const res = await apiClient.delete("/api/admin/journals/all");
      return res.data;
    },
  },
};
