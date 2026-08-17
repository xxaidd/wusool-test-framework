"use client";

type Tone = "primary" | "success" | "warning" | "danger" | "info" | "neutral";

const tones: Record<Tone, string> = {
  primary: "bg-primary-container text-on-primary-container",
  success: "bg-success-container text-success",
  warning: "bg-warning-container text-warning",
  danger: "bg-danger-container text-danger",
  info: "bg-info-container text-info",
  neutral: "bg-surface-variant text-ink-soft",
};

export function Badge({
  tone = "neutral",
  children,
  className = "",
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
