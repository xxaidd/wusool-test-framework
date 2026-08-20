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
import type { ActorWorkspaceGateway } from "@/features/actors/application/ActorWorkspaceGateway";
import { AddActorToWorkspaceUseCase } from "@/features/actors/application/AddActorToWorkspaceUseCase";
import { DiscoverActorsUseCase } from "@/features/actors/application/DiscoverActorsUseCase";
import { SelectActorUseCase } from "@/features/actors/application/SelectActorUseCase";
import {
  type ActorRef,
  ActorType,
  type ActorType as AT,
  actorWorkspaceKeyOf,
} from "@/features/actors/domain/actor.types";
import { logout } from "@/features/actors/infrastructure/authService";
import { isAdminAuthRequired } from "@/infrastructure/bff/client";
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
  onOpenEnvironment,
}: {
  onOpenCreate: () => void;
  onRequestAuth: (actor: ActorRef, onSuccess: () => void) => void;
  onOpenEnvironment: () => void;
}) {
  const { t } = useI18n();
  const env = useEnvironmentStore((s) => s.env);
  const workspace = useActorStore((s) => s.workspace);
  const discovered = useActorStore((s) => s.discovered);
  const selectedActorId = useActorStore((s) => s.selectedActorId);
  const search = useActorStore((s) => s.search);
  const typeFilter = useActorStore((s) => s.typeFilter);
  const setSearch = useActorStore((s) => s.setSearch);
  const setTypeFilter = useActorStore((s) => s.setTypeFilter);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // Initialize use cases with actual repository methods
  const {
    discoverActors,
  } = require("@/features/actors/infrastructure/actorRepository");

  const discoverActorsUseCase = new DiscoverActorsUseCase(discoverActors);
  const workspaceGateway: ActorWorkspaceGateway = {
    isInWorkspace: (key) =>
      useActorStore.getState().actorByKey(key) !== undefined,
    addToWorkspace: (actor) => useActorStore.getState().addToWorkspace(actor),
    selectActor: (actorKey) => useActorStore.getState().selectActor(actorKey),
  };
  const addActorToWorkspaceUseCase = new AddActorToWorkspaceUseCase(
    workspaceGateway,
  );
  const selectActorUseCase = new SelectActorUseCase(workspaceGateway);

  const [discovering, setDiscovering] = useState(false);
  const [discoverError, setDiscoverError] = useState<string | undefined>();
  const [adminRequired, setAdminRequired] = useState(false);

  const onSignOut = async (a: ActorRef) => {
    try {
      await logout(env, a.id);
    } catch {
      // Best-effort server-side clear; the UI is reset regardless so the
      // next action prompts for authentication again.
    }
    // Clear auth using store (keeping existing behavior for now)
    useActorStore
      .getState()
      .updateActor(actorWorkspaceKeyOf(a), { authenticated: false });
  };

  const onDiscover = async () => {
    setDiscovering(true);
    setDiscoverError(undefined);
    setAdminRequired(false);
    try {
      const types: AT[] =
        typeFilter === "all"
          ? [ActorType.Passenger, ActorType.Driver, ActorType.Bus]
          : [typeFilter];
      const result = await discoverActorsUseCase.execute({
        envId: env.id,
        types,
        // Note: AbortSignal not implemented in this simplified version
      });

      if (result.status === "success") {
        // Convert SafeActor back to ActorRef for compatibility with existing store
        // In a full implementation, the store would work with SafeActor
        const actorRefs: ActorRef[] = result.actors.map((safeActor) => ({
          id: safeActor.id,
          type: safeActor.type,
          label: safeActor.label,
          sublabel: safeActor.sublabel,
          authenticated: safeActor.authenticated,
          source: safeActor.source,
          email: safeActor.email ?? undefined,
          lat: safeActor.lat ?? undefined,
          lng: safeActor.lng ?? undefined,
          // Note: raw field is omitted as per safe actor principles
          // Keeping the source from the safeActor (which should be Existing for discovered actors)
        }));

        useActorStore.getState().setDiscovered(actorRefs);
        if (actorRefs.length === 0) setDiscoverError("No actors found");
      } else {
        if (isAdminAuthRequired(result.error)) {
          setAdminRequired(true);
          setDiscoverError(t("actor.adminRequired"));
        } else {
          const msg = result.error?.message;
          setDiscoverError(msg ? msg : t("common.networkError"));
        }
      }
    } catch (err) {
      if (isAdminAuthRequired(err)) {
        setAdminRequired(true);
        setDiscoverError(t("actor.adminRequired"));
      } else {
        setDiscoverError(
          err instanceof Error ? err.message : t("common.networkError"),
        );
      }
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
          <div className="space-y-1.5">
            <p className="px-1 text-xs text-danger">{discoverError}</p>
            {adminRequired && (
              <Button
                variant="subtle"
                size="sm"
                onClick={onOpenEnvironment}
                title={t("actor.configureAdmin")}
              >
                {t("actor.configureAdmin")}
              </Button>
            )}
          </div>
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
              key={actorWorkspaceKeyOf(a)}
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
                onClick={() => addActorToWorkspaceUseCase.execute(a)}
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
          const aKey = actorWorkspaceKeyOf(a);
          const selected = aKey === selectedActorId;
          return (
            // biome-ignore lint/a11y/useSemanticElements: a real <button> is invalid here — its descendants include interactive <button> controls (authenticate / sign-out / remove), which would break HTML parsing and cause hydration errors.
            <div
              key={aKey}
              role="button"
              tabIndex={0}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("text/actor-key", aKey);
                e.dataTransfer.effectAllowed = "move";
              }}
              onClick={() => {
                selectActorUseCase.execute(selected ? null : aKey);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  selectActorUseCase.execute(selected ? null : aKey);
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
                        // Update actor auth status through store
                        useActorStore
                          .getState()
                          .updateActor(aKey, { authenticated: true }),
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
                    // Remove from workspace through store for now
                    // TODO: Consider creating a RemoveActorFromWorkspaceUseCase
                    useActorStore.getState().removeFromWorkspace(aKey);
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
