import { describe, expect, it } from "vitest";
import { cardSchema, type Card, type Position } from "./model.js";
import {
  BUDGET_TENTHS,
  clearSlot,
  placeCard,
  sortForSlot,
  statForSlot,
  teamIssues,
  teamTotals,
} from "./team.js";

function karte(id: string, position: Position, att: number, def: number, valueTenths = 90): Card {
  return cardSchema.parse({ id, collectionId: "c", name: id, position, att, def, valueTenths });
}

const gk = karte("gk", "gk", 10, 80);
const defs = [1, 2, 3, 4].map((i) => karte(`d${i}`, "def", 30, 70));
const mids = [1, 2, 3, 4].map((i) => karte(`m${i}`, "mid", 60, 60));
const atts = [1, 2].map((i) => karte(`a${i}`, "att", 85, 30));
const alle = [gk, ...defs, ...mids, ...atts];
const byId = new Map(alle.map((c) => [c.id, c]));
const voll: (string | null)[] = ["gk", "d1", "d2", "d3", "d4", "m1", "m2", "m3", "m4", "a1", "a2"];

describe("Teamsummen", () => {
  it("zählen ATT, DEF und Wert über die belegten Plätze", () => {
    const t = teamTotals({ formation: "4-4-2", slots: voll, budgetOn: false }, byId);
    expect(t.filled).toBe(11);
    expect(t.att).toBe(10 + 4 * 30 + 4 * 60 + 2 * 85);
    expect(t.def).toBe(80 + 4 * 70 + 4 * 60 + 2 * 30);
    expect(t.valueTenths).toBe(11 * 90);
  });

  it("eine gelöschte Karte zählt nicht mit und wird gemeldet", () => {
    const slots = [...voll];
    slots[5] = "weg";
    const t = teamTotals({ formation: "4-4-2", slots, budgetOn: false }, byId);
    expect(t.filled).toBe(10);
    const issues = teamIssues({ formation: "4-4-2", slots, budgetOn: false }, byId);
    expect(issues).toContainEqual({ kind: "fehlt", slot: 5 });
  });
});

describe("Teamwarnungen — warnen, nie sperren", () => {
  it("ein volles, passendes Team hat keine", () => {
    expect(teamIssues({ formation: "4-4-2", slots: voll, budgetOn: false }, byId)).toEqual([]);
  });

  it("leere Plätze werden gezählt und stehen vorn", () => {
    const slots = [...voll];
    slots[9] = null;
    slots[10] = null;
    const issues = teamIssues({ formation: "4-4-2", slots, budgetOn: false }, byId);
    expect(issues[0]).toEqual({ kind: "leer", count: 2 });
  });

  it("ein Verteidiger im Sturm wird genannt — mit Platz, Soll und Ist", () => {
    const slots = [...voll];
    slots[10] = "d4";
    slots[4] = "a2";
    const issues = teamIssues({ formation: "4-4-2", slots, budgetOn: false }, byId);
    expect(issues).toContainEqual({ kind: "position", slot: 10, expected: "att", actual: "def", cardName: "d4" });
    expect(issues).toContainEqual({ kind: "position", slot: 4, expected: "def", actual: "att", cardName: "a2" });
  });

  it("ohne Torwart auf Platz 0 ist es eine Positions-Warnung — kein stiller Fehler", () => {
    const slots = [...voll];
    slots[0] = "m4";
    const issues = teamIssues({ formation: "4-4-2", slots, budgetOn: false }, byId);
    expect(issues.some((i) => i.kind === "position" && i.slot === 0 && i.expected === "gk")).toBe(true);
  });

  it("dieselbe Karte zweimal wird gemeldet", () => {
    const slots = [...voll];
    slots[10] = "a1";
    const issues = teamIssues({ formation: "4-4-2", slots, budgetOn: false }, byId);
    expect(issues).toContainEqual({ kind: "doppelt", cardName: "a1" });
  });

  it("das Budget warnt nur, wenn es AN ist, und nennt die Überschreitung", () => {
    // 11 × 9.5M = 104.5M
    const teuer = new Map(alle.map((c) => [c.id, { ...c, valueTenths: 95 }]));
    expect(teamIssues({ formation: "4-4-2", slots: voll, budgetOn: false }, teuer)).toEqual([]);
    expect(teamIssues({ formation: "4-4-2", slots: voll, budgetOn: true }, teuer)).toEqual([
      { kind: "budget", overTenths: 11 * 95 - BUDGET_TENTHS },
    ]);
    // Genau 100.0M ist noch erlaubt.
    const genau = new Map(alle.map((c, i) => [c.id, { ...c, valueTenths: i === 0 ? 100 : 90 }]));
    expect(teamIssues({ formation: "4-4-2", slots: voll, budgetOn: true }, genau)).toEqual([]);
  });
});

describe("Auswähler-Reihenfolge und Platzieren", () => {
  it("passende Position zuerst, darin der stärkste Wert für diesen Platz", () => {
    const stark = karte("stark", "att", 99, 10);
    const order = sortForSlot([...alle, stark], "att").map((c) => c.id);
    expect(order.slice(0, 3)).toEqual(["stark", "a1", "a2"]);
    expect(statForSlot(gk, "gk")).toBe(80);
    expect(statForSlot(mids[0]!, "mid")).toBe(120);
    const hinten = sortForSlot(alle, "def").map((c) => c.id);
    expect(hinten.slice(0, 4).every((id) => id.startsWith("d"))).toBe(true);
  });

  it("eine Karte, die schon im Team steht, TAUSCHT ihren Platz statt doppelt zu stehen", () => {
    const next = placeCard(voll, 10, "a1");
    expect(next[10]).toBe("a1");
    expect(next[9]).toBe("a2");
    expect(next.filter((s) => s === "a1").length).toBe(1);
  });

  it("auf einen leeren Platz setzen und einen Platz leeren", () => {
    const leer = clearSlot(voll, 3);
    expect(leer[3]).toBe(null);
    const wieder = placeCard(leer, 3, "d3");
    expect(wieder).toEqual(voll);
  });
});
