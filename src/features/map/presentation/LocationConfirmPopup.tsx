"use client";

import { Check, X } from "lucide-react";
import { useCallback, useEffect } from "react";
import { Button } from "@/shared/components/Button";
import { useI18n } from "@/shared/i18n";
import { useActorStore } from "@/shared/store/actor.store";
import { useMapStore } from "@/shared/store/map.store";

interface LocationConfirmPopupProps {
  onConfirm: () => void;
  onCancel: () => void;
}

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    el.isContentEditable
  );
}

export function LocationConfirmPopup({
  onConfirm,
  onCancel,
}: LocationConfirmPopupProps) {
  const { t } = useI18n();
  const pending = useMapStore((s) => s.pendingLocation);
  const actorLabel = useActorStore((s) =>
    pending
      ? s.workspace.find((a) => a.id === pending.actorId)?.label
      : undefined,
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter") onConfirm();
    },
    [onConfirm, onCancel],
  );

  useEffect(() => {
    if (pending) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [pending, handleKeyDown]);

  if (!pending) return null;

  return (
    <div className="pointer-events-auto absolute bottom-20 left-1/2 z-[600] -translate-x-1/2">
      <div className="rounded-xl border border-border bg-surface/95 px-4 py-3 shadow-lg backdrop-blur-sm">
        <div className="mb-1 text-center text-sm font-semibold text-ink">
          {actorLabel || pending.actorId}
        </div>
        <div className="mb-2 text-center text-xs font-medium text-ink-soft">
          {t("map.confirmLocation")}
        </div>
        <div className="mb-3 text-center font-mono text-xs text-ink">
          {pending.lat.toFixed(5)}, {pending.lng.toFixed(5)}
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="flex-1"
          >
            <X size={14} />
            {t("common.cancel")}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={onConfirm}
            className="flex-1"
          >
            <Check size={14} />
            {t("common.confirm")}
          </Button>
        </div>
      </div>
    </div>
  );
}
