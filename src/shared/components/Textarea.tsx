"use client";

import type { TextareaHTMLAttributes } from "react";

interface Props extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

export function Textarea({ label, className = "", ...rest }: Props) {
  return (
    <label className="block">
      {label && (
        <span className="mb-1 block text-xs font-medium text-ink-soft">
          {label}
        </span>
      )}
      <textarea
        className={`min-h-[72px] w-full rounded-lg border border-border bg-surface p-3 text-sm text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-primary focus:ring-2 focus:ring-primary/30 ${className}`}
        {...rest}
      />
    </label>
  );
}
