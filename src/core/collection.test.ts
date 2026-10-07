import { describe, expect, it } from "vitest";
import { DEFAULT_FILTER, filterCards, findDuplicates, summarize } from "./collection.js";
import { cardSchema, type Card } from "./model.js";

function k(over: Partial<Card> & { id: string }): Card {
  return cardSchema.parse({ collectionId: "c", season: "25/26", ...over });
}

const cards = [
  k({ id: "a", name: "Müller", club: "FC Probe", position: "att", att: 90, def: 20, valueTenths: 120, createdAt: "2026-01-01" }),
  k({ id: "b", name: "Neuer", club: "FC Probe", position: "gk", att: 10, def: 95, valueTenths: 80, createdAt: "2026-01-03" }),
  k({ id: "c", name: "Alaba", club: "Real", position: "def", att: 40, def: 85, valueTenths: 100, season: "2025/26", createdAt: "2026-01-02", qty: 3 }),
  k({ id: "d", name: "Kimmich", club: "FC Probe", position: "mid", att: 70, def: 70, valueTenths: 110, season: "26/27", createdAt: "2026-01-04" }),
];

describe("Filtern und Sortieren", () => {
  it("neueste zuerst ist der Standard", () => {
    expect(filterCards(cards, DEFAULT_FILTER).map((c) => c.id)).toEqual(["d", "b", "c", "a"]);
  });

  it("Saison-Filter kennt 2025/26 und 25/26 als dieselbe", () => {
    expect(filterCards(cards, { ...DEFAULT_FILTER, season: "25/26" }).map((c) => c.id).sort()).toEqual(["a", "b", "c"]);
  });

  it("Position, Suche über Name und Verein, Sortierung nach Wert", () => {
    expect(filterCards(cards, { ...DEFAULT_FILTER, position: "gk" }).map((c) => c.id)).toEqual(["b"]);
    expect(filterCards(cards, { ...DEFAULT_FILTER, query: "probe", sort: "value" }).map((c) => c.id)).toEqual(["a", "d", "b"]);
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
  it("findet dieselbe Karte in derselben Sammlung und Saison, nicht sich selbst, nicht andere Saisons", () => {
    expect(findDuplicates(cards, { collectionId: "c", season: "2025/26", name: " müller " }, null).map((c) => c.id)).toEqual(["a"]);
    expect(findDuplicates(cards, { collectionId: "c", season: "25/26", name: "Müller" }, "a")).toEqual([]);
    expect(findDuplicates(cards, { collectionId: "c", season: "26/27", name: "Müller" }, null)).toEqual([]);
    expect(findDuplicates(cards, { collectionId: "sohn", season: "25/26", name: "Müller" }, null)).toEqual([]);
    expect(findDuplicates(cards, { collectionId: "c", season: "25/26", name: "" }, null)).toEqual([]);
  });
});
