import { describe, expect, it } from "vitest";
import { appSettingsSchema, cardSchema, teamSchema } from "./model.js";

/**
 * Die erste Fehlerfamilie aus Chardex35, hier von vorn bedacht: eine gespeicherte
 * Zeile ist nie auf dem Stand des Schemas. Jeder Parser muss mit einer Zeile von
 * gestern UND mit Unsinn zurechtkommen, ohne zu werfen.
 */
describe("Parser gegen alte und kaputte Zeilen", () => {
  it("eine Karte von gestern bekommt alle neuen Felder mit Standardwert", () => {
    const c = cardSchema.parse({ id: "x", collectionId: "c", name: "Müller" });
    expect(c.goals).toBe(1);
    expect(c.qty).toBe(1);
    expect(c.valueTenths).toBe(0);
    expect(c.position).toBe("mid");
    expect(c.hasPhoto).toBe(false);
  });

  it("Unsinn in einem Feld wirft nicht, sondern fällt auf den Standard", () => {
    const c = cardSchema.parse({ id: "x", collectionId: "c", att: "stark", position: "libero", qty: 1.5, goals: null });
    expect(c.att).toBe(0);
    expect(c.position).toBe("mid");
    expect(c.qty).toBe(1);
    expect(c.goals).toBe(1);
  });

  it("ohne Kennung gibt es keine Karte — das ist der eine Fall, der werfen soll", () => {
    expect(() => cardSchema.parse({ collectionId: "c" })).toThrow();
  });

  it("ein Team hat immer elf Plätze, egal was gespeichert war", () => {
    expect(teamSchema.parse({ id: "t", collectionId: "c" }).slots).toHaveLength(11);
    expect(teamSchema.parse({ id: "t", collectionId: "c", slots: ["a", null, "b"] }).slots[2]).toBe("b");
    expect(teamSchema.parse({ id: "t", collectionId: "c", slots: Array(15).fill("z") }).slots).toHaveLength(11);
    expect(teamSchema.parse({ id: "t", collectionId: "c", slots: "kaputt" }).slots).toHaveLength(11);
  });

  it("Einstellungen: fehlendes Feld heißt Standard, Serienmodus ist an", () => {
    const s = appSettingsSchema.parse({});
    expect(s.serialMode).toBe(true);
    expect(s.currentCollectionId).toBe("");
    expect(appSettingsSchema.parse({ serialMode: "nein" }).serialMode).toBe(true);
  });
});
