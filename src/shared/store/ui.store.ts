"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ActionMode } from "@/features/actions/domain/action.types";

export type Theme = "light" | "dark";
export type PanelKey = "actors" | "session";

interface UIState {
  theme: Theme;
  activePanel: PanelKey;
  actionMode: ActionMode;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
  setActivePanel: (p: PanelKey) => void;
  setActionMode: (m: ActionMode) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      theme: "light",
      activePanel: "actors",
      actionMode: ActionMode.Simple,
      setTheme: (theme) => set({ theme }),
      toggleTheme: () =>
        set({ theme: get().theme === "light" ? "dark" : "light" }),
      setActivePanel: (activePanel) => set({ activePanel }),
      setActionMode: (actionMode) => set({ actionMode }),
    }),
    { name: "wusool-ui" },
  ),
);
