"use client";

import {
  Bus,
  Check,
  Lock,
  LockOpen,
  type LucideIcon,
  Plus,
  Puzzle,
  UserCog,
  UserRound,
  X,
} from "lucide-react";
import { useState } from "react";
import type {
  ActorRef,
  ActorType as AT,
} from "@/features/actors/domain/actor.types";
import { ActorType } from "@/features/actors/domain/actor.types";
import { discoverActors } from "@/features/actors/infrastructure/actorRepository";
import { logout } from "@/features/actors/infrastructure/authService";
import { Badge } from "@/shared/components/Badge";
import { Button } from "@/shared/components/Button";
import { EmptyState } from "@/shared/components/EmptyState";
import { Input } from "@/shared/components/Input";
import { Select } from "@/shared/components/Select";
import { Spinner } from "@/shared/components/Spinner";
import { useI18n } from "@/shared/i18n";
import { actorColors } from "@/shared/lib/tokens";
import { useActorStore } from "@/shared/store/actor.store";
import { useAuthStore } from "@/shared/store/auth.store";
import { useEnvironmentStore } from "@/shared/store/environment.store";

function actorIcon(t: AT): LucideIcon {
  if (t === ActorType.Passenger) return UserRound;
  if (t === ActorType.Driver) return UserCog;
  return Bus;
}

function ActorAvatar({ type }: { type: AT }) {
  const Icon = actorIcon(type);
  return (
    <div className="grid size-8 shrink-0 place-items-center rounded-lg border border-border bg-surface-variant/60">
      <Icon size={16} style={{ color: actorColors[type] }} strokeWidth={2} />
    </div>
  );
}

