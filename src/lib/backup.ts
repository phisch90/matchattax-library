import { z } from "zod";
import { cardSchema, collectionSchema, teamSchema } from "../core/model.js";
import { db, type CardRow } from "../db/db.js";
import { SettingsRepo, hydrateCard, hydrateCollection, hydrateTeam } from "../db/repo.js";
import { S } from "../strings.js";
import { shrinkPhoto } from "./image.js";

/**
 * Die Sicherung: EINE JSON-Datei mit allem, auch den Fotos (als Data-URLs, wenn er
 * es will). Sie ist der einzige Rückweg — es gibt keinen Server und keinen
 * Papierkorb. Deshalb steht in den Einstellungen, wann zuletzt gesichert wurde.
 */

export const BACKUP_APP = "kartenmappe";
export const BACKUP_FORMAT = 1;

const backupCardSchema = cardSchema.extend({
  photo: z.string().optional(),
  thumb: z.string().optional(),
});

export const backupSchema = z.object({
  app: z.literal(BACKUP_APP),
  formatVersion: z.number().int().min(1),
  exportedAt: z.string().default(""),
  collections: z.array(collectionSchema).default([]),
  cards: z.array(backupCardSchema).default([]),
  teams: z.array(teamSchema).default([]),
});
export type Backup = z.infer<typeof backupSchema>;

export function parseBackup(text: string): Backup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error(S.settings.importBroken);
  }
  const parsed = backupSchema.safeParse(raw);
  if (!parsed.success) throw new Error(S.settings.importBroken);
  return parsed.data;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Foto konnte nicht gelesen werden."));
    reader.readAsDataURL(blob);
  });
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob();
}

export async function buildBackup(withPhotos: boolean): Promise<string> {
  const collections = (await db.collections.toArray()).map(hydrateCollection);
  const rows = (await db.cards.toArray()).map(hydrateCard);
  const teams = (await db.teams.toArray()).map(hydrateTeam);

  const cards: Backup["cards"] = [];
  for (const row of rows) {
    const { thumb, ...card } = row;
    const entry: Backup["cards"][number] = { ...card };
    if (withPhotos && card.hasPhoto) {
      const photo = await db.photos.get(card.id);
      if (photo !== undefined) entry.photo = await blobToDataUrl(photo.full);
      if (thumb !== undefined) entry.thumb = await blobToDataUrl(thumb);
    }
    if (!withPhotos) entry.hasPhoto = false;
    cards.push(entry);
  }

  const backup: Backup = {
    app: BACKUP_APP,
    formatVersion: BACKUP_FORMAT,
    exportedAt: new Date().toISOString(),
    collections,
    cards,
    teams,
  };
  return JSON.stringify(backup);
}

export interface ImportCounts {
  collections: number;
  cards: number;
  teams: number;
}

/**
 * Einlesen heißt ÜBERSCHREIBEN gleicher Kennungen, nie löschen. Eine Karte, die
 * in der Sicherung kein Foto hat, verliert hier keines: ihr vorhandenes Foto bleibt.
 */
export async function applyBackup(backup: Backup): Promise<ImportCounts> {
  // Fotos VOR der Transaktion in Blobs wandeln — `fetch` und die Zeichenfläche
  // dürfen nicht in eine laufende IndexedDB-Transaktion (sie liefe aus).
  const prepared: { row: CardRow; full: Blob | null; width: number; height: number }[] = [];
  for (const entry of backup.cards) {
    const { photo, thumb, ...card } = entry;
    let full: Blob | null = null;
    let thumbBlob: Blob | null = null;
    let width = 0;
    let height = 0;
    if (photo !== undefined) {
      full = await dataUrlToBlob(photo);
      if (thumb !== undefined) thumbBlob = await dataUrlToBlob(thumb);
      try {
        const shrunk = await shrinkPhoto(full);
        width = shrunk.width;
        height = shrunk.height;
        if (thumbBlob === null) thumbBlob = shrunk.thumb;
      } catch {
        /* Maße bleiben 0, das Foto bleibt trotzdem */
      }
    }
    const row: CardRow = { ...card, hasPhoto: full !== null || card.hasPhoto };
    if (thumbBlob !== null) row.thumb = thumbBlob;
    prepared.push({ row, full, width, height });
  }

  await db.transaction("rw", db.collections, db.cards, db.photos, db.teams, async () => {
    for (const c of backup.collections) await db.collections.put(c);
    for (const { row, full, width, height } of prepared) {
      const existing = await db.cards.get(row.id);
      const existingThumb = existing?.thumb;
      if (row.thumb === undefined && existingThumb instanceof Blob && row.hasPhoto) row.thumb = existingThumb;
      if (full === null && existing !== undefined && existing.hasPhoto) row.hasPhoto = true;
      await db.cards.put(row);
      if (full !== null) await db.photos.put({ cardId: row.id, full, width, height });
    }
    for (const t of backup.teams) await db.teams.put(t);
  });

  return { collections: backup.collections.length, cards: backup.cards.length, teams: backup.teams.length };
}

export function backupFilename(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `kartenmappe-sicherung-${y}-${m}-${d}.json`;
}

export function downloadText(text: string, filename: string): void {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export async function exportAndRemember(withPhotos: boolean): Promise<void> {
  const text = await buildBackup(withPhotos);
  downloadText(text, backupFilename());
  await SettingsRepo.patch({ lastExportAt: new Date().toISOString() });
}
