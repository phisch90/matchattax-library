import { POSITIONS, type Card, type Position } from "./model.js";
import { normalizeSeason } from "./seasons.js";

/**
 * Filtern, sortieren, zusammenzählen — die Folgen einer Sammlung. Nichts davon wird
 * gespeichert; die Startseite rechnet es aus den Karten, die sie gerade zeigt.
 */

export type SortKey = "neu" | "name" | "def" | "att" | "value";
/** DEF vor ATT — seine Reihenfolge, überall. */
export const SORT_KEYS: readonly SortKey[] = ["neu", "name", "def", "att", "value"];

export interface CardFilter {
  /** „alle" oder eine Saison. */
  season: string;
  /** „alle" oder eine Position. */
  position: Position | "alle";
  /** Suchtext über Name und Kartennummer. */
  query: string;
  sort: SortKey;
}

export const DEFAULT_FILTER: CardFilter = { season: "alle", position: "alle", query: "", sort: "neu" };

function sameSeason(a: string, b: string): boolean {
  return (normalizeSeason(a) ?? a.trim()) === (normalizeSeason(b) ?? b.trim());
}

const fold = (text: string): string => text.trim().toLocaleLowerCase("de");

export function filterCards(cards: readonly Card[], filter: CardFilter): Card[] {
  const q = fold(filter.query);
  const shown = cards.filter((c) => {
    if (filter.season !== "alle" && !sameSeason(c.season, filter.season)) return false;
    if (filter.position !== "alle" && c.position !== filter.position) return false;
    if (q !== "" && !fold(`${c.name} ${c.number}`).includes(q)) return false;
    return true;
  });
  return shown.sort((a, b) => {
    switch (filter.sort) {
      case "name":
        return a.name.localeCompare(b.name, "de") || a.number.localeCompare(b.number, "de");
      case "att":
        return b.att - a.att || a.name.localeCompare(b.name, "de");
      case "def":
        return b.def - a.def || a.name.localeCompare(b.name, "de");
      case "value":
        return b.valueTenths - a.valueTenths || a.name.localeCompare(b.name, "de");
      case "neu":
        // Neueste zuerst: nach einer Serie steht oben, was er gerade eingetragen hat.
        return b.createdAt.localeCompare(a.createdAt) || a.name.localeCompare(b.name, "de");
    }
  });
}

export interface CollectionSummary {
  /** Verschiedene Karten. */
  cards: number;
  /** Stück, mit Mehrfachen. */
  pieces: number;
  byPosition: Record<Position, number>;
}

export function summarize(cards: readonly Card[]): CollectionSummary {
  const byPosition = Object.fromEntries(POSITIONS.map((p) => [p, 0])) as Record<Position, number>;
  let pieces = 0;
  for (const c of cards) {
    byPosition[c.position] += 1;
    pieces += c.qty;
  }
  return { cards: cards.length, pieces, byPosition };
}

/**
 * Schon da? Gleiche Sammlung, gleiche Saison — und dann die NUMMER, wenn der Entwurf
 * eine hat: sie ist die Kennung der Karte, zwei Karten mit derselben Nummer sind
 * dieselbe Karte. Ohne Nummer zählt der Name (ohne Groß/Klein). Für den
 * Doppelt-Hinweis, der die Anzahl erhöht statt eine zweite Zeile anzulegen.
 */
export function findDuplicates(
  cards: readonly Card[],
  draft: Pick<Card, "collectionId" | "season" | "number" | "name">,
  exceptId: string | null,
): Card[] {
  const number = fold(draft.number);
  const name = fold(draft.name);
  if (number === "" && name === "") return [];
  return cards.filter(
    (c) =>
      c.id !== exceptId &&
      c.collectionId === draft.collectionId &&
      sameSeason(c.season, draft.season) &&
      (number !== "" ? fold(c.number) === number : fold(c.name) === name),
  );
}

/**
 * Die Namen, die zum Getippten passen — „wenn J eingetippt wurde direkt alle Namen mit
 * J anzeigen". Getroffen wird am ANFANG des Namens oder eines Wortes darin (ein
 * „Kane" findet auch „Harry Kane"), ohne Groß/Klein, jeder Name einmal, alphabetisch.
 * Über alle Sammlungen hinweg: derselbe Spieler steckt in beiden Mappen.
 */
export function nameSuggestions(cards: readonly Pick<Card, "name">[], typed: string, limit: number): string[] {
  const q = fold(typed);
  if (q === "") return [];
  const seen = new Map<string, string>();
  for (const c of cards) {
    const name = c.name.trim();
    if (name === "") continue;
    const low = fold(name);
    if (seen.has(low)) continue;
    const hit = low.startsWith(q) || low.split(/\s+/).some((word) => word.startsWith(q));
    if (hit) seen.set(low, name);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, "de")).slice(0, limit);
}
