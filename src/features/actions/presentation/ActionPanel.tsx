"use client";

import {
  ArrowLeft,
  ChevronRight,
  Clock,
  Compass,
  type LucideIcon,
  MapPin,
  Play,
  Settings,
  Target,
  Ticket,
  TriangleAlert,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildBody,
  buildPath,
  buildQuery,
  getAction,
  verifiedActionsForActor,
} from "@/features/actions/application/actionCatalog";
import {
  type ActionOutcome,
  runAction,
} from "@/features/actions/application/runAction";
import {
  type ActionCategory,
  type ActionDef,
  ActionMode,
  type EntityKind,
} from "@/features/actions/domain/action.types";
import { bffActionRepository } from "@/features/actions/infrastructure/actionRepository";
import { loadEntity } from "@/features/actions/infrastructure/entityRepository";
import type { ActorRef } from "@/features/actors/domain/actor.types";
import { SessionSource } from "@/features/sessions/domain/session.types";
import { Badge } from "@/shared/components/Badge";
import { Button } from "@/shared/components/Button";
import { EmptyState } from "@/shared/components/EmptyState";
import { Input } from "@/shared/components/Input";
import { SearchSelect } from "@/shared/components/SearchSelect";
import { Select } from "@/shared/components/Select";
import { Spinner } from "@/shared/components/Spinner";
import { Textarea } from "@/shared/components/Textarea";
import { useSessionRecorder } from "@/shared/hooks/useSessionRecorder";
import { useI18n } from "@/shared/i18n";
import { redactRequest } from "@/shared/redaction/redact";
import { useActorStore } from "@/shared/store/actor.store";
import { useAuthStore } from "@/shared/store/auth.store";
import { useEnvironmentStore } from "@/shared/store/environment.store";
import { useUIStore } from "@/shared/store/ui.store";

function categoryIcon(c: ActionCategory): LucideIcon {
  switch (c) {
    case "trip":
      return Compass;
    case "location":
      return MapPin;
    case "booking":
      return Ticket;
    case "incident":
      return TriangleAlert;
    case "shift":
      return Clock;
    default:
      return Settings;
  }
}

