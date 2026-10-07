import Dexie, { type Table } from "dexie";
import type { Card, Collection, Team } from "../core/model.js";

/** Die Kartenzeile trägt ihr kleines Bild selbst; das große liegt in `photos`. */
export interface CardRow extends Card {
  thumb?: Blob;
}

export interface PhotoRow {
  cardId: string;
  full: Blob;
  width: number;
  height: number;
}

export interface SettingRow {
  key: string;
  value: unknown;
}

/**
 * Lokal-first: alles in IndexedDB, kein Server. Die Fotos stehen in einer eigenen
 * Tabelle, damit die Liste der Karten nicht bei jedem Öffnen Megabytes lädt.
 */
class KartenmappeDB extends Dexie {
  collections!: Table<Collection, string>;
  cards!: Table<CardRow, string>;
  photos!: Table<PhotoRow, string>;
  teams!: Table<Team, string>;
  settings!: Table<SettingRow, string>;

  constructor() {
    super("kartenmappe");
    this.version(1).stores({
      collections: "id",
      // `club` und `kind` stehen als Index, werden aber NICHT per `uniqueKeys()` gelesen:
      // Safari wirft dabei „UnknownError: Unable to open cursor" (sein iPhone, erster
      // Tag). Die Vorschläge im Formular kommen aus den geladenen Karten der Sammlung.
      cards: "id, collectionId, season, club, kind, [collectionId+season]",
      photos: "cardId",
      teams: "id, collectionId",
      settings: "key",
    });
  }
}

export const db = new KartenmappeDB();

/** Damit iOS die Daten nicht nach einer Weile ohne Nutzung aufräumt. Scheitert still. */
export async function requestPersistentStorage(): Promise<void> {
  try {
    if (navigator.storage?.persist !== undefined) await navigator.storage.persist();
  } catch {
    /* kein Anspruch darauf */
  }
}
