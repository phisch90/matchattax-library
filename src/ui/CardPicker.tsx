import { useMemo, useState } from "react";
import type { Position, Team } from "../core/model.js";
import { sortForSlot, statForSlot } from "../core/team.js";
import { formatValue } from "../core/value.js";
import type { CardRow } from "../db/db.js";
import { S } from "../strings.js";
import { CardThumb } from "./CardThumb.js";
import { Chip, INPUT, PositionBadge, Sheet } from "./bits.js";

/**
 * Welche Karte auf diesen Platz? Passende Position zuerst, stärkste oben — und auf
 * Wunsch alle anderen, weil ein Verteidiger im Sturm sein gutes Recht ist (die App
 * warnt dann, sie sperrt nicht).
 */
export function CardPicker({
  slot,
  position,
  team,
  cards,
  onPick,
  onClear,
  onClose,
}: {
  slot: number | null;
  position: Position;
  team: Team;
  cards: readonly CardRow[];
  onPick: (cardId: string) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const [onlyPosition, setOnlyPosition] = useState(true);
  const [query, setQuery] = useState("");

  const list = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("de");
    const filtered = cards.filter((c) => {
      if (onlyPosition && c.position !== position) return false;
      if (q !== "" && !`${c.name} ${c.club}`.toLocaleLowerCase("de").includes(q)) return false;
      return true;
    });
    return sortForSlot(filtered, position);
  }, [cards, onlyPosition, position, query]);

  const open = slot !== null;
  const currentId = slot === null ? null : (team.slots[slot] ?? null);

  return (
    <Sheet open={open} title={S.teams.pickTitle(position, slot ?? 0)} onClose={onClose}>
      <div className="space-y-2">
        <div className="flex gap-1.5">
          <Chip active={onlyPosition} onClick={() => setOnlyPosition(true)}>
            {S.teams.pickOnlyPosition(position)}
          </Chip>
          <Chip active={!onlyPosition} onClick={() => setOnlyPosition(false)}>
            {S.teams.pickAll}
          </Chip>
        </div>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={S.teams.pickSearch}
          aria-label={S.teams.pickSearch}
          className={INPUT}
        />
        {currentId !== null && (
          <button
            type="button"
            onClick={onClear}
            className="w-full rounded-lg border border-slate-700 px-3 py-2 text-left text-sm text-rose-200 hover:bg-slate-900"
          >
            {S.teams.clearSlot}
          </button>
        )}
        {list.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">{S.teams.pickEmpty}</p>
        ) : (
          <ul className="divide-y divide-slate-800" data-testid="picker-list">
            {list.map((c) => {
              const inSlot = team.slots.indexOf(c.id);
              const isHere = inSlot === slot;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onPick(c.id)}
                    data-card-id={c.id}
                    className={`flex w-full items-center gap-3 py-2 text-left hover:bg-slate-900 ${isHere ? "opacity-60" : ""}`}
                  >
                    <CardThumb thumb={c.thumb} position={c.position} className="h-14 w-10 shrink-0 rounded text-xs" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <PositionBadge position={c.position} />
                        <span className="truncate text-sm font-medium">{c.name}</span>
                      </span>
                      <span className="block truncate text-xs text-slate-400">
                        {[c.club, c.season].filter((s) => s !== "").join(" · ")}
                        {inSlot !== -1 && (
                          <span className="ml-1 text-emerald-300">· {S.teams.pickInTeam(inSlot)}</span>
                        )}
                      </span>
                    </span>
                    <span className="shrink-0 text-right text-xs tabular-nums text-slate-300">
                      <span className="block text-base font-semibold text-slate-100">{statForSlot(c, position)}</span>
                      <span className="block">
                        {c.att} / {c.def}
                      </span>
                      <span className="block text-slate-500">{formatValue(c.valueTenths)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Sheet>
  );
}
