/**
 * Die Scroll-Höhe je Verlaufseintrag — damit „Zurück" aus einer Karte wieder dort
 * landet, wo er in der Sammlung war. Sein Einwand in Chardex35 war wörtlich: „springt
 * der immer an Seitenanfang. Das ist blöd."
 *
 * Diese App scrollt das FENSTER (nicht ein `main`), also stimmt `window.scrollY`.
 * Drei Dinge sind trotzdem nicht selbstverständlich:
 *
 * 1. Gemerkt werden muss die Höhe, BEVOR React die neue Seite rendert. Ist die neue
 *    Seite kürzer, klemmt der Browser `scrollY` sofort ab, und ein später gelesener
 *    Wert ist schon der falsche. Deshalb hört ein Horcher auf `hashchange`, der VOR
 *    dem Router angemeldet ist (Modulebene, beim ersten Import).
 * 2. Ob ein Wechsel ZURÜCK ist oder ein neuer Schritt, sagt der Pfad nicht: wer aus
 *    einer Karte auf „Sammlung" tippt, landet auf demselben Pfad wie mit „Zurück".
 *    Deshalb bekommt jeder Verlaufseintrag eine NUMMER in `history.state` — ein neuer
 *    Eintrag hat noch keine, ein besuchter trägt seine. Gemerkt wird je Nummer.
 * 3. Beim Zurückkommen ist die Liste noch nicht da — sie kommt aus der Datenbank.
 *    Ein einmaliges `scrollTo` verpufft an einer leeren Seite. Die Höhe wird deshalb
 *    NACHGESETZT, bei jedem Bild und bei jedem Wachsen der Seite, bis sie sitzt oder
 *    die Frist um ist — und hört sofort auf, sobald er selbst anfasst (Finger, Rad,
 *    Taste). Eine App, die gegen den Daumen scrollt, ist schlimmer als eine, die die
 *    Höhe vergisst.
 */

/** Wie lange nach dem Wechsel noch nachgesetzt wird. Länger als jede Datenbankabfrage, kürzer als sein Daumen. */
const RESTORE_WINDOW_MS = 2500;

/** Scroll-Höhe je Verlaufsnummer. */
const positions = new Map<number, number>();
let currentIdx = 0;
let pending: { hash: string; y: number } | null = null;
let restoreToken = 0;

const hashOf = (url: string): string => {
  const i = url.indexOf("#");
  return i === -1 ? "#/" : url.slice(i);
};

function readIdx(): number | undefined {
  const state = history.state as { idx?: unknown } | null;
  return state !== null && typeof state?.idx === "number" ? state.idx : undefined;
}

function stopRestore(): void {
  restoreToken++;
}

if (typeof window !== "undefined") {
  const idx = readIdx();
  try {
    if (idx === undefined) history.replaceState({ idx: 0 }, "");
    else currentIdx = idx;
  } catch (error) {
    console.error(error);
  }

  window.addEventListener("hashchange", (event) => {
    /*
      Alles hier ist Bequemlichkeit. Wirft etwas (ein Browser, der `replaceState` in
      diesem Moment verweigert), darf das die Navigation nicht aufhalten — die Seite
      wechselt dann eben ohne gemerkte Höhe.
    */
    try {
      positions.set(currentIdx, window.scrollY);
      const to = hashOf(event.newURL);
      const target = readIdx();
      if (target === undefined) {
        // Ein neuer Eintrag: Nummer vergeben, oben anfangen.
        currentIdx += 1;
        history.replaceState({ idx: currentIdx }, "");
        pending = { hash: to, y: 0 };
      } else {
        // Zurück oder vor im Verlauf: die gemerkte Höhe dieses Eintrags.
        currentIdx = target;
        pending = { hash: to, y: positions.get(target) ?? 0 };
      }
    } catch (error) {
      console.error(error);
      pending = null;
    }
  });
  for (const type of ["wheel", "touchstart", "keydown", "pointerdown"] as const) {
    window.addEventListener(type, stopRestore, { passive: true });
  }
}

/** Gibt es in DIESER App einen Schritt zurück? Sonst führt „Zurück" auf die Startseite. */
export function canGoBack(): boolean {
  return currentIdx > 0;
}

/**
 * Nach dem Rendern der neuen Adresse aufrufen: setzt die gemerkte Höhe (oder 0) und
 * setzt sie nach, bis die Seite hoch genug ist.
 */
export function applyPendingScroll(hash: string): void {
  if (pending === null || pending.hash !== hash) return;
  const { y } = pending;
  pending = null;
  try {
    restore(y);
  } catch (error) {
    // Eine Scroll-Hilfe, die wirft, würde als Fehler im Effekt die ganze App abräumen.
    console.error(error);
  }
}

function restore(y: number): void {
  const token = ++restoreToken;
  const started = performance.now();
  let observer: ResizeObserver | null = null;

  const attempt = (): boolean => {
    window.scrollTo(0, y);
    return Math.abs(window.scrollY - y) <= 2;
  };
  const stop = (): void => {
    observer?.disconnect();
    observer = null;
  };
  const tick = (): void => {
    if (token !== restoreToken || attempt() || performance.now() - started > RESTORE_WINDOW_MS) {
      stop();
      return;
    }
    requestAnimationFrame(tick);
  };

  if (typeof ResizeObserver !== "undefined") {
    observer = new ResizeObserver(() => {
      if (token === restoreToken) attempt();
      else stop();
    });
    observer.observe(document.documentElement);
  }
  requestAnimationFrame(tick);
}
