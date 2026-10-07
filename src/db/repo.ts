import { DEFAULT_FORMATION, isKnownFormation } from "../core/formations.js";
import {
  DEFAULT_APP_SETTINGS,
  appSettingsSchema,
  cardSchema,
  collectionSchema,
  newId,
  now,
  teamSchema,
  type AppSettings,
  type Card,
  type CardInput,
  type Collection,
  type Team,
} from "../core/model.js";
import type { ShrunkPhoto } from "../lib/image.js";
import { db, type CardRow, type PhotoRow } from "./db.js";

/*
  JEDER Lesezugriff geht durch `hydrate…`, und JEDER Schreibzugriff, der eine Zeile
  ändert, hydriert sie VORHER (siehe `mutateCard`). Das ist die Lehre aus dem
  Domänen-Fehler: die rohe Zeile von gestern hat das neue Feld nicht, und `.some()`
  auf `undefined` wirft mitten in der Transaktion.
*/

export function hydrateCard(raw: unknown): CardRow {
  const parsed = cardSchema.parse(raw);
  const thumb = (raw as { thumb?: unknown }).thumb;
  return thumb instanceof Blob ? { ...parsed, thumb } : parsed;
}

export function hydrateTeam(raw: unknown): Team {
  const team = teamSchema.parse(raw);
  return isKnownFormation(team.formation) ? team : { ...team, formation: DEFAULT_FORMATION.key };
}

export const hydrateCollection = (raw: unknown): Collection => collectionSchema.parse(raw);

export function hydrateSettings(raw: unknown): AppSettings {
  const parsed = appSettingsSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : DEFAULT_APP_SETTINGS;
}

const SETTINGS_KEY = "app";

export const SettingsRepo = {
  async get(): Promise<AppSettings> {
    const row = await db.settings.get(SETTINGS_KEY);
    return hydrateSettings(row?.value);
  },
  async patch(patch: Partial<AppSettings>): Promise<void> {
    await db.transaction("rw", db.settings, async () => {
      const current = await SettingsRepo.get();
      await db.settings.put({ key: SETTINGS_KEY, value: { ...current, ...patch } });
    });
  },
};

/** Zwei Sammlungen von Anfang an — seine und die seines Sohnes. Umbenennen geht in den Einstellungen. */
export const DEFAULT_COLLECTION_NAMES: readonly string[] = ["Philipp", "Sohn"];

export async function ensureSeeded(): Promise<void> {
  await db.transaction("rw", db.collections, db.settings, async () => {
    if ((await db.collections.count()) > 0) return;
    /*
      Eine Millisekunde Abstand je Sammlung: sortiert wird nach `createdAt`, und bei
      GLEICHEM Stempel entschiede die zufällige Kennung — dann stünde mal „Sohn", mal
      „Philipp" vorn, und was die App im ersten Augenblick für die offene Sammlung
      hält, wäre Glückssache. Genau so ist einmal eine Karte in der falschen Sammlung
      gelandet.
    */
    const base = Date.now();
    const rows: Collection[] = DEFAULT_COLLECTION_NAMES.map((name, i) => ({
      id: newId(),
      name,
      createdAt: new Date(base + i).toISOString(),
    }));
    await db.collections.bulkAdd(rows);
    const current = await SettingsRepo.get();
    await db.settings.put({ key: SETTINGS_KEY, value: { ...current, currentCollectionId: rows[0]!.id } });
  });
}

export const CollectionRepo = {
  async list(): Promise<Collection[]> {
    return (await db.collections.toArray())
      .map(hydrateCollection)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },
  async add(name: string): Promise<string> {
    const id = newId();
    await db.collections.add({ id, name, createdAt: now() });
    return id;
  },
  async rename(id: string, name: string): Promise<void> {
    await db.transaction("rw", db.collections, async () => {
      const raw = await db.collections.get(id);
      if (raw === undefined) throw new Error(`Sammlung ${id} nicht gefunden`);
      await db.collections.put({ ...hydrateCollection(raw), name });
    });
  },
};

async function mutateCard(id: string, change: (row: CardRow) => CardRow): Promise<void> {
  const raw = await db.cards.get(id);
  if (raw === undefined) throw new Error(`Karte ${id} nicht gefunden`);
  await db.cards.put({ ...change(hydrateCard(raw)), updatedAt: now() });
}

