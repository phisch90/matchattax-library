import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { DEFAULT_APP_SETTINGS, type AppSettings, type Collection, type Team } from "../core/model.js";
import { db, type CardRow } from "../db/db.js";
import { SettingsRepo, hydrateCard, hydrateCollection, hydrateTeam } from "../db/repo.js";
import { guardWrite } from "./saveError.js";

export function useAppSettings(): AppSettings {
  return useLiveQuery(() => SettingsRepo.get(), [], DEFAULT_APP_SETTINGS);
}

export interface CollectionsState {
  collections: Collection[];
  /** Die offene Sammlung — oder die erste, wenn die gemerkte nicht (mehr) da ist. */
  current: Collection | null;
  setCurrent: (id: string) => void;
  loaded: boolean;
}

export function useCollections(): CollectionsState {
  const rows = useLiveQuery(() => db.collections.toArray(), []);
  /*
    OHNE Standardwert, mit Absicht: `current` darf erst stehen, wenn die Einstellungen
    WIRKLICH gelesen sind. Vorher hieße „noch nicht geladen" dasselbe wie „nichts
    gemerkt", und die App hielte für einen Augenblick die erste Sammlung für die offene
    — lange genug, dass ein Formular seinen Entwurf dort anlegt.
  */
  const settings = useLiveQuery(() => SettingsRepo.get(), []);
  const collections = useMemo(
    () =>
      (rows ?? [])
        .map(hydrateCollection)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.name.localeCompare(b.name, "de")),
    [rows],
  );
  const loaded = rows !== undefined && settings !== undefined;
  const current = loaded
    ? (collections.find((c) => c.id === settings.currentCollectionId) ?? collections[0] ?? null)
    : null;
  const setCurrent = (id: string): void => {
    void guardWrite(() => SettingsRepo.patch({ currentCollectionId: id }), "Die Auswahl der Sammlung");
  };
  return { collections, current, setCurrent, loaded };
}

/**
 * Alle Karten einer Sammlung, hydriert. `undefined`, solange sie laden — AUCH solange
 * die Sammlung selbst noch nicht bekannt ist. Eine leere Liste in dieser Phase hieße
 * „Noch keine Karten", und das stünde für einen Augenblick an jeder vollen Sammlung.
 */
export function useCards(collectionId: string | null | undefined): CardRow[] | undefined {
  const rows = useLiveQuery<CardRow[] | undefined>(
    () =>
      collectionId === null || collectionId === undefined
        ? Promise.resolve(undefined)
        : db.cards.where("collectionId").equals(collectionId).toArray(),
    [collectionId],
  );
  return useMemo(() => rows?.map(hydrateCard), [rows]);
}

export function useTeams(collectionId: string | null | undefined): Team[] | undefined {
  const rows = useLiveQuery<Team[] | undefined>(
    () =>
      collectionId === null || collectionId === undefined
        ? Promise.resolve(undefined)
        : db.teams.where("collectionId").equals(collectionId).toArray(),
    [collectionId],
  );
  return useMemo(
    () => rows?.map(hydrateTeam).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [rows],
  );
}

/**
 * Ein Schalter, der SOFORT umspringt und den Datenbankstand nachzieht, sobald er da ist.
 *
 * Ein Kästchen, das direkt an der Datenbank hängt, springt für einen Augenblick zurück:
 * React rendert den alten Wert, bis der Schreibvorgang durch ist und die Abfrage neu
 * meldet. Am Handy ist das ein Flackern, in der Prüfung ein „did not change its state".
 */
export function useMirror<T>(value: T): [T, (next: T) => void] {
  const [local, setLocal] = useState(value);
  useEffect(() => {
    setLocal(value);
  }, [value]);
  return [local, setLocal];
}

/** Eine Adresse für ein Blob — und sie wird wieder freigegeben, sonst läuft der Speicher voll. */
export function useObjectUrl(blob: Blob | undefined): string | undefined {
  const [url, setUrl] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (blob === undefined) {
      setUrl(undefined);
      return;
    }
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob]);
  return url;
}
