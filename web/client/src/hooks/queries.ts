import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { User } from "@/services/api";
import { api } from "@/services/api";
import { useAuthStore } from "@/stores/authStore";

// ================= AUTH & PROFILE HOOKS =================

export function useLogin() {
  const setCredentials = useAuthStore((state) => state.setCredentials);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.auth.login,
    onSuccess: (data) => {
      // Data expected: { success, username, role, isPremium, quotaUsed, quotaLimit, quotaRemaining, quotaExhausted, dailyScrapedToday, dailyLimit }
      if (data.success && data.username) {
        setCredentials(data as User);
        queryClient.invalidateQueries({ queryKey: ["profile"] });
      }
    },
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: api.auth.register,
  });
}

export function useLogout() {
  const logout = useAuthStore((state) => state.logout);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.auth.logout,
    onSuccess: () => {
      logout();
      queryClient.clear(); // Clear all cached user data
      window.location.href = "/login";
    },
  });
}

export function useProfile() {
  const { isAuthenticated } = useAuthStore();
  const updateUser = useAuthStore((state) => state.updateUser);
  
  const query = useQuery({
    queryKey: ["profile"],
    queryFn: api.profile.get,
    enabled: isAuthenticated,
  });

  // Sync profile data (role, username) back to the auth store via useEffect
  useEffect(() => {
    if (query.data?.role) {
      const currentUser = useAuthStore.getState().user;
      if (currentUser && (currentUser.role !== query.data.role || currentUser.username !== query.data.username || currentUser.email !== query.data.email)) {
        updateUser({ role: query.data.role, username: query.data.username, email: query.data.email });
      }
    }
  }, [query.data, updateUser]);

  return query;
}

export function useUpdateUsername() {
  const queryClient = useQueryClient();
  const updateUser = useAuthStore((state) => state.updateUser);

  return useMutation({
    mutationFn: api.profile.updateUsername,
    onSuccess: (data) => {
      if (data.success && data.username) {
        updateUser({ username: data.username });
        queryClient.invalidateQueries({ queryKey: ["profile"] });
      }
    },
  });
}

export function useUpdatePassword() {
  return useMutation({
    mutationFn: api.profile.updatePassword,
  });
}

export function useActivatePremium() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: api.profile.activatePremium,
    onSuccess: (data) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ["profile"] });
      }
    },
  });
}

// ================= JOURNALS (Scraped Data) HOOKS =================

export function useJournals() {
  return useQuery({
    queryKey: ["journals"],
    queryFn: api.journals.getAll,
  });
}

export function useDeleteJournals() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: api.journals.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journals"] });
    },
  });
}

// ================= SAVED JOURNALS HOOKS =================

export function useSavedJournals() {
  return useQuery({
    queryKey: ["saved-journals"],
    queryFn: api.saved.getAll,
  });
}

export function useSaveJournal() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: api.saved.save,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-journals"] });
      queryClient.invalidateQueries({ queryKey: ["saved-stats"] });
    },
  });
}

export function useDeleteSavedJournal() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: api.saved.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-journals"] });
      queryClient.invalidateQueries({ queryKey: ["saved-stats"] });
    },
  });
}

export function useUpdateSavedNote() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => api.saved.updateNote(id, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-journals"] });
    },
  });
}

export function useSavedStats() {
  return useQuery({
    queryKey: ["saved-stats"],
    queryFn: api.saved.getStats,
  });
}

export function useStats() {
  // Alias for Dashboard compatibility if needed, using GET /api/saved/stats as general stats
  return useQuery({
    queryKey: ["stats"],
    queryFn: api.saved.getStats, 
  });
}

// ================= SCRAPE HOOKS =================

export function useStartScrape() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: api.scrape.start,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["active-job"] });
      // If clearData was true, invalidate old journals
      queryClient.invalidateQueries({ queryKey: ["journals"] });
    },
  });
}

export function useActiveJob() {
  return useQuery({
    queryKey: ["active-job"],
    queryFn: api.scrape.getActiveJob,
    // Typical polling can be added here or handled via Socket.IO
  });
}

export function useCancelScrape() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: api.scrape.cancel,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["active-job"] });
    },
  });
}

// ================= AI SUMMARY HOOKS =================

export function useGenerateSummary() {
  return useMutation({
    mutationFn: ({ journalIds, language }: { journalIds: string[]; language: "id" | "en" }) => 
      api.summary.generate(journalIds, language),
  });
}

// ================= PROFILE UPDATE (combined) =================

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const updateUser = useAuthStore((state) => state.updateUser);

  return useMutation({
    mutationFn: async (payload: { username?: string; currentPassword?: string; newPassword?: string }) => {
      if (payload.username) {
        return api.profile.updateUsername(payload.username);
      }
      if (payload.currentPassword && payload.newPassword) {
        return api.profile.updatePassword({ currentPassword: payload.currentPassword, newPassword: payload.newPassword });
      }
      throw new Error("Invalid update payload");
    },
    onSuccess: (data: any) => {
      if (data?.username) {
        updateUser({ username: data.username });
      }
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}

// ================= ADMIN HOOKS =================

export function useAdminUsers() {
  const { user } = useAuthStore();
  return useQuery({
    queryKey: ["admin_users"],
    queryFn: api.admin.getUsers,
    enabled: user?.role === "admin",
    retry: false,
  });
}

export function useAdminJournals() {
  const { user } = useAuthStore();
  return useQuery({
    queryKey: ["admin_journals"],
    queryFn: api.admin.getJournals,
    enabled: user?.role === "admin",
    retry: false,
  });
}

export function useAdminDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.admin.deleteUser,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin_users"] }),
  });
}

export function useAdminVerifyUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.admin.verifyUserEmail,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin_users"] }),
  });
}

export function useAdminPromoteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.admin.promoteUser,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin_users"] }),
  });
}

export function useAdminGenerateToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.admin.generateToken,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin_users"] }),
  });
}

export function useAdminDeleteJournal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.admin.deleteJournal,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin_journals"] }),
  });
}

export function useAdminDeleteAllJournals() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.admin.deleteAllJournals,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin_journals"] }),
  });
}

