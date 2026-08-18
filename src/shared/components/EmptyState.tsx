"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  const Icon = icon;
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      {Icon && (
        <div className="grid size-14 place-items-center rounded-2xl border border-primary/20 bg-gradient-to-br from-primary-container to-secondary-container text-primary shadow-sm">
          <Icon size={26} strokeWidth={1.75} />
        </div>
      )}
      <p className="text-sm font-semibold text-ink">{title}</p>
      {hint && <p className="max-w-xs text-xs text-ink-soft">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
