import { describe, expect, it } from "vitest";
import { DEFAULT_FILTER, filterCards, findDuplicates, nameSuggestions, summarize } from "./collection.js";
import { cardSchema, type Card } from "./model.js";

function k(over: Partial<Card> & { id: string }): Card {
  return cardSchema.parse({ collectionId: "c", season: "25/26", ...over });
}

const cards = [
  k({ id: "a", name: "Müller", number: "101", position: "att", att: 90, def: 20, valueTenths: 120, createdAt: "2026-01-01" }),
  k({ id: "b", name: "Neuer", number: "001", position: "gk", att: 10, def: 95, valueTenths: 80, createdAt: "2026-01-03" }),
  k({ id: "c", name: "Alaba", number: "045", position: "def", att: 40, def: 85, valueTenths: 100, season: "2025/26", createdAt: "2026-01-02", qty: 3 }),
  k({ id: "d", name: "Kimmich", number: "101", position: "mid", att: 70, def: 70, valueTenths: 110, season: "26/27", createdAt: "2026-01-04" }),
];

describe("Filtern und Sortieren", () => {
  it("neueste zuerst ist der Standard", () => {
    expect(filterCards(cards, DEFAULT_FILTER).map((c) => c.id)).toEqual(["d", "b", "c", "a"]);
  });

  it("Saison-Filter kennt 2025/26 und 25/26 als dieselbe", () => {
    expect(filterCards(cards, { ...DEFAULT_FILTER, season: "25/26" }).map((c) => c.id).sort()).toEqual(["a", "b", "c"]);
  });

  it("Position, Suche über Name und Nummer, Sortierung nach Wert", () => {
    expect(filterCards(cards, { ...DEFAULT_FILTER, position: "gk" }).map((c) => c.id)).toEqual(["b"]);
    expect(filterCards(cards, { ...DEFAULT_FILTER, query: "101", sort: "value" }).map((c) => c.id)).toEqual(["a", "d"]);
    expect(filterCards(cards, { ...DEFAULT_FILTER, query: "MÜLL" }).map((c) => c.id)).toEqual(["a"]);
    expect(filterCards(cards, { ...DEFAULT_FILTER, sort: "def" })[0]?.id).toBe("b");
    expect(filterCards(cards, { ...DEFAULT_FILTER, sort: "name" })[0]?.id).toBe("c");
  });
});

describe("Zusammenzählen", () => {
  it("Karten, Stück und je Position", () => {
    const s = summarize(cards);
    expect(s.cards).toBe(4);
    expect(s.pieces).toBe(6);
    expect(s.byPosition).toEqual({ gk: 1, def: 1, mid: 1, att: 1 });
  });
});

describe("Doppelt-Hinweis", () => {
  it("die Nummer ist die Kennung: gleiche Sammlung, gleiche Saison, gleiche Nummer — der Name ist dann egal", () => {
    expect(findDuplicates(cards, { collectionId: "c", season: "2025/26", number: "101", name: "irgendwer" }, null).map((c) => c.id)).toEqual(["a"]);
    // Dieselbe Nummer in einer anderen Saison ist eine andere Karte.
    expect(findDuplicates(cards, { collectionId: "c", season: "26/27", number: "101", name: "" }, null).map((c) => c.id)).toEqual(["d"]);
    expect(findDuplicates(cards, { collectionId: "sohn", season: "25/26", number: "101", name: "" }, null)).toEqual([]);
    expect(findDuplicates(cards, { collectionId: "c", season: "25/26", number: "101", name: "" }, "a")).toEqual([]);
  });

  it("ohne Nummer zählt der Name, ohne Groß/Klein; ohne beides gibt es keinen Treffer", () => {
    expect(findDuplicates(cards, { collectionId: "c", season: "25/26", number: "", name: " müller " }, null).map((c) => c.id)).toEqual(["a"]);
    expect(findDuplicates(cards, { collectionId: "c", season: "25/26", number: "", name: "Müller" }, "a")).toEqual([]);
    expect(findDuplicates(cards, { collectionId: "c", season: "25/26", number: "", name: "" }, null)).toEqual([]);
  });
});

describe("Namensvorschläge", () => {
  const namen = [
    { name: "Harry Kane" },
    { name: "Joshua Kimmich" },
    { name: "Jamal Musiala" },
    { name: "kimmich" },
    { name: "" },
    { name: "Kane" },
  ];

  it("J zeigt alle Namen mit J, ohne Groß/Klein, jeden einmal, alphabetisch", () => {
    expect(nameSuggestions(namen, "j", 8)).toEqual(["Jamal Musiala", "Joshua Kimmich"]);
  });

  it("trifft auch den Anfang eines Wortes im Namen — Kane findet Harry Kane", () => {
    expect(nameSuggestions(namen, "Ka", 8)).toEqual(["Harry Kane", "Kane"]);
    expect(nameSuggestions(namen, "kim", 8)).toEqual(["Joshua Kimmich", "kimmich"]);
  });

  it("nichts getippt heißt nichts vorgeschlagen, und die Grenze gilt", () => {
    expect(nameSuggestions(namen, "  ", 8)).toEqual([]);
    expect(nameSuggestions(namen, "k", 1)).toHaveLength(1);
  });
});
