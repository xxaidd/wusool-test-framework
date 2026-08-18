"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { ActionPanel } from "@/features/actions/presentation/ActionPanel";
import type { ActorRef } from "@/features/actors/domain/actor.types";
import { ActorPanel } from "@/features/actors/presentation/ActorPanel";
import { AuthPromptModal } from "@/features/actors/presentation/AuthPromptModal";
import { CreateActorModal } from "@/features/actors/presentation/CreateActorModal";
import { EnvironmentModal } from "@/features/environments/presentation/EnvironmentModal";
import { SessionPanel } from "@/features/sessions/presentation/SessionPanel";
import { useI18n } from "@/shared/i18n";
import { useActorStore } from "@/shared/store/actor.store";
import { useAuthStore } from "@/shared/store/auth.store";
import { useEnvironmentStore } from "@/shared/store/environment.store";
import { type PanelKey, useUIStore } from "@/shared/store/ui.store";
import { TopBar } from "./TopBar";

const MapCanvas = dynamic(
  () =>
    import("@/features/map/presentation/MapCanvas").then((m) => m.MapCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full animate-pulse bg-surface-variant" />
    ),
  },
);

export function App() {
  const { t } = useI18n();
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated);
  const updateActor = useActorStore((s) => s.updateActor);
  const activePanel = useUIStore((s) => s.activePanel);
  const setActivePanel = useUIStore((s) => s.setActivePanel);
  const checkHealth = useEnvironmentStore((s) => s.checkHealth);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  const [envOpen, setEnvOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [authActor, setAuthActor] = useState<ActorRef | null>(null);
  const pendingCb = useRef<(() => void) | null>(null);

  const requestAuth = (actor: ActorRef, onSuccess: () => void) => {
    pendingCb.current = onSuccess;
    setAuthActor(actor);
  };

  const onAuthSuccess = (actor: ActorRef) => {
    setAuthenticated(actor.id, actor.credentials?.email);
    updateActor(actor.id, { authenticated: true });
    const cb = pendingCb.current;
    pendingCb.current = null;
    if (cb) cb();
  };

  return (
    <div className="flex h-screen flex-col bg-bg-base text-ink">
      <TopBar onOpenEnvironment={() => setEnvOpen(true)} />

      <div className="flex min-h-0 flex-1">
        {/* Left: actors */}
        <aside className="hidden w-80 shrink-0 border-e border-border bg-surface lg:block">
          <ActorPanel
            onOpenCreate={() => setCreateOpen(true)}
            onRequestAuth={requestAuth}
          />
        </aside>

        {/* Center: map */}
        <main className="min-w-0 flex-1">
          <MapCanvas />
        </main>

        {/* Right: actions / session */}
        <aside className="flex w-[26rem] max-w-full shrink-0 flex-col border-s border-border bg-surface">
          <div className="flex border-b border-border">
            {(["actors", "session"] as PanelKey[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setActivePanel(p)}
                className={`flex-1 px-4 py-3 text-sm font-semibold transition-colors ${
                  activePanel === p
                    ? "border-b-2 border-primary text-primary"
                    : "text-ink-soft hover:text-ink"
                }`}
              >
                {t(p === "actors" ? "nav.workspace" : "nav.session")}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            {activePanel === "actors" ? (
              <ActionPanel onRequestAuth={requestAuth} />
            ) : (
              <SessionPanel />
            )}
          </div>
        </aside>
      </div>

      <EnvironmentModal open={envOpen} onClose={() => setEnvOpen(false)} />
      <CreateActorModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />
      <AuthPromptModal
        open={!!authActor}
        actor={authActor}
        onClose={() => {
          setAuthActor(null);
          pendingCb.current = null;
        }}
        onAuthenticated={onAuthSuccess}
      />
    </div>
  );
}
