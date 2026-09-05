import { useEffect, useRef, useState } from "react";
import { AppRow } from "../components/apps";
import { Chip, Empty, Loading } from "../components/ui";
import { playApi } from "../lib/playApi";
import { useStore } from "../lib/store";
import type { App, SearchFilter } from "../lib/types";
import { EMPTY_FILTER } from "../lib/types";

/** Mirrors SearchScreen.kt + FilterHeader (rating/downloads/free/no-ads/no-GMS). */
export function Search() {
  const { settings } = useStore();
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [results, setResults] = useState<App[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<SearchFilter>(EMPTY_FILTER);
  const boxRef = useRef<HTMLInputElement>(null);

  useEffect(() => { boxRef.current?.focus(); }, []);

  useEffect(() => {
    let alive = true;
    const t = setTimeout(() => {
      if (!query.trim()) { setSuggestions([]); return; }
      playApi.suggestions(query).then((s) => alive && setSuggestions(s));
    }, 180);
    return () => { alive = false; clearTimeout(t); };
  }, [query]);

  async function run(q: string, f: SearchFilter = filter) {
    const trimmed = q.trim();
    if (!trimmed) return;
    setSubmitted(trimmed);
    setSuggestions([]);
    setLoading(true);
    try {
      setResults(await playApi.search(trimmed, {
        ...f,
        noGMS: f.noGMS || settings.filterGMS,
      }));
    } finally {
      setLoading(false);
    }
  }

  function toggle(patch: Partial<SearchFilter>) {
    const next = { ...filter, ...patch };
    setFilter(next);
    if (submitted) run(submitted, next);
  }

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={(e) => { e.preventDefault(); run(query); }}
        className="flex items-center gap-2 rounded-2xl bg-[#1b1e22] p-2 pl-4"
      >
        <span className="text-gray-400">⌕</span>
        <input
          ref={boxRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search apps & games"
          className="flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-gray-500"
        />
        {query && (
          <button type="button" onClick={() => setQuery("")} className="rounded-lg px-2 text-gray-400 hover:text-white">✕</button>
        )}
        <button type="submit" className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:bg-emerald-400">
          Search
        </button>
      </form>

      {!!suggestions.length && (
        <div className="overflow-hidden rounded-2xl bg-[#1b1e22]">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => { setQuery(s); run(s); }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[14px] text-gray-200 hover:bg-white/5"
            >
              <span className="text-gray-500">⌕</span> {s}
            </button>
          ))}
        </div>
      )}

      {submitted && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          <Chip active={filter.isFree} onClick={() => toggle({ isFree: !filter.isFree })}>Free</Chip>
          <Chip active={filter.noAds} onClick={() => toggle({ noAds: !filter.noAds })}>No ads</Chip>
          <Chip active={filter.noGMS} onClick={() => toggle({ noGMS: !filter.noGMS })}>No GMS</Chip>
          <Chip active={filter.minRating > 0} onClick={() => toggle({ minRating: filter.minRating > 0 ? 0 : 4 })}>★ 4.0+</Chip>
          <Chip active={filter.minInstalls > 0} onClick={() => toggle({ minInstalls: filter.minInstalls > 0 ? 0 : 1_000_000 })}>1M+ downloads</Chip>
        </div>
      )}

      {loading && <Loading label={`Searching for “${submitted}”…`} />}
      {!loading && submitted && results && results.length === 0 && (
        <Empty icon="🔍" title="No apps found" hint={`Nothing matched “${submitted}” with the current filters. Try clearing them.`} />
      )}
      {!loading && !submitted && (
        <Empty icon="⌕" title="Search the Play catalog" hint="Suggestions appear as you type. Filters: rating, downloads, free, no-ads, no-GMS (mirrors FilterHeader)." />
      )}
      {!loading && results && results.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-[13px] text-gray-500">{results.length} result{results.length === 1 ? "" : "s"} for “{submitted}”</p>
          {results.map((a) => <AppRow key={a.packageName} app={a} />)}
        </div>
      )}
    </div>
  );
}
