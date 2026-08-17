"use client";

import type { InputHTMLAttributes } from "react";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className = "", ...rest }: Props) {
  return (
    <label className="block">
      {label && (
        <span className="mb-1 block text-xs font-medium text-ink-soft">
          {label}
        </span>
      )}
      <input
        className={`h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:opacity-50 ${className}`}
        {...rest}
      />
      {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
    </label>
  );
}
