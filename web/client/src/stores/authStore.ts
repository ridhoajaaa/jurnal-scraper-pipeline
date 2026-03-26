import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { User } from "@/services/api";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  
  // Actions
  setCredentials: (user: User) => void;
  updateUser: (updates: Partial<User>) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,

      // Token parameter is removed because backend uses session cookies
      setCredentials: (user) => 
        set({ user, isAuthenticated: true }),

      updateUser: (updates) => 
        set((state) => ({ 
          user: state.user ? { ...state.user, ...updates } : null 
        })),

      logout: () => 
        set({ user: null, isAuthenticated: false }),
    }),
    {
      name: "litassist-auth-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);
