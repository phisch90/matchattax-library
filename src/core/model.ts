import { z } from "zod";

/**
 * Das Datenmodell — und die Regel dahinter, geerbt aus Chardex35: EIN GESPEICHERTER
 * DATENSATZ IST NIE AUF DEM STAND DES SCHEMAS. Jede Zeile, die aus der Datenbank kommt,
 * geht durch diese Parser; fehlende Felder bekommen ihren Standardwert, kaputte ihren
 * Rückfall. Wer eine Zeile roh anfasst, baut den Domänen-Fehler nach („lassen sich
 * auflisten, aber nicht auswählen").
 *
 * Gespeichert wird nur, was EINGABE ist. Summen, Aufstellungs-Plätze je Position,
 * Warnungen und Sortierungen sind Folgen und werden gerechnet (`team.ts`,
 * `collection.ts`).
 */

/** Die vier Positionen, wie sie auf der Karte stehen (Tor · Verteidigung · Mittelfeld · Angriff). */
export const POSITIONS = ["gk", "def", "mid", "att"] as const;
export type Position = (typeof POSITIONS)[number];

/**
 * Eine Zahl, die fehlen oder Unsinn sein darf: fehlt sie, gilt der Standard; ist sie kein
 * ganzzahliger Wert, gilt er ebenfalls. `.catch` NACH `.default`, damit `undefined` den
 * Standard bekommt und nicht erst als Fehler durch den Rückfall läuft.
 */
const int = (fallback: number) => z.number().int().default(fallback).catch(fallback);

export const collectionSchema = z.object({
  id: z.string().min(1),
  name: z.string().default(""),
  createdAt: z.string().default(""),
});
export type Collection = z.infer<typeof collectionSchema>;

/** Die Werte, die er von der Karte abliest — genau die Felder, die er genannt hat. */
export const cardSchema = z.object({
  id: z.string().min(1),
  collectionId: z.string().min(1),
  /** „25/26" — frei, aber `seasons.ts` bringt es in diese Form, wenn es geht. */
  season: z.string().default(""),
  name: z.string().default(""),
  club: z.string().default(""),
  position: z.enum(POSITIONS).default("mid").catch("mid"),
  att: int(0),
  def: int(0),
  /**
   * Der Kartenwert in ZEHNTEL-Millionen: 10.0M → 100. Ganzzahlig, damit elf Werte
   * ohne Fließkomma-Rest zusammenzählen (`value.ts` rechnet hin und zurück).
   */
  valueTenths: int(0),
  /** Der kleine Tor-Wert auf der Karte. Fast immer 1, bei einer hat er eine 2 gesehen. */
  goals: int(1),
  /** Kartenart: Basis, Limited Edition, … — frei, weil die Namen je Saison wechseln. */
  kind: z.string().default(""),
  /** Wie oft er diese Karte in dieser Sammlung hat. */
  qty: int(1),
  note: z.string().default(""),
  /** Liegt ein Foto in `photos`? Eine Folge der Fototabelle — steht hier nur, damit die Liste nicht nachfragen muss. */
  hasPhoto: z.boolean().default(false).catch(false),
  createdAt: z.string().default(""),
  updatedAt: z.string().default(""),
});
export type Card = z.infer<typeof cardSchema>;

/** Was man beim Anlegen eingibt: alles außer Kennung und Zeitstempeln. */
export type CardInput = Omit<Card, "id" | "createdAt" | "updatedAt" | "hasPhoto">;

export const TEAM_SIZE = 11;

/** Elf Plätze, Platz 0 ist der Torwart. Fehlt etwas oder ist es zu lang: auf elf bringen. */
function elfPlaetze(slots: readonly (string | null)[]): (string | null)[] {
  return Array.from({ length: TEAM_SIZE }, (_, i) => slots[i] ?? null);
}

export const teamSchema = z.object({
  id: z.string().min(1),
  collectionId: z.string().min(1),
  name: z.string().default(""),
  /** Schlüssel aus `formations.ts`; ein unbekannter wird dort auf den Standard gezogen. */
  formation: z.string().default("4-4-2"),
  slots: z
    .array(z.string().nullable())
    .default([])
    .catch([])
    .transform(elfPlaetze),
  /** Optional, wie er sagt: höchstens 100 Mio Mannschaftswert — als Warnung, nie als Sperre. */
  budgetOn: z.boolean().default(false).catch(false),
  createdAt: z.string().default(""),
  updatedAt: z.string().default(""),
});
export type Team = z.infer<typeof teamSchema>;

/** Geräte-Einstellungen: was die App ZEIGT, nicht was er besitzt. */
export const appSettingsSchema = z.object({
  /** Welche Sammlung gerade offen ist. */
  currentCollectionId: z.string().default(""),
  /** Wann zuletzt gesichert wurde (ISO, "" = nie). */
  lastExportAt: z.string().default(""),
  /** Nach dem Speichern gleich die nächste Karte? Sein Normalfall: Stapel abarbeiten. */
  serialMode: z.boolean().default(true).catch(true),
});
export type AppSettings = z.infer<typeof appSettingsSchema>;
export const DEFAULT_APP_SETTINGS: AppSettings = appSettingsSchema.parse({});

export const now = (): string => new Date().toISOString();
export const newId = (): string => crypto.randomUUID();
