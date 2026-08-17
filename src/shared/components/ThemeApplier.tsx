"use client";

import { useEffect } from "react";
import { useUIStore } from "@/shared/store/ui.store";

export function ThemeApplier() {
  const theme = useUIStore((s) => s.theme);
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);
  return null;
}
