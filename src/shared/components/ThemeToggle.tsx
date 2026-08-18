"use client";

import { Moon, Sun } from "lucide-react";
import { motion } from "motion/react";

export function ThemeToggle({
  theme,
  onToggle,
}: {
  theme: "light" | "dark";
  onToggle: () => void;
}) {
  const isDark = theme === "dark";
  return (
    <motion.button
      type="button"
      onClick={onToggle}
      whileTap={{ scale: 0.9 }}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-ink transition-colors hover:border-primary hover:text-primary"
      title={theme === "light" ? "Dark mode" : "Light mode"}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      <motion.span
        key={theme}
        initial={{ rotate: -60, opacity: 0, scale: 0.6 }}
        animate={{ rotate: 0, opacity: 1, scale: 1 }}
        transition={{ type: "spring", duration: 0.4 }}
      >
        {isDark ? <Moon size={17} /> : <Sun size={17} />}
      </motion.span>
    </motion.button>
  );
}
