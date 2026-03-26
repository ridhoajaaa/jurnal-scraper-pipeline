import { create } from "zustand";

interface ScrapeProgress {
  message: string;
  percentage: number;
}

interface ScrapeState {
  isScraping: boolean;
  currentJobId: string | null;
  scrapeProgress: ScrapeProgress;
  captchaUrl: string | null;

  // Actions
  setIsScraping: (isScraping: boolean) => void;
  setCurrentJobId: (jobId: string | null) => void;
  setScrapeProgress: (progress: ScrapeProgress | ((prev: ScrapeProgress) => ScrapeProgress)) => void;
  setCaptchaUrl: (url: string | null) => void;
  resetScrapeState: () => void;
}

export const useScrapeStore = create<ScrapeState>((set) => ({
  isScraping: false,
  currentJobId: null,
  scrapeProgress: { message: "", percentage: 0 },
  captchaUrl: null,

  setIsScraping: (isScraping) => set({ isScraping }),
  setCurrentJobId: (currentJobId) => set({ currentJobId }),
  setScrapeProgress: (update) => set((state) => ({
    scrapeProgress: typeof update === 'function' ? update(state.scrapeProgress) : update
  })),
  setCaptchaUrl: (captchaUrl) => set({ captchaUrl }),
  resetScrapeState: () => set({
    isScraping: false,
    currentJobId: null,
    scrapeProgress: { message: "", percentage: 0 },
    captchaUrl: null
  }),
}));
