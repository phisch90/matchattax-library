import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import type { Position } from "../core/model.js";
import { S } from "../strings.js";

/*
  Die kleinen Bausteine. Eine Bauart je Sache, damit eine Änderung an EINER Stelle
  überall ankommt — und damit es nicht drei Sorten Knöpfe in einer Zeile gibt.
*/

type Tone = "primary" | "neutral" | "danger" | "ghost";
const TONES: Record<Tone, string> = {
  primary: "bg-emerald-600 text-white hover:bg-emerald-500 disabled:bg-emerald-900 disabled:text-emerald-200/60",
  neutral: "border border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800 disabled:opacity-50",
  danger: "bg-rose-700 text-white hover:bg-rose-600 disabled:opacity-50",
  ghost: "text-slate-300 hover:bg-slate-800 disabled:opacity-50",
};

export function Btn({
  tone = "neutral",
  className = "",
  type = "button",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone }) {
  return (
    <button
      type={type}
      className={`min-h-11 rounded-lg px-3 py-2 text-sm font-medium ${TONES[tone]} ${className}`}
      {...rest}
    />
  );
}

export function Box({
  children,
  className = "",
  title,
  right,
}: {
  children: ReactNode;
  className?: string;
  title?: string | undefined;
  right?: ReactNode;
}) {
  return (
    <section className={`rounded-xl border border-slate-800 bg-slate-900/60 p-3 ${className}`}>
      {title !== undefined && (
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</h2>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function Chip({
  active,
  onClick,
  children,
  className = "",
  ariaLabel,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
  ariaLabel?: string | undefined;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={ariaLabel}
      className={`min-h-9 shrink-0 rounded-full border px-3 py-1.5 text-sm ${
        active
          ? "border-emerald-500 bg-emerald-600/20 text-emerald-200"
          : "border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
      } ${className}`}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string | undefined;
  error?: string | null | undefined;
  children: ReactNode;
  htmlFor?: string | undefined;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-xs font-medium text-slate-400">
        {label}
      </label>
      {children}
      {error != null && error !== "" ? (
        <p className="mt-1 text-xs text-rose-300">{error}</p>
      ) : (
        hint !== undefined && <p className="mt-1 text-xs text-slate-500">{hint}</p>
      )}
    </div>
  );
}

export const INPUT =
  "w-full min-h-11 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-base text-slate-100 placeholder:text-slate-600 focus:border-emerald-500 focus:outline-none";

/** Eine Auswahl aus wenigen Werten, als Knopfreihe — kein Durchschalten, kein Aufklapper. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  className = "",
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={`flex gap-1 rounded-xl bg-slate-900 p-1 ${className}`}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={`min-h-10 flex-1 truncate rounded-lg px-2 text-sm font-medium ${
            o.value === value ? "bg-emerald-600 text-white" : "text-slate-300 hover:bg-slate-800"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Ein Blatt von unten. Schließt per Hintergrund-Tipp und Escape. */
export function Sheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[88vh] w-full max-w-lg flex-col rounded-t-2xl border border-slate-800 bg-slate-950 shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-center justify-between gap-2 border-b border-slate-800 px-4 py-3">
          <h2 className="text-base font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800"
          >
            ✕
          </button>
        </div>
        <div className="overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">{children}</div>
      </div>
    </div>
  );
}

export function Empty({ title, text, children }: { title: string; text?: string | undefined; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-700 p-6 text-center">
      <p className="text-base font-medium text-slate-200">{title}</p>
      {text !== undefined && <p className="mt-1 text-sm text-slate-400">{text}</p>}
      {children !== undefined && <div className="mt-3">{children}</div>}
    </div>
  );
}

/**
 * Löschen in zwei Stufen, ohne Tippen. „Abbrechen" steht VOR dem roten Knopf: sonst
 * lägen die zwei Stufen übereinander, und der zweite Tipp eines Doppeltipps träfe
 * sofort „löschen". Der NAME steht im Knopf — das ist der Schutz vor der falschen
 * Karte, und den trägt die Beschriftung.
 */
export function DangerZone({
  label,
  confirmLabel,
  hint,
  onConfirm,
}: {
  label: string;
  confirmLabel: string;
  hint: string;
  onConfirm: () => void;
}) {
  const [armed, setArmed] = useState(false);
  return (
    <section className="rounded-xl border border-rose-900/60 p-3">
      {!armed ? (
        <Btn tone="ghost" className="text-rose-300" onClick={() => setArmed(true)}>
          {label}
        </Btn>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-rose-200">{hint}</p>
          <div className="flex flex-wrap gap-2">
            <Btn onClick={() => setArmed(false)}>{S.common.cancel}</Btn>
            <Btn tone="danger" onClick={onConfirm}>
              {confirmLabel}
            </Btn>
          </div>
        </div>
      )}
    </section>
  );
}

/** Die Farbe je Position — immer dieselbe, auf der Kachel, im Team, im Auswähler. */
export const POSITION_TONE: Record<Position, string> = {
  gk: "bg-amber-500 text-amber-950",
  def: "bg-sky-500 text-sky-950",
  mid: "bg-emerald-500 text-emerald-950",
  att: "bg-orange-500 text-orange-950",
};

export function PositionBadge({ position, className = "" }: { position: Position; className?: string }) {
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold leading-none ${POSITION_TONE[position]} ${className}`}
      title={S.positions[position].long}
    >
      {S.positions[position].short}
    </span>
  );
}
