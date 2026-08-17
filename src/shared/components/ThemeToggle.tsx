"use client";

export function ThemeToggle({
  theme,
  onToggle,
}: {
  theme: "light" | "dark";
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-ink transition-colors hover:border-primary hover:text-primary"
      title={theme === "light" ? "Dark mode" : "Light mode"}
    >
      {theme === "light" ? "☾" : "☀"}
    </button>
  );
}
