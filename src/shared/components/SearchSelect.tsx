"use client";

import { ChevronDown, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Spinner } from "./Spinner";

export interface SearchOption {
  value: string;
  label: string;
}

interface Props {
  label?: string;
  value?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  loadingLabel?: string;
  emptyLabel?: string;
  errorLabel?: string;
  loadMoreLabel?: string;
  onSelect: (value: string) => void;
  /** Backing options fetched into a store; filtered client-side by query. */
  options: SearchOption[];
  loading?: boolean;
  error?: string;
  hasMore?: boolean;
  onLoadMore?: () => void;
}

/**
 * Data-driven search selector. The caller supplies a store-backed set of
 * {@link options}; typing filters them **client-side** — no per-keystroke
 * network call. Optionally surfaces a load-more affordance for pagination.
 */
export function SearchSelect({
  label,
  value,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  loadingLabel = "Loading…",
  emptyLabel = "No results",
  errorLabel = "Search failed",
  loadMoreLabel = "Load more",
  onSelect,
  options,
  loading = false,
  error,
  hasMore = false,
  onLoadMore,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const selectedLabel = useMemo(
    () => options.find((o) => o.value === value)?.label,
    [options, value],
  );

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q),
    );
  }, [options, query]);

  const showLoading = loading && matches.length === 0;

  useEffect(() => {
    const handler = (ev: MouseEvent) => {
      if (ref.current && !ref.current.contains(ev.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative block">
      {label && (
        <span className="mb-1 block text-xs font-medium text-ink-soft">
          {label}
        </span>
      )}
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          setQuery("");
        }}
        className="flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 text-left text-sm text-ink outline-none transition-colors focus:border-primary"
      >
        <span className={value ? "" : "text-ink-faint"}>
          {selectedLabel ? selectedLabel : placeholder}
        </span>
        <span className="text-ink-soft">
          <ChevronDown size={15} />
        </span>
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-border bg-surface shadow-lg">
          <div className="relative border-b border-border p-2">
            <Search
              size={15}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-9 w-full rounded-md border border-border bg-surface-variant pl-8 pr-3 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-primary"
            />
          </div>
          <div className="max-h-56 overflow-y-auto scrollbar-thin">
            {showLoading && (
              <div className="flex items-center gap-2 px-3 py-2 text-sm text-ink-soft">
                <Spinner /> {loadingLabel}
              </div>
            )}
            {!showLoading && error && (
              <div className="px-3 py-2 text-sm text-ink-faint">
                {errorLabel}
              </div>
            )}
            {!showLoading && !error && matches.length === 0 && (
              <div className="px-3 py-2 text-sm text-ink-faint">
                {emptyLabel}
              </div>
            )}
            {matches.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => {
                  onSelect(o.value);
                  setOpen(false);
                }}
                className="flex w-full items-center px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-primary-container"
              >
                {o.label}
              </button>
            ))}
            {hasMore && (
              <button
                type="button"
                onClick={onLoadMore}
                className="flex w-full items-center justify-center gap-2 border-t border-border px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary-container"
              >
                {loading ? <Spinner /> : null}
                {loadMoreLabel}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
