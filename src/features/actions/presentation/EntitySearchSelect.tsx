"use client";

import { useMemo } from "react";
import type { EntityKind } from "@/features/actions/domain/action.types";
import type { BackendEnvironment } from "@/features/environments/domain/environment.types";
import {
  type SearchOption,
  SearchSelect,
} from "@/shared/components/SearchSelect";
import { useI18n } from "@/shared/i18n";
import { useEntitySearch } from "./useEntitySearch";

interface Props {
  env: BackendEnvironment;
  kind: EntityKind;
  actorId?: string;
  labelKey: string;
  value?: string;
  onChange: (value: string) => void;
  /** Optional client-side meta filter, e.g. `{ routeId }` to narrow trips. */
  filterMeta?: Record<string, string>;
  enabled?: boolean;
}

/**
 * Store-backed entity selector for action fields: loads an environment/actor/
 * kind-scoped dataset through the BFF and filters it on the client.
 */
export function EntitySearchSelect({
  env,
  kind,
  actorId,
  labelKey,
  value,
  onChange,
  filterMeta,
  enabled = true,
}: Props) {
  const { t } = useI18n();
  const { items, status, error, hasMore, loadMore } = useEntitySearch({
    env,
    kind,
    actorId,
    enabled,
  });

  const options = useMemo<SearchOption[]>(() => {
    const list = filterMeta
      ? items.filter((it) =>
          Object.entries(filterMeta).every(([k, v]) => it.meta?.[k] === v),
        )
      : items;
    return list.map((it) => ({ value: it.value, label: it.label }));
  }, [items, filterMeta]);

  return (
    <SearchSelect
      label={t(labelKey)}
      placeholder={t("action.selectEntity")}
      searchPlaceholder={t("action.searchEntity")}
      loadingLabel={t("action.searchLoading")}
      emptyLabel={t("entities.noResult")}
      errorLabel={
        status === "needsAuth"
          ? t("entities.needsAuth")
          : t("entities.searchError")
      }
      loadMoreLabel={t("entities.loadMore")}
      value={value}
      onSelect={onChange}
      options={options}
      loading={status === "loading"}
      error={status === "error" || status === "needsAuth" ? error : undefined}
      hasMore={hasMore}
      onLoadMore={loadMore}
    />
  );
}
