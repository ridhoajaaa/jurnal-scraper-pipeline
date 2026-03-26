import { create } from "zustand"
import { persist } from "zustand/middleware"

interface ThemeState {
  isDark: boolean
  sidebarCollapsed: boolean
  toggle: () => void
  setDark: (value: boolean) => void
  toggleSidebar: () => void
  setSidebarCollapsed: (value: boolean) => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      isDark: true,
      sidebarCollapsed: false,
      toggle: () => set((state) => ({ isDark: !state.isDark })),
      setDark: (value) => set({ isDark: value }),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: (value) => set({ sidebarCollapsed: value }),
    }),
    {
      name: "litassist-theme",
    }
  )
)