export function ActorPanel({
  onOpenCreate,
  onRequestAuth,
}: {
  onOpenCreate: () => void;
  onRequestAuth: (actor: ActorRef, onSuccess: () => void) => void;
}) {
  const { t } = useI18n();
  const env = useEnvironmentStore((s) => s.env);
  const adminToken = useEnvironmentStore((s) => s.adminToken);
  const workspace = useActorStore((s) => s.workspace);
  const discovered = useActorStore((s) => s.discovered);
  const setDiscovered = useActorStore((s) => s.setDiscovered);
  const selectedActorId = useActorStore((s) => s.selectedActorId);
  const selectActor = useActorStore((s) => s.selectActor);
  const addToWorkspace = useActorStore((s) => s.addToWorkspace);
  const removeFromWorkspace = useActorStore((s) => s.removeFromWorkspace);
  const updateActor = useActorStore((s) => s.updateActor);
  const search = useActorStore((s) => s.search);
  const setSearch = useActorStore((s) => s.setSearch);
  const typeFilter = useActorStore((s) => s.typeFilter);
  const setTypeFilter = useActorStore((s) => s.setTypeFilter);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const clearAuth = useAuthStore((s) => s.clear);

  const [discovering, setDiscovering] = useState(false);
  const [discoverError, setDiscoverError] = useState<string | undefined>();

  const onSignOut = async (a: ActorRef) => {
    try {
      await logout(env, a.id);
    } catch {
      // Best-effort server-side clear; the UI is reset regardless so the
      // next action prompts for authentication again.
    }
    clearAuth(a.id);
    updateActor(a.id, { authenticated: false });
  };

  const onDiscover = async () => {
    setDiscovering(true);
    setDiscoverError(undefined);
    try {
      const types: AT[] =
        typeFilter === "all"
          ? [ActorType.Passenger, ActorType.Driver, ActorType.Bus]
          : [typeFilter];
      const found = await discoverActors(env, adminToken, types);
      setDiscovered(found);
      if (found.length === 0) setDiscoverError("No actors found");
    } catch (err) {
      setDiscoverError(
        err instanceof Error ? err.message : t("common.networkError"),
      );
    } finally {
      setDiscovering(false);
    }
  };

  const filteredWorkspace = workspace.filter((a) => {
    const q = search.toLowerCase();
    const matchQ =
      !q ||
      a.label.toLowerCase().includes(q) ||
      (a.sublabel ?? "").toLowerCase().includes(q);
    const matchT = typeFilter === "all" || a.type === typeFilter;
    return matchQ && matchT;
  });

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 className="text-sm font-bold text-ink">{t("actor.title")}</h2>
        <div className="flex gap-1.5">
          <Button variant="subtle" size="sm" onClick={onDiscover}>
            {t("actor.discoverBtn")}
          </Button>
          <Button size="sm" onClick={onOpenCreate} title={t("actor.create")}>
            <Plus size={16} />
          </Button>
        </div>
      </div>

      <div className="space-y-2 border-b border-border p-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("actor.search")}
        />
        <Select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as AT | "all")}
          options={[
            { value: "all", label: t("actor.allTypes") },
            { value: ActorType.Passenger, label: t("actor.passenger") },
            { value: ActorType.Driver, label: t("actor.driver") },
            { value: ActorType.Bus, label: t("actor.bus") },
          ]}
        />
        {discovering && (
          <div className="flex items-center gap-2 px-1 text-xs text-ink-soft">
            <Spinner /> {t("actor.loading")}
          </div>
        )}
        {discoverError && !discovering && (
          <p className="px-1 text-xs text-danger">{discoverError}</p>
        )}
      </div>

      {/* Discovered results */}
      {discovered.length > 0 && (
        <div className="max-h-44 overflow-y-auto border-b border-border scrollbar-thin">
          <div className="px-3 py-1.5 text-[11px] font-semibold uppercase text-ink-faint">
            {t("actor.discoverFromBackend")} · {discovered.length}{" "}
            {t("actor.results")}
          </div>
          {discovered.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-surface-variant"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="text-lg">
                  <ActorAvatar type={a.type} />
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-ink">
                    {a.label}
                  </div>
                  <div className="truncate text-xs text-ink-soft">
                    {a.sublabel}
                  </div>
                </div>
              </div>
              <Button
                variant="subtle"
                size="sm"
                onClick={() => addToWorkspace(a)}
              >
                {t("actor.addToWorkspace")}
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Workspace */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="px-3 py-1.5 text-[11px] font-semibold uppercase text-ink-faint">
          {t("actor.workspaceEmpty")}
        </div>
        {filteredWorkspace.length === 0 && (
          <EmptyState
            icon={Puzzle}
            title={t("actor.workspaceEmpty")}
            hint={t("actor.discoverHint")}
          />
        )}
        {filteredWorkspace.map((a) => {
          const authed = isAuthenticated(a.id) || a.authenticated;
          const selected = a.id === selectedActorId;
          return (
            // biome-ignore lint/a11y/useSemanticElements: a real <button> is invalid here — its descendants include interactive <button> controls (authenticate / sign-out / remove), which would break HTML parsing and cause hydration errors.
            <div
              key={a.id}
              role="button"
              tabIndex={0}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("text/actor-id", a.id);
                e.dataTransfer.effectAllowed = "move";
              }}
              onClick={() => selectActor(selected ? null : a.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  selectActor(selected ? null : a.id);
                }
              }}
              className={`group mx-2 my-1 flex cursor-grab items-center gap-2 rounded-xl border px-3 py-2 transition-colors ${
                selected
                  ? "border-primary bg-primary-container"
                  : "border-transparent bg-surface hover:border-border"
              }`}
              title={t("map.placeActor")}
            >
              <ActorAvatar type={a.type} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-semibold text-ink">
                    {a.label}
                  </span>
                  <Badge tone="neutral">{a.source}</Badge>
                </div>
                <div className="truncate text-xs text-ink-soft">
                  {a.sublabel}
                  {a.lat != null
                    ? ` · ${a.lat.toFixed(4)}, ${a.lng?.toFixed(4)}`
                    : ""}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {a.type !== ActorType.Bus && !authed && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRequestAuth(a, () =>
                        updateActor(a.id, { authenticated: true }),
                      );
                    }}
                    className="rounded-md px-1.5 py-1 text-info transition-colors hover:bg-info-container"
                    title={t("actor.authenticate")}
                  >
                    <Lock size={14} />
                  </button>
                )}
                {authed && (
                  <Badge tone="success">
                    <Check size={11} strokeWidth={3} />
                  </Badge>
                )}
                {a.type !== ActorType.Bus && authed && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSignOut(a);
                    }}
                    className="rounded-md px-1.5 py-1 text-warning transition-colors hover:bg-warning-container"
                    title={t("actor.signOut")}
                  >
                    <LockOpen size={14} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFromWorkspace(a.id);
                  }}
                  className="rounded-md px-1.5 py-1 text-danger transition-colors hover:bg-danger-container"
                  title={t("actor.remove")}
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
