"use client";

import { useState } from "react";
import { logout } from "@/features/actors/infrastructure/authService";
import type { BackendEnvironment } from "@/features/environments/domain/environment.types";
import { BackendEnvId } from "@/features/environments/domain/environment.types";
import { envPresets } from "@/infrastructure/configuration/environments";
import { Badge } from "@/shared/components/Badge";
import { Button } from "@/shared/components/Button";
import { Input } from "@/shared/components/Input";
import { Modal, ModalFooter } from "@/shared/components/Modal";
import { useI18n } from "@/shared/i18n";
import { useActorStore } from "@/shared/store/actor.store";
import { useAuthStore } from "@/shared/store/auth.store";
import { useEnvironmentStore } from "@/shared/store/environment.store";

export function EnvironmentModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const env = useEnvironmentStore((s) => s.env);
  const setEnv = useEnvironmentStore((s) => s.setEnv);
  const adminToken = useEnvironmentStore((s) => s.adminToken);
  const setAdminToken = useEnvironmentStore((s) => s.setAdminToken);
  const health = useEnvironmentStore((s) => s.health);
  const checkHealth = useEnvironmentStore((s) => s.checkHealth);
  const clearWorkspace = useActorStore((s) => s.clearWorkspace);
  const workspaceCount = useActorStore((s) => s.workspace.length);
  const clearAuth = useAuthStore((s) => s.clearAll);

  const [selected, setSelected] = useState<BackendEnvironment>(env);
  const [customUrl, setCustomUrl] = useState(env.custom ? env.baseUrl : "");
  const [admin, setAdmin] = useState(adminToken);
  const [confirming, setConfirming] = useState(false);

  const chosen: BackendEnvironment =
    selected.id === BackendEnvId.Custom
      ? {
          id: BackendEnvId.Custom,
          label: "Custom",
          baseUrl: customUrl,
          custom: true,
        }
      : selected;

  const isChanged =
    chosen.baseUrl !== env.baseUrl ||
    chosen.id !== env.id ||
    admin !== adminToken;

  const envChanged = chosen.baseUrl !== env.baseUrl || chosen.id !== env.id;

  const apply = async () => {
    if (envChanged) {
      try {
        await logout(env);
      } catch {
        // Server-side vault clear is best-effort; client state is reset below.
      }
    }
    setEnv(chosen);
    setAdminToken(admin);
    clearWorkspace();
    clearAuth();
    onClose();
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
            onConfirm={() => {
              if (isChanged && workspaceCount > 0 && !confirming) {
                setConfirming(true);
              } else {
                apply();
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
                baseUrl: customUrl || "http://localhost:5002",
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
            </div>
          )}

          <div className="border-t border-border pt-3">
            <Input
              label="Admin token (optional, for discovery & privileged creation)"
              value={admin}
              onChange={(e) => setAdmin(e.target.value)}
              placeholder="eyJhbGciOi…"
              type="password"
              dir="ltr"
            />
            <Button
              variant="subtle"
              size="sm"
              className="mt-2"
              onClick={() => checkHealth()}
            >
              {t("environment.testConnection")}
            </Button>
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
              apply();
            }}
          />
        }
      >
        <p className="text-sm text-ink-soft">{t("environment.confirmBody")}</p>
      </Modal>
    </>
  );
}
