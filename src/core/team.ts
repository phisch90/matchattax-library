import { formationOf, slotPositions } from "./formations.js";
import { TEAM_SIZE, type Card, type Position, type Team } from "./model.js";

/**
 * Die Teamregeln — gerechnet, nie gespeichert. Und WARNEN STATT SPERREN: ein Team
 * mit zehn Karten, einem Verteidiger im Sturm oder 104.5M bleibt ein Team; die App
 * sagt, was daran nicht stimmt, und er entscheidet.
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
    if (card.position !== expected) {
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
 * Die Reihenfolge im Auswähler: passende Position zuerst, darin die stärkste Karte
 * oben, bei Gleichstand alphabetisch. Die Position ist der ERSTE Schlüssel, weil ein
 * Verteidiger im Sturm eine Warnung wert ist — er soll ihn finden können, aber nicht
 * zuerst.
 */
export function sortForSlot<T extends Card>(cards: readonly T[], position: Position): T[] {
  return [...cards].sort((a, b) => {
    const pa = a.position === position ? 0 : 1;
    const pb = b.position === position ? 0 : 1;
    if (pa !== pb) return pa - pb;
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
