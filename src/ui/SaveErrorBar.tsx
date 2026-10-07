import { useSaveError } from "../lib/saveError.js";
import { S } from "../strings.js";

/** Das Band für ein fehlgeschlagenes Speichern — mit einem ECHTEN zweiten Versuch. */
export function SaveErrorBar() {
  const message = useSaveError((s) => s.message);
  const busy = useSaveError((s) => s.busy);
  const retryNow = useSaveError((s) => s.retryNow);
  const clear = useSaveError((s) => s.clear);
  if (message === null) return null;
  return (
    <div role="alert" className="border-b border-rose-800 bg-rose-950 px-3 py-2">
      <div className="mx-auto flex max-w-3xl items-center gap-2">
        <span className="min-w-0 flex-1 text-xs text-rose-100">{message}</span>
        <button
          type="button"
          onClick={() => void retryNow()}
          disabled={busy}
          className="shrink-0 rounded border border-rose-400 px-2 py-1 text-xs font-semibold text-rose-50 hover:bg-rose-900/60 disabled:opacity-60"
        >
          {S.saveError.retry}
        </button>
        <button
          type="button"
          onClick={clear}
          aria-label={S.saveError.dismiss}
          className="shrink-0 px-1 text-rose-300 hover:text-rose-100"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
