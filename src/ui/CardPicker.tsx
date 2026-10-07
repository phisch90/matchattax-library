import { useEffect, useMemo, useState } from "react";
import type { Position, Team } from "../core/model.js";
import { sortForSlot, statForSlot } from "../core/team.js";
import { formatValue } from "../core/value.js";
import type { CardRow } from "../db/db.js";
import { S } from "../strings.js";
import { CardThumb } from "./CardThumb.js";
import { INPUT, PositionBadge, Sheet } from "./bits.js";

/**
 * Welche Karte auf diesen Platz? NUR die passende Position — sein Wort: „mittelfeld
 * nur ins mittelfeld. keine umgehung." Es gibt deshalb keinen Schalter „alle
 * Positionen" mehr; die Liste sagt oben, was hier erlaubt ist. Stärkste Karte oben.
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
  const [query, setQuery] = useState("");

  /*
    Der Auswähler bleibt im Baum, wenn das Blatt zu ist — die Suche vom vorigen Platz
    stünde sonst still im Feld, und der nächste Platz bekäme „keine passende Karte"
    für eine Nummer, nach der niemand mehr sucht. Gefunden hat es die Strecke.
  */
  useEffect(() => {
    setQuery("");
  }, [slot]);

  const list = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("de");
    const filtered = cards.filter(
      (c) => q === "" || `${c.name} ${c.number}`.toLocaleLowerCase("de").includes(q),
    );
    return sortForSlot(filtered, position);
  }, [cards, position, query]);

  const open = slot !== null;
  const currentId = slot === null ? null : (team.slots[slot] ?? null);

  return (
    <Sheet open={open} title={S.teams.pickTitle(position, slot ?? 0)} onClose={onClose}>
      <div className="space-y-2">
        <p className="text-xs text-slate-500" data-testid="picker-rule">
          {S.teams.pickOnly(position)}
        </p>
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
          <p className="py-6 text-center text-sm text-slate-500">{S.teams.pickEmpty(position)}</p>
        ) : (
          <ul className="divide-y divide-slate-800" data-testid="picker-list">
            {list.map((c) => {
              const inSlot = team.slots.indexOf(c.id);
              const isHere = inSlot === slot;
              const line = [c.number === "" ? null : `Nr. ${c.number}`, c.season === "" ? null : c.season]
                .filter((s): s is string => s !== null)
                .join(" · ");
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
                        {line}
                        {inSlot !== -1 && (
                          <span className={`text-emerald-300 ${line === "" ? "" : "ml-1"}`}>
                            {line === "" ? "" : "· "}
                            {S.teams.pickInTeam(inSlot)}
                          </span>
                        )}
                      </span>
                    </span>
                    <span className="shrink-0 text-right text-xs tabular-nums text-slate-300">
                      <span className="block text-base font-semibold text-slate-100">{statForSlot(c, position)}</span>
                      <span className="block">
                        {c.def} DEF · {c.att} ATT
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
