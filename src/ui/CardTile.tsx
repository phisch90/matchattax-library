import type { CardRow } from "../db/db.js";
import { formatValue } from "../core/value.js";
import { HREF } from "../lib/routes.js";
import { S } from "../strings.js";
import { CardThumb } from "./CardThumb.js";
import { PositionBadge } from "./bits.js";

/** Eine Karte in der Sammlung: Foto im Kartenformat, darunter das, was man beim Suchen braucht. */
export function CardTile({ card }: { card: CardRow }) {
  const line = [card.number === "" ? null : `Nr. ${card.number}`, card.season === "" ? null : card.season]
    .filter((s): s is string => s !== null)
    .join(" · ");
  return (
    <a
      href={HREF.karte(card.id)}
      data-card-id={card.id}
      className="block overflow-hidden rounded-xl border border-slate-800 bg-slate-900 hover:border-slate-600"
    >
      <div className="relative aspect-[63/88]">
        <CardThumb thumb={card.thumb} position={card.position} className="h-full w-full text-3xl" />
        <PositionBadge position={card.position} className="absolute left-1.5 top-1.5" />
        {card.qty > 1 && (
          <span className="absolute right-1.5 top-1.5 rounded bg-slate-950/85 px-1.5 py-0.5 text-xs font-semibold tabular-nums">
            ×{card.qty}
          </span>
        )}
      </div>
      <div className="p-2">
        <div className="truncate text-sm font-medium">{card.name === "" ? "—" : card.name}</div>
        <div className="truncate text-xs text-slate-400">{line === "" ? " " : line}</div>
        {/* DEF vor ATT — seine Reihenfolge; das ganze Wort steht als Tooltip dran. */}
        <div className="mt-1 flex items-center justify-between text-xs tabular-nums text-slate-300">
          <span title={S.card.defLong}>
            <strong className="text-slate-100">{card.def}</strong> DEF
          </span>
          <span title={S.card.attLong}>
            <strong className="text-slate-100">{card.att}</strong> ATT
          </span>
          <span>{formatValue(card.valueTenths)}</span>
        </div>
      </div>
    </a>
  );
}
