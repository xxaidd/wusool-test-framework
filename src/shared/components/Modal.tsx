"use client";

import type { ReactNode } from "react";
import { Button } from "./Button";

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  width = "max-w-lg",
}: ModalProps) {
  if (!open) return null;
  return (
    <button
      type="button"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      aria-label="close backdrop"
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: stop backdrop click from closing the dialog */}
      <div
        className={`w-full ${width} overflow-hidden rounded-2xl border border-border bg-surface shadow-xl`}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="text-base font-semibold text-ink">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-ink-soft transition-colors hover:bg-surface-variant"
            aria-label="close"
          >
            ✕
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-border bg-surface-variant/50 px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </button>
  );
}

export function ModalFooter({
  cancelLabel,
  onCancel,
  confirmLabel,
  onConfirm,
  loading,
}: {
  cancelLabel: string;
  onCancel: () => void;
  confirmLabel: string;
  onConfirm: () => void;
  loading?: boolean;
}) {
  return (
    <>
      <Button variant="ghost" onClick={onCancel}>
        {cancelLabel}
      </Button>
      <Button onClick={onConfirm} disabled={loading}>
        {loading ? "…" : confirmLabel}
      </Button>
    </>
  );
}
