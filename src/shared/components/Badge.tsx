"use client";

type Tone = "primary" | "success" | "warning" | "danger" | "info" | "neutral";

const tones: Record<Tone, string> = {
  primary: "bg-primary-container text-on-primary-container",
  success: "bg-success/15 text-success ring-success/30",
  warning: "bg-warning/15 text-warning ring-warning/30",
  danger: "bg-danger/15 text-danger ring-danger/30",
  info: "bg-info/15 text-info ring-info/30",
  neutral: "bg-surface-variant text-ink-soft ring-border",
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
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ring-1 ring-inset ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
