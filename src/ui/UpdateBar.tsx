import { useState } from "react";
import { updateBarVisible, updateState, useUpdateStore, useVersionWatch } from "../lib/updateStore.js";
import { S } from "../strings.js";

/**
 * „Neue Fassung ist da" — als Band unter der Hauptnavigation, auf JEDER Seite.
 * Es trägt die Prüfung mit (`useVersionWatch`); der Weg zum wirklichen
 * Aktualisieren steht in `lib/swUpdate.ts`, samt dem Grund, warum ein bloßes
 * Neuladen in einer installierten Web-App nichts tut.
 */
export function UpdateBar() {
  useVersionWatch();
  const swWaiting = useUpdateStore((s) => s.swWaiting);
  const deployed = useUpdateStore((s) => s.deployed);
  const dismissedFor = useUpdateStore((s) => s.dismissedFor);
  const busy = useUpdateStore((s) => s.busy);
  const dismiss = useUpdateStore((s) => s.dismiss);
  const apply = useUpdateStore((s) => s.apply);
  const [showHint, setShowHint] = useState(false);

  if (!updateBarVisible({ swWaiting, deployed, dismissedFor })) return null;
  const state = updateState({ swWaiting, deployed });

  return (
    <div role="status" className="border-b border-emerald-800 bg-emerald-950 px-3 py-2">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 text-xs text-emerald-100">
            <strong className="font-semibold">
              {state.kind === "bereit" ? S.update.ready : S.update.onServer}
            </strong>
            {state.kind === "server" && (
              <span className="ml-1 tabular-nums text-emerald-400/70">{state.commit}</span>
            )}
          </span>
          <button
            type="button"
            onClick={() => void apply()}
            disabled={busy}
            className="shrink-0 rounded border border-emerald-500 px-2 py-1 text-xs font-semibold text-emerald-100 hover:bg-emerald-900/60 disabled:opacity-60"
          >
            {busy ? S.update.busy : S.update.apply}
          </button>
          <button
            type="button"
            onClick={() => setShowHint(!showHint)}
            aria-expanded={showHint}
            aria-label="Was passiert dabei?"
            className="shrink-0 px-1 text-emerald-400/70 hover:text-emerald-200"
          >
            ?
          </button>
          <button
            type="button"
            onClick={dismiss}
            aria-label={S.update.dismiss}
            className="shrink-0 px-1 text-emerald-400/70 hover:text-emerald-200"
          >
            ✕
          </button>
        </div>
        {showHint && <p className="mt-1.5 text-[11px] leading-snug text-emerald-200/80">{S.update.hint}</p>}
      </div>
    </div>
  );
}
