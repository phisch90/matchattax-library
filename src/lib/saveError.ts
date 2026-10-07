import { create } from "zustand";
import { S } from "../strings.js";

/**
 * Ein fehlgeschlagenes Speichern muss SICHTBAR sein — auf dem Handy schaut niemand in
 * die Konsole. Die Lehre aus Chardex35: eine Zahl, die zurückspringt, sucht man in
 * den eigenen Fingern, nicht in der App.
 *
 * Jede Schreibstelle übergibt ihren Aufruf als Funktion; die Leiste bietet GENAU
 * diesen noch einmal an. Das ist ein echter zweiter Versuch, kein Knopf, der nur
 * so aussieht.
 */
interface SaveErrorState {
  message: string | null;
  retry: (() => Promise<unknown>) | null;
  busy: boolean;
  report: (message: string, retry: () => Promise<unknown>) => void;
  clear: () => void;
  retryNow: () => Promise<void>;
}

export const useSaveError = create<SaveErrorState>((set, get) => ({
  message: null,
  retry: null,
  busy: false,
  report: (message, retry) => set({ message, retry, busy: false }),
  clear: () => set({ message: null, retry: null, busy: false }),
  retryNow: async () => {
    const { retry, busy } = get();
    if (retry === null || busy) return;
    set({ busy: true });
    try {
      await retry();
      set({ message: null, retry: null, busy: false });
    } catch (error) {
      console.error(error);
      set({ busy: false });
    }
  },
}));

/** Der Grund in seinen Worten. Die Konsole behält das ganze Fehlerobjekt. */
export function describeSaveError(error: unknown, was: string): string {
  const name = error instanceof Error ? error.name : "";
  if (name === "QuotaExceededError") return S.saveError.withReason(was, S.saveError.quota);
  return S.saveError.generic(was);
}

/**
 * Ob ein Schreibvorgang durch ist — als eigenes Ja/Nein, NICHT als Rückgabewert.
 * Ein Löschen gibt `undefined` zurück, und ein Erfolg, der aussieht wie ein
 * Fehlschlag, hat den Folgeschritt schon einmal verschluckt: nach dem Löschen blieb
 * die Seite auf „gibt es nicht mehr" stehen, ohne Bestätigung und ohne Zurück.
 */
export type WriteResult<T> = { ok: true; value: T } | { ok: false };

/**
 * Schreiben, und wenn es scheitert: protokollieren UND melden. Der Aufrufer macht
 * den Folgeschritt (navigieren, Formular leeren) nur bei `ok`.
 */
export async function guardWrite<T>(write: () => Promise<T>, was: string): Promise<WriteResult<T>> {
  try {
    return { ok: true, value: await write() };
  } catch (error) {
    console.error(error);
    useSaveError.getState().report(describeSaveError(error, was), write);
    return { ok: false };
  }
}
