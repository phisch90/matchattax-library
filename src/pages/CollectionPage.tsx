import { useEffect, useMemo, useState } from "react";
import { DEFAULT_FILTER, SORT_KEYS, filterCards, summarize, type CardFilter } from "../core/collection.js";
import { POSITIONS } from "../core/model.js";
import { sortSeasonsDesc } from "../core/seasons.js";
import { useCards, useCollections } from "../lib/hooks.js";
import { HREF } from "../lib/routes.js";
import { S } from "../strings.js";
import { CardTile } from "../ui/CardTile.js";
import { CollectionSwitcher } from "../ui/CollectionSwitcher.js";
import { Chip, Empty, INPUT } from "../ui/bits.js";

/**
 * Die Startseite: welche Sammlung, dann die Karten als Kacheln im Kartenformat.
 * Gerechnet wird hier nichts selbst — Filter, Reihenfolge und die Summenzeile kommen
 * aus `core/collection.ts`.
 */
export function CollectionPage() {
  const state = useCollections();
  const cards = useCards(state.current?.id);
  const [filter, setFilter] = useState<CardFilter>(DEFAULT_FILTER);

  const seasons = useMemo(() => sortSeasonsDesc((cards ?? []).map((c) => c.season)), [cards]);
  const shown = useMemo(() => filterCards(cards ?? [], filter), [cards, filter]);
  const summary = useMemo(() => summarize(cards ?? []), [cards]);

  // Eine Saison, die es in DIESER Sammlung nicht gibt (nach dem Umschalten), darf nicht
  // still alles ausblenden.
  useEffect(() => {
    if (filter.season !== "alle" && !seasons.includes(filter.season)) {
      setFilter((f) => ({ ...f, season: "alle" }));
    }
  }, [seasons, filter.season]);

  const setPart = (part: Partial<CardFilter>): void => setFilter((f) => ({ ...f, ...part }));
  const positionsLine = POSITIONS.map((p) => `${summary.byPosition[p]} ${S.positions[p].short}`).join(" · ");

  return (
    <div className="space-y-3">
      <CollectionSwitcher state={state} />

      {cards === undefined || !state.loaded ? (
        <p className="text-sm text-slate-500">{S.common.loading}</p>
      ) : cards.length === 0 ? (
        <Empty title={S.collection.empty} text={S.collection.emptyHint} />
      ) : (
        <>
          {seasons.length > 1 && (
            <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1" role="group" aria-label={S.card.season}>
              <Chip active={filter.season === "alle"} onClick={() => setPart({ season: "alle" })}>
                {S.collection.allSeasons}
              </Chip>
              {seasons.map((s) => (
                <Chip key={s} active={filter.season === s} onClick={() => setPart({ season: s })}>
                  {s}
                </Chip>
              ))}
            </div>
          )}

          <input
            type="search"
            value={filter.query}
            onChange={(e) => setPart({ query: e.target.value })}
            placeholder={S.collection.search}
            aria-label={S.collection.search}
            className={INPUT}
          />

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1.5" role="group" aria-label={S.card.position}>
              <Chip active={filter.position === "alle"} onClick={() => setPart({ position: "alle" })}>
                {S.common.all}
              </Chip>
              {POSITIONS.map((p) => (
                <Chip
                  key={p}
                  active={filter.position === p}
                  onClick={() => setPart({ position: p })}
                  ariaLabel={S.positions[p].long}
                >
                  {S.positions[p].short}
                </Chip>
              ))}
            </div>
            <label className="ml-auto flex items-center gap-1 text-xs text-slate-400">
              <span className="sr-only">{S.collection.sortLabel}</span>
              <select
                value={filter.sort}
                onChange={(e) => setPart({ sort: e.target.value as CardFilter["sort"] })}
                className="min-h-9 rounded-lg border border-slate-700 bg-slate-900 px-2 text-sm text-slate-200"
              >
                {SORT_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {S.collection.sort[k]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <p className="text-xs text-slate-400" data-testid="summary">
            {S.collection.summary(summary.cards, summary.pieces)} · {positionsLine}
          </p>

          {shown.length === 0 ? (
            <Empty title={S.collection.noMatch} />
          ) : (
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4" data-testid="card-grid">
              {shown.map((c) => (
                <li key={c.id}>
                  <CardTile card={c} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {state.current !== null && (
        <a
          href={HREF.karteNeu}
          className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-20 flex min-h-12 items-center rounded-full bg-emerald-600 px-5 text-base font-semibold text-white shadow-lg shadow-black/40 hover:bg-emerald-500"
        >
          {S.collection.add}
        </a>
      )}
    </div>
  );
}
