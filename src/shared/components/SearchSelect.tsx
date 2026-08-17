"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  onSelect: (value: string) => void;
  /** required: return options for the given query */
  load: (query: string) => Promise<SearchOption[]>;
}

export function SearchSelect({
  label,
  value,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  loadingLabel = "Loading…",
  emptyLabel = "No results",
  onSelect,
  load,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<SearchOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState<string | undefined>(
    value ? "…" : undefined,
  );
  const ref = useRef<HTMLDivElement>(null);

  const safeLoad = useCallback(
    async (q: string) => {
      setLoading(true);
      try {
        const opts = await load(q);
        setOptions(opts);
        return opts;
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    },
    [load],
  );

  useEffect(() => {
    if (open) safeLoad("");
  }, [open, safeLoad]);

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
          {selectedLabel && value ? selectedLabel : placeholder}
        </span>
        <span className="text-ink-soft">▾</span>
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-border bg-surface shadow-lg">
          <div className="border-b border-border p-2">
            <input
              value={query}
              onChange={async (e) => {
                const q = e.target.value;
                setQuery(q);
                safeLoad(q);
              }}
              placeholder={searchPlaceholder}
              className="h-9 w-full rounded-md border border-border bg-surface-variant px-3 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-primary"
            />
          </div>
          <div className="max-h-56 overflow-y-auto scrollbar-thin">
            {loading && (
              <div className="flex items-center gap-2 px-3 py-2 text-sm text-ink-soft">
                <Spinner /> {loadingLabel}
              </div>
            )}
            {!loading && options.length === 0 && (
              <div className="px-3 py-2 text-sm text-ink-faint">
                {emptyLabel}
              </div>
            )}
            {options.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => {
                  setSelectedLabel(o.label);
                  onSelect(o.value);
                  setOpen(false);
                }}
                className="flex w-full items-center px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-primary-container"
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
