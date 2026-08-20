"use client";

import { useState } from "react";
import type { ActorRef } from "@/features/actors/domain/actor.types";
import { ActorType } from "@/features/actors/domain/actor.types";
import { login } from "@/features/actors/infrastructure/authService";
import { Input } from "@/shared/components/Input";
import { Modal, ModalFooter } from "@/shared/components/Modal";
import { useI18n } from "@/shared/i18n";
import { CredentialsSchema } from "@/shared/lib/schemas";
import { useEnvironmentStore } from "@/shared/store/environment.store";

export function AuthPromptModal({
  open,
  actor,
  onClose,
  onAuthenticated,
}: {
  open: boolean;
  actor: ActorRef | null;
  onClose: () => void;
  onAuthenticated: (actor: ActorRef, email: string) => void;
}) {
  const { t } = useI18n();
  const env = useEnvironmentStore((s) => s.env);
  const initialEmail = actor?.sublabel?.includes("@") ? actor.sublabel : "";
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  if (!actor) return null;

  const submit = async () => {
    setError(undefined);
    const parsed = CredentialsSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(t("auth.unauthorized"));
      return;
    }
    setLoading(true);
    try {
      await login(env, parsed.data, actor.type === ActorType.Driver, actor.id);
      onAuthenticated(actor, email);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.unauthorized"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      title={t("auth.promptTitle")}
      onClose={onClose}
      footer={
        <ModalFooter
          cancelLabel={t("auth.cancel")}
          onCancel={onClose}
          confirmLabel={t("auth.submit")}
          onConfirm={submit}
          loading={loading}
        />
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-ink-soft">
          {t("auth.promptBody", { actor: actor.label })}
        </p>
        {actor.type === ActorType.Driver && (
          <p className="text-xs text-ink-soft">{t("auth.driverNote")}</p>
        )}
        <Input
          label={t("auth.email")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          dir="ltr"
        />
        <Input
          label={t("auth.password")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          dir="ltr"
        />
        {error && (
          <div className="rounded-lg border border-danger-container bg-danger-container px-3 py-2 text-sm text-danger">
            {error}
          </div>
        )}
      </div>
    </Modal>
  );
}
