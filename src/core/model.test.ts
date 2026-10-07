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
    expect(c.number).toBe("");
    expect(c.season).toBe("");
    expect(c.qty).toBe(1);
    expect(c.valueTenths).toBe(0);
    expect(c.position).toBe("mid");
    expect(c.hasPhoto).toBe(false);
  });

  it("Unsinn in einem Feld wirft nicht, sondern fällt auf den Standard", () => {
    const c = cardSchema.parse({ id: "x", collectionId: "c", att: "stark", position: "libero", qty: 1.5 });
    expect(c.att).toBe(0);
    expect(c.position).toBe("mid");
    expect(c.qty).toBe(1);
  });

  it("die Nummer bleibt Text, mit führender Null und Buchstaben", () => {
    expect(cardSchema.parse({ id: "x", collectionId: "c", number: "007" }).number).toBe("007");
    expect(cardSchema.parse({ id: "x", collectionId: "c", number: "LE5" }).number).toBe("LE5");
  });

  it("die gestrichenen Felder (Verein, Tor-Wert, Kartenart) bleiben in einer alten Zeile stehen und fehlen in einer neuen", () => {
    const alt = cardSchema.parse({ id: "x", collectionId: "c", club: "FC Probe", goals: 2, kind: "Basis" });
    expect(alt.club).toBe("FC Probe");
    expect(alt.goals).toBe(2);
    expect(alt.kind).toBe("Basis");
    const neu = cardSchema.parse({ id: "x", collectionId: "c" });
    expect("club" in neu && neu.club !== undefined).toBe(false);
    expect(neu.goals).toBeUndefined();
    // Unsinn darin fällt weg statt zu werfen.
    expect(cardSchema.parse({ id: "x", collectionId: "c", goals: "zwei" }).goals).toBeUndefined();
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

  it("Einstellungen: fehlendes Feld heißt Standard, ein gestrichener Schalter stört nicht", () => {
    const s = appSettingsSchema.parse({});
    expect(s.currentCollectionId).toBe("");
    expect(s.lastExportAt).toBe("");
    // Zuschneiden ist AN, auch wenn das Feld auf dem Gerät noch fehlt; Unsinn fällt auf AN.
    expect(s.autoCrop).toBe(true);
    expect(appSettingsSchema.parse({ autoCrop: "nein" }).autoCrop).toBe(true);
    expect(appSettingsSchema.parse({ autoCrop: false }).autoCrop).toBe(false);
    // `serialMode` lag auf seinem Gerät — ein unbekannter Schlüssel wird abgestreift, nicht beanstandet.
    const alt = appSettingsSchema.parse({ serialMode: true, currentCollectionId: "a" });
    expect(alt.currentCollectionId).toBe("a");
    expect("serialMode" in alt).toBe(false);
  });
});
