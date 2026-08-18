"use client";

import { useState } from "react";
import { configureAdmin } from "@/features/actors/infrastructure/actorRepository";
import type { BackendEnvironment } from "@/features/environments/domain/environment.types";
import { BackendEnvId } from "@/features/environments/domain/environment.types";
import { SessionSource } from "@/features/sessions/domain/session.types";
import { envPresets } from "@/infrastructure/configuration/environments";
import { Badge } from "@/shared/components/Badge";
import { Button } from "@/shared/components/Button";
import { Input } from "@/shared/components/Input";
import { Modal, ModalFooter } from "@/shared/components/Modal";
import { useI18n } from "@/shared/i18n";
import { useActorStore } from "@/shared/store/actor.store";
import { useEnvironmentStore } from "@/shared/store/environment.store";
import { switchEnvironment } from "@/shared/store/environmentSwitch";
import { useSessionStore } from "@/shared/store/session.store";

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      !parsed.username &&
      !parsed.password
    );
  } catch {
    return false;
  }
}

type AdminMode = "credentials" | "token";

export function EnvironmentModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const env = useEnvironmentStore((s) => s.env);
  const adminConfigured = useEnvironmentStore((s) => s.adminConfigured);
  const setAdminConfigured = useEnvironmentStore((s) => s.setAdminConfigured);
  const health = useEnvironmentStore((s) => s.health);
  const checkHealth = useEnvironmentStore((s) => s.checkHealth);
  const workspace = useActorStore((s) => s.workspace);
  const placed = useActorStore((s) => s.placed);
  const sessionEvents = useSessionStore((s) => s.events);
  const sessionRecording = useSessionStore((s) => s.recording);

  const [selected, setSelected] = useState<BackendEnvironment>(env);
  const [customUrl, setCustomUrl] = useState(env.custom ? env.baseUrl : "");
  const [adminMode, setAdminMode] = useState<AdminMode>("credentials");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminToken, setAdminToken] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const chosen: BackendEnvironment =
    selected.id === BackendEnvId.Custom
      ? {
          id: BackendEnvId.Custom,
          label: "Custom",
          baseUrl: customUrl,
          custom: true,
        }
      : selected;

  const envChanged = chosen.baseUrl !== env.baseUrl || chosen.id !== env.id;

  const hasScopedState =
    workspace.length > 0 ||
    placed.length > 0 ||
    sessionEvents.length > 0 ||
    sessionRecording;

  const customInvalid =
    selected.id === BackendEnvId.Custom &&
    (customUrl.trim() === "" || !isValidHttpUrl(customUrl));

  const hasAdminInput =
    adminEmail.trim() !== "" ||
    adminPassword.trim() !== "" ||
    adminToken.trim() !== "";

  /**
   * Configure the admin/session-manager identity for the target environment.
   * Returns true when the modal should close (no-op or success); false when
   * the user should stay and fix the inputs.
   */
  const applyAdmin = async (target: BackendEnvironment): Promise<boolean> => {
    if (!hasAdminInput) return true;
    try {
      setSaving(true);
      await configureAdmin(
        target,
        adminMode === "credentials"
          ? {
              mode: "credentials",
              email: adminEmail.trim(),
              password: adminPassword,
            }
          : { mode: "token", token: adminToken.trim() },
      );
      setAdminConfigured(true);
      useSessionStore.getState().addEvent({
        source: SessionSource.System,
        actorId: "system",
        actorLabel: "System",
        actionId: "admin.auth.login",
        actionLabel: t("environment.adminUpdated"),
        categoryId: "environment",
        summary: t("environment.adminConfigured"),
        status: "info",
      });
      return true;
    } catch (err) {
      setAdminConfigured(false);
      setError(
        err instanceof Error
          ? err.message
          : t("environment.adminConfigureFailed"),
      );
      return false;
    } finally {
      setSaving(false);
    }
  };

  const apply = async () => {
    if (customInvalid) {
      setError(t("environment.urlInvalid"));
      return;
    }
    setError(null);
    if (!envChanged) {
      const adminOk = await applyAdmin(chosen);
      if (adminOk) onClose();
      return;
    }
    const result = await switchEnvironment(chosen);
    if (!result.ok) {
      setError(result.error ?? t("environment.urlInvalid"));
      return;
    }
    const adminOk = await applyAdmin(chosen);
    if (adminOk) onClose();
  };

  return (
    <>
      <Modal
        open={open}
        title={t("environment.title")}
        onClose={onClose}
        footer={
          <ModalFooter
            cancelLabel={t("common.cancel")}
            onCancel={onClose}
            confirmLabel={t("environment.connect")}
            loading={saving}
            onConfirm={() => {
              if (envChanged && hasScopedState && !confirming) {
                setConfirming(true);
              } else {
                void apply();
              }
            }}
          />
        }
      >
        <div className="space-y-4">
          <div>
            <div className="mb-1 text-xs font-medium text-ink-soft">
              {t("environment.current")}
            </div>
            <div className="flex items-center gap-2">
              <Badge
                tone={
                  health.ok ? "success" : health.checking ? "warning" : "danger"
                }
              >
                {health.ok
                  ? t("app.connectionOk")
                  : health.checking
                    ? "…"
                    : t("app.connectionError")}
              </Badge>
              <span
                title={
                  adminConfigured
                    ? t("environment.adminHint")
                    : t("environment.adminNeeded")
                }
              >
                <Badge tone={adminConfigured ? "success" : "neutral"}>
                  {adminConfigured
                    ? t("environment.adminConfigured")
                    : t("environment.adminNotConfigured")}
                </Badge>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {envPresets.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelected(p)}
                className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm transition-colors ${
                  selected.id === p.id && selected.id !== BackendEnvId.Custom
                    ? "border-primary bg-primary-container text-on-primary-container"
                    : "border-border bg-surface text-ink hover:border-primary"
                }`}
              >
                {t(
                  `environment.${p.id === BackendEnvId.Local ? "local" : p.id === BackendEnvId.Development ? "development" : "staging"}`,
                )}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() =>
              setSelected({
                id: BackendEnvId.Custom,
                label: "Custom",
                baseUrl: customUrl,
                custom: true,
              })
            }
            className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-sm transition-colors ${
              selected.id === BackendEnvId.Custom
                ? "border-primary bg-primary-container text-on-primary-container"
                : "border-border bg-surface text-ink hover:border-primary"
            }`}
          >
            {t("environment.custom")}
          </button>
          {selected.id === BackendEnvId.Custom && (
            <div className="mt-2">
              <Input
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                placeholder={t("environment.urlPlaceholder")}
                dir="ltr"
              />
              {customInvalid && (
                <p className="mt-1 text-xs text-danger">
                  {t("environment.urlInvalid")}
                </p>
              )}
            </div>
          )}

          {error && (
            <p className="rounded-lg border border-danger-container bg-danger-container px-3 py-2 text-xs text-danger">
              {error}
            </p>
          )}

          <div className="space-y-3 border-t border-border pt-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-ink">
                {t("environment.adminTitle")}
              </div>
              <Button variant="subtle" size="sm" onClick={() => checkHealth()}>
                {t("environment.testConnection")}
              </Button>
            </div>

            <div className="flex rounded-lg border border-border p-0.5">
              {(
                [
                  ["credentials", t("environment.adminCredsMode")],
                  ["token", t("environment.adminTokenMode")],
                ] as [AdminMode, string][]
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setAdminMode(mode)}
                  className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                    adminMode === mode
                      ? "bg-primary-container text-primary"
                      : "text-ink-soft hover:text-ink"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {adminMode === "credentials" ? (
              <>
                <Input
                  label={t("environment.adminEmail")}
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  type="email"
                  dir="ltr"
                  autoComplete="username"
                />
                <Input
                  label={t("environment.adminPassword")}
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  type="password"
                  dir="ltr"
                  autoComplete="current-password"
                />
              </>
            ) : (
              <Input
                label={t("environment.adminToken")}
                value={adminToken}
                onChange={(e) => setAdminToken(e.target.value)}
                placeholder="eyJhbGciOi…"
                type="password"
                dir="ltr"
              />
            )}

            <p className="text-xs text-ink-soft">
              {t("environment.adminHint")}
            </p>
          </div>
        </div>
      </Modal>

      <Modal
        open={confirming}
        title={t("environment.confirmTitle")}
        onClose={() => setConfirming(false)}
        footer={
          <ModalFooter
            cancelLabel={t("environment.cancel")}
            onCancel={() => setConfirming(false)}
            confirmLabel={t("environment.confirm")}
            onConfirm={() => {
              setConfirming(false);
              void apply();
            }}
          />
        }
      >
        <p className="text-sm text-ink-soft">{t("environment.confirmBody")}</p>
      </Modal>
    </>
  );
}
