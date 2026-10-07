/**
 * Saisons. Auf den Karten steht „25/26"; er sammelt alle, aktuell 25/26 und 26/27.
 *
 * Die Saison ist eine EINGABE (freier Text), aber sie wird in Form gebracht, wenn es
 * geht — sonst steht „2025/26" neben „25/26" und die Liste sortiert sie auseinander.
 * Was sich nicht lesen lässt, bleibt stehen, wie er es getippt hat, und landet hinten.
 */

/** Die Saisons, die immer zur Auswahl stehen — auch in einer leeren Sammlung. */
export const CURRENT_SEASONS: readonly string[] = ["26/27", "25/26"];

const pad2 = (n: number): string => String(n).padStart(2, "0");

/** „2025/26", „25-26", „ 25 / 26 " → „25/26"; „25/27" oder „Herbst" → null. */
export function normalizeSeason(text: string): string | null {
  const m = /^\s*(\d{2}|\d{4})\s*[/\-–]\s*(\d{2}|\d{4})\s*$/.exec(text);
  if (m === null) return null;
  const a = Number(m[1]!.slice(-2));
  const b = Number(m[2]!.slice(-2));
  if ((a + 1) % 100 !== b) return null;
  return `${pad2(a)}/${pad2(b)}`;
}

/** Das Startjahr einer normierten Saison; Match Attax gibt es seit 2007, also 20xx. */
export function seasonStartYear(season: string): number | null {
  const norm = normalizeSeason(season);
  if (norm === null) return null;
  const yy = Number(norm.slice(0, 2));
  return yy >= 90 ? 1900 + yy : 2000 + yy;
}

/** Eindeutig und neueste zuerst; was keine Saison ist, hinten und alphabetisch. */
export function sortSeasonsDesc(seasons: Iterable<string>): string[] {
  const unique = [...new Set([...seasons].map((s) => normalizeSeason(s) ?? s.trim()))].filter(
    (s) => s !== "",
  );
  return unique.sort((a, b) => {
    const ya = seasonStartYear(a);
    const yb = seasonStartYear(b);
    if (ya !== null && yb !== null) return yb - ya;
    if (ya !== null) return -1;
    if (yb !== null) return 1;
    return a.localeCompare(b, "de");
  });
}

/** Die Auswahl im Formular: die aktuellen plus alles, was schon in der Sammlung steht. */
export function seasonChoices(known: Iterable<string>): string[] {
  return sortSeasonsDesc([...CURRENT_SEASONS, ...known]);
}
