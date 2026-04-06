import { create } from "zustand";

export type PlatformMode = "custom" | "v8";

interface ModeState {
  mode: PlatformMode;
  setMode: (mode: PlatformMode) => void;
  toggleMode: () => void;
}

const getInitialMode = (): PlatformMode => {
  if (typeof window === "undefined") return "custom";
  return (localStorage.getItem("vgent_platform_mode") as PlatformMode) || "custom";
};

export const useModeStore = create<ModeState>((set) => ({
  mode: getInitialMode(),
  setMode: (mode) => {
    if (typeof window !== "undefined") localStorage.setItem("vgent_platform_mode", mode);
    set({ mode });
  },
  toggleMode: () =>
    set((s) => {
      const next = s.mode === "custom" ? "v8" : "custom";
      if (typeof window !== "undefined") localStorage.setItem("vgent_platform_mode", next);
      return { mode: next };
    }),
}));
