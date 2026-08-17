"use client";

import { useState } from "react";
import type {
  ActorRef,
  ActorType as AT,
} from "@/features/actors/domain/actor.types";
import { ActorType } from "@/features/actors/domain/actor.types";
import { createActor } from "@/features/actors/infrastructure/actorRepository";
import { Input } from "@/shared/components/Input";
import { Modal, ModalFooter } from "@/shared/components/Modal";
import { Select } from "@/shared/components/Select";
import { useI18n } from "@/shared/i18n";
import {
  CreateBusSchema,
  CreateDriverSchema,
  CreatePassengerSchema,
} from "@/shared/lib/schemas";
import { useActorStore } from "@/shared/store/actor.store";
import { useEnvironmentStore } from "@/shared/store/environment.store";

export function CreateActorModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const env = useEnvironmentStore((s) => s.env);
  const adminToken = useEnvironmentStore((s) => s.adminToken);
  const addToWorkspace = useActorStore((s) => s.addToWorkspace);

  const [type, setType] = useState<AT>(ActorType.Passenger);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [plate, setPlate] = useState("");
  const [capacity, setCapacity] = useState("50");
  const [loading, _setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const reset = () => {
    setName("");
    setEmail("");
    setPassword("");
    setPlate("");
    setCapacity("50");
    setError(undefined);
  };

  const submit = async () => {
    setError(undefined);
    try {
      let actor: ActorRef;
      if (type === ActorType.Passenger) {
        CreatePassengerSchema.parse({ email, password, name });
        actor = await createActor(env, adminToken, {
          type,
          name: name || email,
          email,
          password,
        });
      } else if (type === ActorType.Driver) {
        CreateDriverSchema.parse({ email, password, name });
        actor = await createActor(env, adminToken, {
          type,
          name,
          email,
          password,
        });
      } else {
        CreateBusSchema.parse({
          plateNumber: plate,
          capacity: capacity ? Number(capacity) : undefined,
        });
        actor = await createActor(env, adminToken, {
          type,
          plateNumber: plate,
          capacityNumber: capacity ? Number(capacity) : undefined,
        });
      }
      addToWorkspace(actor);
      reset();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.networkError"));
    }
  };

  return (
    <Modal
      open={open}
      title={t("actor.createTitle")}
      onClose={onClose}
      footer={
        <ModalFooter
          cancelLabel={t("common.cancel")}
          onCancel={onClose}
          confirmLabel={t("actor.create")}
          onConfirm={submit}
          loading={loading}
        />
      }
    >
      <div className="space-y-3">
        <Select
          label={t("actor.type")}
          value={type}
          onChange={(e) => setType(e.target.value as AT)}
          options={[
            { value: ActorType.Passenger, label: t("actor.passenger") },
            { value: ActorType.Driver, label: t("actor.driver") },
            { value: ActorType.Bus, label: t("actor.bus") },
          ]}
        />

        {type !== ActorType.Bus && (
          <>
            <Input
              label={t("actor.name")}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Input
              label={t("actor.email")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              dir="ltr"
            />
            <Input
              label={t("actor.password")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              dir="ltr"
            />
          </>
        )}

        {type === ActorType.Bus && (
          <>
            <Input
              label={t("actor.plateNumber")}
              value={plate}
              onChange={(e) => setPlate(e.target.value)}
              dir="ltr"
            />
            <Input
              label={t("actor.capacity")}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              type="number"
              dir="ltr"
            />
          </>
        )}

        {error && (
          <div className="rounded-lg border border-danger-container bg-danger-container px-3 py-2 text-sm text-danger">
            {error}
          </div>
        )}

        {type === ActorType.Passenger && (
          <p className="text-xs text-ink-soft">
            Passengers register anonymously and are authenticated immediately.
          </p>
        )}
        {type !== ActorType.Passenger && (
          <p className="text-xs text-ink-soft">
            {type === ActorType.Driver
              ? "Requires an admin token to create the driver role."
              : "Requires an admin token to create the bus."}
          </p>
        )}
      </div>
    </Modal>
  );
}
