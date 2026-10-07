import { describe, expect, it } from "vitest";
import { BACKUP_APP, BACKUP_FORMAT, backupFilename, parseBackup } from "./backup.js";

describe("Sicherungsformat", () => {
  const gueltig = {
    app: BACKUP_APP,
    formatVersion: BACKUP_FORMAT,
    exportedAt: "2026-10-06T10:00:00.000Z",
    collections: [{ id: "c1", name: "Philipp", createdAt: "" }],
    cards: [{ id: "k1", collectionId: "c1", name: "Müller", position: "att", att: 90, def: 20, valueTenths: 100 }],
    teams: [{ id: "t1", collectionId: "c1", name: "Team 1", formation: "4-3-3", slots: ["k1"] }],
  };

  it("liest eine gültige Sicherung und füllt Standardwerte nach", () => {
    const b = parseBackup(JSON.stringify(gueltig));
    expect(b.cards[0]?.number).toBe("");
    expect(b.cards[0]?.qty).toBe(1);
    expect(b.teams[0]?.slots).toHaveLength(11);
    expect(b.teams[0]?.slots[0]).toBe("k1");
  });

  it("lehnt fremde Dateien und kaputtes JSON mit demselben Satz ab", () => {
    expect(() => parseBackup("{ kaputt")).toThrow(/keine Sicherung/);
    expect(() => parseBackup(JSON.stringify({ ...gueltig, app: "chardex35" }))).toThrow(/keine Sicherung/);
    expect(() => parseBackup("[]")).toThrow(/keine Sicherung/);
  });

  it("eine Karte ohne Kennung macht die ganze Sicherung ungültig — halb einlesen wäre schlimmer", () => {
    const ohneId = { ...gueltig, cards: [{ collectionId: "c1", name: "x" }] };
    expect(() => parseBackup(JSON.stringify(ohneId))).toThrow();
  });

  it("der Dateiname trägt das Datum", () => {
    expect(backupFilename(new Date(2026, 9, 6))).toBe("kartenmappe-sicherung-2026-10-06.json");
  });
});
