import { beforeEach, describe, expect, it } from "vitest";
import { EntityKind } from "@/features/actions/domain/action.types";
import { entityScopeKey, useEntityStore } from "@/shared/store/entity.store";

describe("entity.store", () => {
  beforeEach(() => {
    useEntityStore.getState().clear();
  });

  it("stores a bucket under the scoped key and patches it", () => {
    const key = entityScopeKey(EntityKind.Stop, "local", "7");
    useEntityStore.getState().setBucket(key, {
      items: [{ value: "1", label: "Central" }],
      status: "ready",
    });

    const bucket = useEntityStore.getState().buckets[key];
    expect(bucket.status).toBe("ready");
    expect(bucket.items[0].label).toBe("Central");
  });

  it("never shares buckets across env, actor, or kind", () => {
    const a = entityScopeKey(EntityKind.Stop, "local", "7");
    const b = entityScopeKey(EntityKind.Stop, "local", "8");
    useEntityStore.getState().setBucket(a, { status: "ready" });
    expect(useEntityStore.getState().buckets[b]).toBeUndefined();
    expect(
      useEntityStore.getState().buckets[
        entityScopeKey(EntityKind.Stop, "staging", "7")
      ],
    ).toBeUndefined();
    expect(
      useEntityStore.getState().buckets[
        entityScopeKey(EntityKind.Trip, "local", "7")
      ],
    ).toBeUndefined();
  });

  it("treats a missing actorId as the guest scope", () => {
    expect(entityScopeKey(EntityKind.Stop, "local")).toBe(
      entityScopeKey(EntityKind.Stop, "local", "guest"),
    );
  });

  it("clears all buckets", () => {
    useEntityStore
      .getState()
      .setBucket(entityScopeKey(EntityKind.Stop, "local"), {
        status: "ready",
      });
    useEntityStore.getState().clear();
    expect(useEntityStore.getState().buckets).toEqual({});
  });
});
