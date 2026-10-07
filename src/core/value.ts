/**
 * Der Kartenwert: auf der Karte steht „10.0M", gespeichert werden Zehntel (100).
 *
 * Angezeigt wird er so, wie er auf der Karte steht — mit Punkt und M —, obwohl die
 * Oberfläche deutsch ist: er vergleicht die Zahl beim Eintragen mit dem Aufdruck,
 * und ein „10,0 M" neben einem „10.0M" ist eine Stelle, an der man zweimal hinschaut.
 * Getippt werden darf beides (Komma oder Punkt), mit oder ohne M.
 */

export function parseValueTenths(text: string): number | null {
  const cleaned = text.trim().replace(/\s+/g, "").replace(/m$/i, "").replace(",", ".");
  if (cleaned === "") return null;
  if (!/^\d{1,4}(\.\d{0,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 10);
}

/** 105 → „10.5M" */
export function formatValue(tenths: number): string {
  const whole = Math.trunc(tenths / 10);
  const frac = Math.abs(tenths % 10);
  return `${whole}.${frac}M`;
}

/** 105 → „10.5" — der Text für das Eingabefeld, ohne M. */
export function valueInputText(tenths: number): string {
  return formatValue(tenths).slice(0, -1);
}
