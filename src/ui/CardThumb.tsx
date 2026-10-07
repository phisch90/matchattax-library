import type { Position } from "../core/model.js";
import { useObjectUrl } from "../lib/hooks.js";
import { S } from "../strings.js";

/**
 * Das kleine Kartenbild — oder, ohne Foto, das Positionskürzel auf grauem Grund.
 * Ein leeres Feld sähe aus wie ein Fehler; ein Kürzel sagt, was dort läge.
 */
export function CardThumb({
  thumb,
  position,
  className = "",
}: {
  thumb: Blob | undefined;
  position: Position;
  className?: string;
}) {
  const url = useObjectUrl(thumb);
  return (
    <div className={`overflow-hidden bg-slate-800 ${className}`}>
      {url !== undefined ? (
        <img src={url} alt="" className="h-full w-full object-cover" draggable={false} />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-slate-600">
          <span className="text-[0.9em] font-bold">{S.positions[position].short}</span>
        </div>
      )}
    </div>
  );
}