export function ActionPanel({
  onRequestAuth,
}: {
  onRequestAuth: (actor: ActorRef, onSuccess: () => void) => void;
}) {
  const { t } = useI18n();
  const env = useEnvironmentStore((s) => s.env);
  const health = useEnvironmentStore((s) => s.health);
  const selected = useActorStore((s) =>
    s.workspace.find((a) => a.id === s.selectedActorId),
  );
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const recorder = useSessionRecorder();
  const actionMode = useUIStore((s) => s.actionMode);
  const setActionMode = useUIStore((s) => s.setActionMode);

  const [category, setCategory] = useState<ActionCategory | "all">("all");
  const [actionId, setActionId] = useState<string | null>(null);
  const [args, setArgs] = useState<Record<string, unknown>>({});
  const [result, setResult] = useState<ActionOutcome | null>(null);
  const [executing, setExecuting] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const actorActions = useMemo(
    () =>
      selected
        ? verifiedActionsForActor(
            selected.type,
            category === "all" ? undefined : category,
          )
        : [],
    [selected, category],
  );

  const categories = useMemo(() => {
    if (!selected) return [];
    return verifiedActionsForActor(selected.type)
      .map((a) => a.category)
      .filter((c, i, arr) => arr.indexOf(c) === i);
  }, [selected]);

  const action: ActionDef | undefined = actionId
    ? getAction(actionId)
    : undefined;

  const setArg = (id: string, value: unknown) =>
    setArgs((p) => ({ ...p, [id]: value }));

  const preview = useMemo(() => {
    if (!selected || !action) return null;
    const path = buildPath(action, args, selected);
    const query = buildQuery(action, args);
    const isBody = ["POST", "PUT", "PATCH"].includes(action.method);
    return {
      method: action.method,
      path: `${path}${query ? `?${new URLSearchParams(query).toString()}` : ""}`,
      body: isBody
        ? JSON.stringify(buildBody(action, args, selected), null, 2)
        : undefined,
    };
  }, [action, args, selected]);

  const cancel = () => {
    abortRef.current?.abort();
  };

  const execute = async () => {
    if (!selected || !action) return;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setExecuting(true);
    setResult(null);
    const pos =
      selected.lat != null && selected.lng != null
        ? { lat: selected.lat, lng: selected.lng }
        : undefined;
    const recordBase = {
      source: SessionSource.Manual,
      actor: { id: selected.id, label: selected.label, type: selected.type },
      action: {
        id: action.id,
        label: t(action.labelKey),
        categoryId: action.category,
      },
      summary: t(action.summaryKey),
      position: pos,
      baseUrl: env.baseUrl,
    };
    let outcome: ActionOutcome;
    try {
      outcome = await runAction({
        env,
        actor: selected,
        action,
        args,
        position: pos,
        repo: bffActionRepository,
        signal: abortRef.current.signal,
        recorder,
        summary: t(action.summaryKey),
        actionLabel: t(action.labelKey),
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        // User cancellation is evidence: record a cancelled event (FR-38).
        recorder.record({
          ...recordBase,
          status: "info",
          error: t("common.cancel"),
          classification: { kind: "infrastructure", subtype: "cancelled" },
        });
        setExecuting(false);
        return;
      }
      // Any unexpected infrastructure failure becomes a normal failed outcome
      // so the session still records it (FR-37) and the UI resets.
      outcome = {
        ok: false,
        needsAuth: false,
        request: redactRequest({
          method: action.method,
          path: buildPath(action, args, selected),
        }),
        durationMs: 0,
        error: err instanceof Error ? err.message : "Unknown error",
      };
      recorder.record({
        ...recordBase,
        status: "failure",
        error: outcome.error,
        classification: { kind: "infrastructure", subtype: "network" },
      });
    }
    setResult(outcome);
    setExecuting(false);

    if (outcome.needsAuth) {
      onRequestAuth(selected, execute);
      return;
    }
  };

  if (!selected) {
    return (
      <div className="p-4">
        <EmptyState icon={Target} title={t("action.selectStep")} />
      </div>
    );
  }

  const authed = isAuthenticated(selected.id) || selected.authenticated;

  return (
    <div className="flex h-full flex-col">
      {/* Actor header */}
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-bold text-ink">{selected.label}</div>
            <div className="text-xs text-ink-soft">
              {t(`actor.${selected.type}`)} · {selected.sublabel}
            </div>
          </div>
          {authed ? (
            <Badge tone="success">{t("actor.authenticated")}</Badge>
          ) : (
            <Badge tone="warning">{t("actor.notAuthenticated")}</Badge>
          )}
        </div>
        {/* Mode toggle */}
        <div className="mt-3 flex items-center justify-between">
          <div className="inline-flex rounded-lg border border-border p-0.5">
            {[ActionMode.Simple, ActionMode.Advanced].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setActionMode(m)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  actionMode === m
                    ? "bg-primary text-on-primary"
                    : "text-ink-soft hover:text-ink"
                }`}
              >
                {m === ActionMode.Simple
                  ? t("action.simpleMode")
                  : t("action.advancedMode")}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-border px-3 py-2 scrollbar-thin">
        <button
          type="button"
          onClick={() => {
            setCategory("all");
            setActionId(null);
          }}
          className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            category === "all"
              ? "bg-primary-container text-on-primary-container"
              : "text-ink-soft hover:bg-surface-variant"
          }`}
        >
          {t("action.categoryAll")}
        </button>
        {categories.map((c) => {
          const CategoryIcon = categoryIcon(c);
          return (
            <button
              key={c}
              type="button"
              onClick={() => {
                setCategory(c);
                setActionId(null);
              }}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                category === c
                  ? "bg-primary-container text-on-primary-container"
                  : "text-ink-soft hover:bg-surface-variant hover:text-primary"
              }`}
            >
              <CategoryIcon size={14} />
              {t(`categories.${c}`)}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {/* Action list */}
        {!action && (
          <div className="p-2">
            {actorActions.length === 0 && (
              <p className="px-2 py-4 text-center text-xs text-ink-faint">
                {t("action.selectStep")}
              </p>
            )}
            {actorActions.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => {
                  setActionId(a.id);
                  setArgs({});
                  setResult(null);
                }}
                className="group flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm text-ink transition-colors hover:bg-surface-variant hover:pl-4"
              >
                {t(a.labelKey)}
                <ChevronRight
                  size={16}
                  className="text-ink-faint transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                />
              </button>
            ))}
          </div>
        )}

        {/* Action form */}
        {action && (
          <div className="space-y-3 p-3">
            <button
              type="button"
              onClick={() => setActionId(null)}
              className="inline-flex items-center gap-1 text-xs text-info hover:underline"
            >
              <ArrowLeft size={14} />
              {t("action.categoryAll")}
            </button>
            <h3 className="text-sm font-bold text-ink">{t(action.labelKey)}</h3>

            {actionMode === ActionMode.Advanced && preview && (
              <div className="space-y-2 rounded-xl border border-border bg-surface-variant/60 p-3 font-mono text-xs">
                <div>
                  <span className="text-ink-faint">{t("action.method")}: </span>
                  <Badge tone={action.method === "GET" ? "info" : "primary"}>
                    {action.method}
                  </Badge>
                </div>
                <div className="break-all text-ink">
                  <span className="text-ink-faint">
                    {t("action.endpoint")}:{" "}
                  </span>
                  {preview.path}
                </div>
                {preview.body && (
                  <pre className="whitespace-pre-wrap break-all text-ink">
                    {preview.body}
                  </pre>
                )}
              </div>
            )}

            {action.fields.map((f) => {
              if (f.kind === "entity") {
                return (
                  <SearchSelect
                    key={f.id}
                    label={t(f.labelKey)}
                    placeholder={t("action.selectEntity")}
                    searchPlaceholder={t("action.searchEntity")}
                    loadingLabel={t("action.searchLoading")}
                    emptyLabel={t("entities.noResult")}
                    value={args[f.id] as string}
                    onSelect={(v) => setArg(f.id, v)}
                    load={(q) =>
                      loadEntity(env, f.entity as EntityKind, q, selected.id)
                    }
                  />
                );
              }
              if (f.kind === "select") {
                return (
                  <Select
                    key={f.id}
                    label={t(f.labelKey)}
                    value={(args[f.id] as string) ?? ""}
                    onChange={(e) => setArg(f.id, e.target.value)}
                    options={f.options || []}
                  />
                );
              }
              if (f.kind === "textarea") {
                return (
                  <Textarea
                    key={f.id}
                    label={t(f.labelKey)}
                    value={(args[f.id] as string) ?? ""}
                    onChange={(e) => setArg(f.id, e.target.value)}
                    placeholder={f.placeholder}
                  />
                );
              }
              return (
                <Input
                  key={f.id}
                  label={t(f.labelKey)}
                  type={f.kind === "number" ? "number" : "text"}
                  value={(args[f.id] as string) ?? ""}
                  onChange={(e) => setArg(f.id, e.target.value)}
                  placeholder={f.placeholder}
                  required={f.required}
                  dir={f.kind === "number" ? "ltr" : undefined}
                />
              );
            })}

            <div className="flex gap-2">
              <Button full onClick={execute} disabled={executing || !health.ok}>
                {executing ? (
                  <Spinner />
                ) : (
                  <>
                    <Play size={16} />
                    {t("action.execute")}
                  </>
                )}
              </Button>
              {executing && (
                <Button variant="danger" onClick={cancel}>
                  {t("common.cancel")}
                </Button>
              )}
            </div>
            {!health.ok && !executing && (
              <p className="text-xs text-danger">
                {t("app.connectionError")} · {t("action.backendUnavailable")}
              </p>
            )}

            {/* Result */}
            {result && (
              <div
                className={`rounded-xl border p-3 ${
                  result.needsAuth
                    ? "border-warning bg-warning-container"
                    : result.ok
                      ? "border-success-container bg-success-container"
                      : "border-danger-container bg-danger-container"
                }`}
              >
                {result.needsAuth ? (
                  <p className="text-sm text-ink">{t("action.authRequired")}</p>
                ) : (
                  <>
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <Badge tone={result.ok ? "success" : "danger"}>
                        {result.ok ? t("action.success") : t("action.failed")}
                      </Badge>
                      {result.statusCode && (
                        <span className="text-ink-soft">
                          {result.statusCode}
                        </span>
                      )}
                      <span className="text-ink-faint">
                        {result.durationMs}ms
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-ink">
                      {result.error || t(action.summaryKey)}
                    </p>
                    {actionMode === ActionMode.Advanced && result.response && (
                      <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-surface p-2 font-mono text-xs text-ink">
                        {result.response.body}
                      </pre>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
