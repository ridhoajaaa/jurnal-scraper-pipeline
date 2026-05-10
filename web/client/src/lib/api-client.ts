import axios from "axios";
import { useAuthStore } from "@/stores/authStore";

// In dev mode, Vite proxy forwards /api → localhost:3000, so use relative URLs.
// In production (served by Express), same-origin is automatic.
const API_URL = import.meta.env.VITE_API_URL || "";

export const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true, // Crucial for cookie-based session auth
  headers: {
    "Content-Type": "application/json",
  },
});

// Response Interceptor: Handle Global Errors (like 401 Unauthorized)
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response.status === 401) {
      // Jangan redirect kalau ini adalah login request itu sendiri
      if (!error.config?.url?.includes('/auth/login')) {
        useAuthStore.getState().logout();
        window.location.href = "/login";
      }
    }

    // Pass the error back with status preserved for retry logic
    const message = error.response?.data?.message || error.response?.data?.error || error.message || "An unexpected error occurred";
    const enrichedError: any = new Error(message);
    enrichedError.status = error.response?.status;
    enrichedError.response = error.response;
    return Promise.reject(enrichedError);
  }
);
