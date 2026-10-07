import { describe, expect, it } from "vitest";
import { TEAM_SIZE, teamSchema } from "./model.js";
import {
  DEFAULT_FORMATION,
  FORMATIONS,
  formationOf,
  isKnownFormation,
  reslot,
  slotPositions,
} from "./formations.js";

describe("Aufstellungen", () => {
  it("sind realistisch: 3 bis 5 hinten, 3 bis 5 in der Mitte, 1 bis 3 vorn, zehn Feldspieler", () => {
    expect(FORMATIONS.length).toBeGreaterThanOrEqual(5);
    for (const f of FORMATIONS) {
      expect(f.def + f.mid + f.att, f.key).toBe(TEAM_SIZE - 1);
      expect(f.def, f.key).toBeGreaterThanOrEqual(3);
      expect(f.def, f.key).toBeLessThanOrEqual(5);
      expect(f.mid, f.key).toBeGreaterThanOrEqual(3);
      expect(f.mid, f.key).toBeLessThanOrEqual(5);
      expect(f.att, f.key).toBeGreaterThanOrEqual(1);
      expect(f.att, f.key).toBeLessThanOrEqual(3);
      // Der Schlüssel SAGT die Zahlen — kein 4-4-2, das in Wahrheit 4-3-3 ist.
      expect(f.key).toBe(`${f.def}-${f.mid}-${f.att}`);
    }
    expect(new Set(FORMATIONS.map((f) => f.key)).size).toBe(FORMATIONS.length);
  });

  it("jede Aufstellung hat genau einen Torwart, und zwar auf Platz 0", () => {
    for (const f of FORMATIONS) {
      const pos = slotPositions(f);
      expect(pos.length).toBe(TEAM_SIZE);
      expect(pos[0]).toBe("gk");
      expect(pos.filter((p) => p === "gk").length).toBe(1);
      expect(pos.filter((p) => p === "def").length).toBe(f.def);
      expect(pos.filter((p) => p === "mid").length).toBe(f.mid);
      expect(pos.filter((p) => p === "att").length).toBe(f.att);
    }
  });

  it("der Standard des Schemas ist eine bekannte Aufstellung — sonst zöge jedes neue Team ins Leere", () => {
    const parsed = teamSchema.parse({ id: "t", collectionId: "c" });
    expect(isKnownFormation(parsed.formation)).toBe(true);
    expect(formationOf(parsed.formation)).toBe(DEFAULT_FORMATION);
    expect(formationOf("0-0-10")).toBe(DEFAULT_FORMATION);
    expect(parsed.slots.length).toBe(TEAM_SIZE);
  });

  it("beim Wechsel bleiben die Karten auf ihrer Linie, und wer rausfliegt, wird genannt", () => {
    const f442 = formationOf("4-4-2");
    const f433 = formationOf("4-3-3");
    const slots = ["gk1", "d1", "d2", "d3", "d4", "m1", "m2", "m3", "m4", "a1", "a2"];
    const r = reslot(slots, f442, f433);
    expect(r.slots).toEqual(["gk1", "d1", "d2", "d3", "d4", "m1", "m2", "m3", "a1", "a2", null]);
    expect(r.dropped).toEqual(["m4"]);

    // Zurück nach 4-4-2: nichts fliegt, der freie Platz bleibt frei.
    const back = reslot(r.slots, f433, f442);
    expect(back.dropped).toEqual([]);
    expect(back.slots.filter((s) => s !== null).length).toBe(10);
  });

  it("verträgt zu kurze Plätze-Listen aus alten Ständen", () => {
    const r = reslot(["gk1", "d1"], formationOf("4-4-2"), formationOf("3-5-2"));
    expect(r.slots.length).toBe(TEAM_SIZE);
    expect(r.slots[0]).toBe("gk1");
    expect(r.slots[1]).toBe("d1");
    expect(r.dropped).toEqual([]);
  });
});
