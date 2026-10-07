import { POSITIONS, type Card, type Position } from "./model.js";
import { normalizeSeason } from "./seasons.js";

/**
 * Filtern, sortieren, zusammenzählen — die Folgen einer Sammlung. Nichts davon wird
 * gespeichert; die Startseite rechnet es aus den Karten, die sie gerade zeigt.
 */

export type SortKey = "neu" | "name" | "att" | "def" | "value";
export const SORT_KEYS: readonly SortKey[] = ["neu", "name", "att", "def", "value"];

export interface CardFilter {
  /** „alle" oder eine Saison. */
  season: string;
  /** „alle" oder eine Position. */
  position: Position | "alle";
  /** Suchtext über Name und Verein. */
  query: string;
  sort: SortKey;
}

export const DEFAULT_FILTER: CardFilter = { season: "alle", position: "alle", query: "", sort: "neu" };

function sameSeason(a: string, b: string): boolean {
  return (normalizeSeason(a) ?? a.trim()) === (normalizeSeason(b) ?? b.trim());
}

export function filterCards(cards: readonly Card[], filter: CardFilter): Card[] {
  const q = filter.query.trim().toLocaleLowerCase("de");
  const shown = cards.filter((c) => {
    if (filter.season !== "alle" && !sameSeason(c.season, filter.season)) return false;
    if (filter.position !== "alle" && c.position !== filter.position) return false;
    if (q !== "") {
      const hay = `${c.name} ${c.club} ${c.kind}`.toLocaleLowerCase("de");
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  return shown.sort((a, b) => {
    switch (filter.sort) {
      case "name":
        return a.name.localeCompare(b.name, "de") || a.club.localeCompare(b.club, "de");
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

/** Schon da? Gleiche Sammlung, gleiche Saison, gleicher Name (ohne Groß/Klein) — für den Doppelt-Hinweis. */
export function findDuplicates(
  cards: readonly Card[],
  draft: Pick<Card, "collectionId" | "season" | "name">,
  exceptId: string | null,
): Card[] {
  const name = draft.name.trim().toLocaleLowerCase("de");
  if (name === "") return [];
  return cards.filter(
    (c) =>
      c.id !== exceptId &&
      c.collectionId === draft.collectionId &&
      sameSeason(c.season, draft.season) &&
      c.name.trim().toLocaleLowerCase("de") === name,
  );
}