export const CardRepo = {
  async create(input: CardInput, photo?: ShrunkPhoto): Promise<string> {
    const id = newId();
    const stamp = now();
    const row: CardRow = cardSchema.parse({
      ...input,
      id,
      createdAt: stamp,
      updatedAt: stamp,
      hasPhoto: photo !== undefined,
    });
    if (photo !== undefined) row.thumb = photo.thumb;
    await db.transaction("rw", db.cards, db.photos, async () => {
      await db.cards.add(row);
      if (photo !== undefined) await db.photos.put(photoRow(id, photo));
    });
    return id;
  },

  /**
   * Wandert die Karte in eine andere Sammlung, fliegt sie aus den Teams der alten:
   * ein Team kennt nur die Karten SEINER Sammlung, der Platz zeigte sonst ins Leere.
   */
  async update(id: string, patch: Partial<CardInput>): Promise<void> {
    await db.transaction("rw", db.cards, db.teams, async () => {
      const state = { movedFrom: null as string | null };
      await mutateCard(id, (row) => {
        if (patch.collectionId !== undefined && patch.collectionId !== row.collectionId) {
          state.movedFrom = row.collectionId;
        }
        return { ...row, ...patch };
      });
      if (state.movedFrom !== null) await stripFromTeams(id);
    });
  },

  /** Anzahl um eins hoch — der Weg bei „diese Karte hast du schon". */
  async bumpQty(id: string, delta: number): Promise<number> {
    let next = 0;
    await db.transaction("rw", db.cards, () =>
      mutateCard(id, (row) => {
        next = Math.max(0, row.qty + delta);
        return { ...row, qty: next };
      }),
    );
    return next;
  },

  async setPhoto(id: string, photo: ShrunkPhoto): Promise<void> {
    await db.transaction("rw", db.cards, db.photos, async () => {
      await db.photos.put(photoRow(id, photo));
      await mutateCard(id, (row) => ({ ...row, thumb: photo.thumb, hasPhoto: true }));
    });
  },

  async removePhoto(id: string): Promise<void> {
    await db.transaction("rw", db.cards, db.photos, async () => {
      await db.photos.delete(id);
      await mutateCard(id, (row) => {
        const { thumb: _thumb, ...rest } = row;
        return { ...rest, hasPhoto: false };
      });
    });
  },

  /** In welchen Teams steht diese Karte? Für die Löschfrage — dort steht es ihm vorher. */
  async teamsUsing(id: string): Promise<Team[]> {
    return (await db.teams.toArray()).map(hydrateTeam).filter((t) => t.slots.includes(id));
  },

  /**
   * Löschen nimmt die Karte aus den Teams HERAUS (Platz wird frei) und sagt das vorher.
   * Es gibt keinen Papierkorb — die Sicherung ist der Rückweg, und das steht daneben.
   */
  async remove(id: string): Promise<void> {
    await db.transaction("rw", db.cards, db.photos, db.teams, async () => {
      await db.cards.delete(id);
      await db.photos.delete(id);
      await stripFromTeams(id);
    });
  },
};

/** Die Karte aus jedem Team nehmen, in dem sie steht — der Platz wird frei. Läuft in der offenen Transaktion. */
async function stripFromTeams(cardId: string): Promise<void> {
  const teams = (await db.teams.toArray()).map(hydrateTeam);
  for (const team of teams) {
    if (!team.slots.includes(cardId)) continue;
    await db.teams.put({ ...team, slots: team.slots.map((s) => (s === cardId ? null : s)), updatedAt: now() });
  }
}

function photoRow(cardId: string, photo: ShrunkPhoto): PhotoRow {
  return { cardId, full: photo.full, width: photo.width, height: photo.height };
}

export const PhotoRepo = {
  get: (cardId: string): Promise<PhotoRow | undefined> => db.photos.get(cardId),
};

export const TeamRepo = {
  async create(collectionId: string, name: string): Promise<string> {
    const id = newId();
    const stamp = now();
    await db.teams.add(teamSchema.parse({ id, collectionId, name, createdAt: stamp, updatedAt: stamp }));
    return id;
  },
  async update(id: string, patch: Partial<Omit<Team, "id" | "collectionId" | "createdAt">>): Promise<void> {
    await db.transaction("rw", db.teams, async () => {
      const raw = await db.teams.get(id);
      if (raw === undefined) throw new Error(`Team ${id} nicht gefunden`);
      await db.teams.put({ ...hydrateTeam(raw), ...patch, updatedAt: now() });
    });
  },
  async remove(id: string): Promise<void> {
    await db.teams.delete(id);
  },
};

/** Alle Karten einer Sammlung, hydriert, als Karte nach Kennung. */
export function byId(cards: readonly Card[]): Map<string, Card> {
  return new Map(cards.map((c) => [c.id, c]));
}
