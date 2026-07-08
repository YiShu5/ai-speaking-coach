import { create } from "zustand";
import type {
  PracticeMode,
  PracticeStatus,
  TranscriptLine,
  AppUser,
} from "@/types";
import { getCurrentUser } from "@/lib/mock-api";

interface AppState {
  // 用户
  user: AppUser | null;
  setUser: (u: AppUser | null) => void;
  initUser: () => void;

  // 开始页选择
  mode: PracticeMode;
  setMode: (m: PracticeMode) => void;
  fileName: string;
  fileContent: string;
  setFile: (name: string, content: string) => void;
  clearFile: () => void;

  // 当前练习
  practiceId: string | null;
  setPracticeId: (id: string | null) => void;

  // 练习态
  status: PracticeStatus;
  setStatus: (s: PracticeStatus) => void;
  elapsed: number; // 秒
  setElapsed: (n: number) => void;
  pauseCount: number;
  incPause: () => void;
  transcript: TranscriptLine[];
  addTranscript: (line: TranscriptLine) => void;
  resetPractice: () => void;

  // Toast
  toast: string | null;
  showToast: (msg: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  setUser: (u) => set({ user: u }),
  initUser: () => set({ user: getCurrentUser() }),

  mode: "5min",
  setMode: (m) => set({ mode: m }),
  fileName: "",
  fileContent: "",
  setFile: (name, content) => set({ fileName: name, fileContent: content }),
  clearFile: () => set({ fileName: "", fileContent: "" }),

  practiceId: null,
  setPracticeId: (id) => set({ practiceId: id }),

  status: "idle",
  setStatus: (s) => set({ status: s }),
  elapsed: 0,
  setElapsed: (n) => set({ elapsed: n }),
  pauseCount: 0,
  incPause: () => set((st) => ({ pauseCount: st.pauseCount + 1 })),
  transcript: [],
  addTranscript: (line) =>
    set((st) => ({ transcript: [...st.transcript, line] })),
  resetPractice: () =>
    set({
      status: "idle",
      elapsed: 0,
      pauseCount: 0,
      transcript: [],
    }),

  toast: null,
  showToast: (msg) => {
    set({ toast: msg });
    setTimeout(() => set({ toast: null }), 1800);
  },
}));
