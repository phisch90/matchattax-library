import { formationOf, slotPositions } from "./formations.js";
import { TEAM_SIZE, type Card, type Position, type Team } from "./model.js";

/**
 * Die Teamregeln — gerechnet, nie gespeichert. WARNEN STATT SPERREN, mit EINER
 * Ausnahme, die er ausdrücklich bestellt hat: „beim team erstellen darf auf die
 * position immer nur die passende position. mittelfeld nur ins mittelfeld. keine
 * umgehung." Das ist `fitsSlot`, und die Oberfläche bietet nichts anderes an. Die
 * Warnung „falsche Position" bleibt trotzdem — für ein Team von früher und für eine
 * Karte, deren Position nachträglich geändert wurde.
 */

/** Seine Regel: „Optional Max 100mio Mannschaftswert." In Zehnteln. */
export const BUDGET_TENTHS = 1000;

export interface TeamTotals {
  att: number;
  def: number;
  valueTenths: number;
  /** Wie viele der elf Plätze eine KARTE tragen (gelöschte zählen nicht). */
  filled: number;
}

export type TeamIssue =
  | { kind: "leer"; count: number }
  | { kind: "fehlt"; slot: number }
  | { kind: "position"; slot: number; expected: Position; actual: Position; cardName: string }
  | { kind: "doppelt"; cardName: string }
  | { kind: "budget"; overTenths: number };

type TeamLike = Pick<Team, "formation" | "slots" | "budgetOn">;

/** Darf diese Karte auf einen Platz dieser Position? Nur mit genau dieser Position — keine Umgehung. */
export function fitsSlot(card: Pick<Card, "position">, slotPosition: Position): boolean {
  return card.position === slotPosition;
}

export function teamCards(team: TeamLike, cardsById: ReadonlyMap<string, Card>): (Card | null)[] {
  return Array.from({ length: TEAM_SIZE }, (_, i) => {
    const id = team.slots[i];
    return id === null || id === undefined ? null : (cardsById.get(id) ?? null);
  });
}

export function teamTotals(team: TeamLike, cardsById: ReadonlyMap<string, Card>): TeamTotals {
  const totals: TeamTotals = { att: 0, def: 0, valueTenths: 0, filled: 0 };
  for (const card of teamCards(team, cardsById)) {
    if (card === null) continue;
    totals.att += card.att;
    totals.def += card.def;
    totals.valueTenths += card.valueTenths;
    totals.filled += 1;
  }
  return totals;
}

export function teamIssues(team: TeamLike, cardsById: ReadonlyMap<string, Card>): TeamIssue[] {
  const issues: TeamIssue[] = [];
  const positions = slotPositions(formationOf(team.formation));
  const seen = new Map<string, number>();
  let empty = 0;

  for (let i = 0; i < TEAM_SIZE; i++) {
    const id = team.slots[i] ?? null;
    if (id === null) {
      empty++;
      continue;
    }
    const card = cardsById.get(id);
    if (card === undefined) {
      // Die Karte wurde gelöscht, der Platz zeigt ins Leere — sagen, nicht verschweigen.
      issues.push({ kind: "fehlt", slot: i });
      continue;
    }
    seen.set(id, (seen.get(id) ?? 0) + 1);
    const expected = positions[i]!;
    if (!fitsSlot(card, expected)) {
      issues.push({ kind: "position", slot: i, expected, actual: card.position, cardName: card.name });
    }
  }

  if (empty > 0) issues.unshift({ kind: "leer", count: empty });

  for (const [id, n] of seen) {
    if (n > 1) issues.push({ kind: "doppelt", cardName: cardsById.get(id)?.name ?? "?" });
  }

  if (team.budgetOn) {
    const over = teamTotals(team, cardsById).valueTenths - BUDGET_TENTHS;
    if (over > 0) issues.push({ kind: "budget", overTenths: over });
  }
  return issues;
}

/** Der Wert, der auf diesem Platz zählt: vorn ATT, hinten und im Tor DEF, in der Mitte beides. */
export function statForSlot(card: Card, position: Position): number {
  switch (position) {
    case "att":
      return card.att;
    case "def":
    case "gk":
      return card.def;
    case "mid":
      return card.att + card.def;
  }
}

/**
 * Die Reihenfolge im Auswähler: NUR die passende Position (alles andere darf dort gar
 * nicht hin), die stärkste Karte für diesen Platz oben, bei Gleichstand alphabetisch.
 */
export function sortForSlot<T extends Card>(cards: readonly T[], position: Position): T[] {
  return cards
    .filter((c) => fitsSlot(c, position))
    .sort((a, b) => {
      const sa = statForSlot(a, position);
      const sb = statForSlot(b, position);
      if (sa !== sb) return sb - sa;
      return a.name.localeCompare(b.name, "de");
    });
}

/**
 * Eine Karte auf einen Platz setzen. Steht sie schon auf einem anderen, TAUSCHEN die
 * beiden Plätze — sonst stünde dieselbe Karte zweimal da, und das ist genau eine der
 * Warnungen oben. Was vorher auf dem Zielplatz lag, wandert auf den alten Platz.
 * Die Position prüft der Aufrufer mit `fitsSlot` — hier gibt es nur Kennungen.
 */
export function placeCard(
  slots: readonly (string | null)[],
  slotIndex: number,
  cardId: string,
): (string | null)[] {
  const next = Array.from({ length: TEAM_SIZE }, (_, i) => slots[i] ?? null);
  const previousIndex = next.indexOf(cardId);
  const displaced = next[slotIndex] ?? null;
  next[slotIndex] = cardId;
  if (previousIndex !== -1 && previousIndex !== slotIndex) next[previousIndex] = displaced;
  return next;
}

export function clearSlot(slots: readonly (string | null)[], slotIndex: number): (string | null)[] {
  const next = Array.from({ length: TEAM_SIZE }, (_, i) => slots[i] ?? null);
  next[slotIndex] = null;
  return next;
}
