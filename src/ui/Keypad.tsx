import { S } from "../strings.js";

/**
 * Ein eigener Zifferblock, statt der Tastatur des Geräts.
 *
 * Der Grund ist das iPhone: sein Zahlenfeld (`inputMode="numeric"`) hat KEINE
 * Weiter-Taste — „Enter ist Weiter" gilt dort nur für die Buchstaben-Tastatur. Mit
 * dem Zahlenfeld hätte er bei DEF, ATT und Wert jedes Mal das nächste Feld antippen
 * müssen, und das ist genau der Klick, den er nicht will. Hier ist die Weiter-Taste
 * Teil der Seite, die Nummer springt nach der dritten Ziffer von selbst, und es gibt
 * nichts, was erst aufgehen muss.
 *
 * Die Tasten sind groß (mindestens 56 px), weil mit dem Daumen getippt wird.
 */
export function Keypad({
  onDigit,
  onPoint,
  onDelete,
  decimal,
}: {
  onDigit: (digit: string) => void;
  onPoint?: (() => void) | undefined;
  onDelete: () => void;
  /** Die Punkt-Taste nur dort, wo ein Wert wie 10.5 getippt wird. */
  decimal: boolean;
}) {
  const key = "min-h-14 rounded-xl border border-slate-700 bg-slate-900 text-2xl font-semibold text-slate-100 hover:bg-slate-800 active:bg-slate-700";
  return (
    <div className="grid grid-cols-3 gap-2" role="group" aria-label={S.wizard.keypad}>
      {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
        <button key={d} type="button" onClick={() => onDigit(d)} data-key={d} className={key}>
          {d}
        </button>
      ))}
      {decimal ? (
        <button type="button" onClick={() => onPoint?.()} data-key="." aria-label={S.wizard.keypadPoint} className={key}>
          .
        </button>
      ) : (
        <span aria-hidden="true" />
      )}
      <button type="button" onClick={() => onDigit("0")} data-key="0" className={key}>
        0
      </button>
      <button type="button" onClick={onDelete} data-key="del" aria-label={S.wizard.keypadDelete} className={`${key} text-xl`}>
        ⌫
      </button>
    </div>
  );
}
