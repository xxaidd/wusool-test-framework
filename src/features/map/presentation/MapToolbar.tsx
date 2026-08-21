"use client";

import { Check, History, Pen, Play, Square, X } from "lucide-react";
import { Button } from "@/shared/components/Button";
import { useI18n } from "@/shared/i18n";
import { useMapStore } from "@/shared/store/map.store";

interface MapToolbarProps {
  hasRoute: boolean;
  hasSelectedActor: boolean;
  isFollowing: boolean;
  hasHistoryPaths: boolean;
  onStartFollow: () => void;
  onStopFollow: () => void;
}

export function MapToolbar({
  hasRoute,
  hasSelectedActor,
  isFollowing,
  hasHistoryPaths,
  onStartFollow,
  onStopFollow,
}: MapToolbarProps) {
  const { t } = useI18n();
  const drawing = useMapStore((s) => s.drawing);
  const showHistory = useMapStore((s) => s.showHistory);
  const startDrawing = useMapStore((s) => s.startDrawing);
  const finishDrawing = useMapStore((s) => s.finishDrawing);
  const cancelDrawing = useMapStore((s) => s.cancelDrawing);
  const toggleHistory = useMapStore((s) => s.toggleHistory);

  return (
    <div className="absolute start-3 top-3 z-[500] flex flex-col gap-1.5 rounded-xl border border-border bg-surface/95 p-1.5 shadow-md backdrop-blur">
      {!drawing ? (
        <Button variant="subtle" size="sm" onClick={startDrawing}>
          <Pen size={15} />
          {t("map.startDrawing")}
        </Button>
      ) : (
        <>
          <Button size="sm" onClick={finishDrawing} disabled={!hasRoute}>
            <Check size={15} />
            {t("map.finishDrawing")}
          </Button>
          <Button variant="ghost" size="sm" onClick={cancelDrawing}>
            <X size={15} />
            {t("map.cancelDrawing")}
          </Button>
        </>
      )}
      {hasRoute && !drawing && (
        <Button
          variant={isFollowing ? "danger" : "secondary"}
          size="sm"
          onClick={() => {
            if (isFollowing) {
              onStopFollow();
            } else if (hasSelectedActor) {
              onStartFollow();
            }
          }}
          disabled={!hasSelectedActor}
        >
          {isFollowing ? (
            <>
              <Square size={15} />
              {t("map.stopFollowing")}
            </>
          ) : (
            <>
              <Play size={15} />
              {t("map.followRoute")}
            </>
          )}
        </Button>
      )}
      {hasHistoryPaths && (
        <Button
          variant={showHistory ? "secondary" : "subtle"}
          size="sm"
          onClick={toggleHistory}
          title={
            showHistory
              ? t("map.hideHistoricalPaths")
              : t("map.showHistoricalPaths")
          }
        >
          <History size={15} />
          {showHistory
            ? t("map.hideHistoricalPaths")
            : t("map.showHistoricalPaths")}
        </Button>
      )}
    </div>
  );
}
