import { TEAM_SIZE, type Position } from "./model.js";

/**
 * Die Aufstellungen. Seine Regel: „Auswahl einer realistischen Formation. Also kein
 * (1-)0-0-10 sondern (1-)4-3-3 oder so. Immer ein Torwart."
 *
 * Deshalb ist die Aufstellung eine WAHL aus dieser Liste und keine drei Zahlenfelder:
 * drei Felder könnten 0-0-10 — und der Torwart steht nicht in der Liste, weil er
 * nicht wählbar ist. Jede Aufstellung hat genau einen, immer auf Platz 0.
 *
 * Die Karten kennen nur drei Feldpositionen (VER · MIT · ANG); ein 4-2-3-1 ist für
 * die App deshalb ein 4-5-1 — fünf Mittelfeldkarten.
 */
export interface Formation {
  readonly key: string;
  readonly def: number;
  readonly mid: number;
  readonly att: number;
}

export const FORMATIONS: readonly Formation[] = [
  { key: "4-4-2", def: 4, mid: 4, att: 2 },
  { key: "4-3-3", def: 4, mid: 3, att: 3 },
  { key: "4-5-1", def: 4, mid: 5, att: 1 },
  { key: "3-5-2", def: 3, mid: 5, att: 2 },
  { key: "3-4-3", def: 3, mid: 4, att: 3 },
  { key: "5-3-2", def: 5, mid: 3, att: 2 },
  { key: "5-4-1", def: 5, mid: 4, att: 1 },
];

export const DEFAULT_FORMATION: Formation = FORMATIONS[0]!;

/** Unbekannter Schlüssel (alter Stand, Tippfehler in einer Sicherung) → Standard. */
export function formationOf(key: string): Formation {
  return FORMATIONS.find((f) => f.key === key) ?? DEFAULT_FORMATION;
}

export function isKnownFormation(key: string): boolean {
  return FORMATIONS.some((f) => f.key === key);
}

/** Welche Position jeder der elf Plätze verlangt: Tor, dann Verteidigung, Mittelfeld, Angriff. */
export function slotPositions(formation: Formation): Position[] {
  const rep = (p: Position, n: number): Position[] => Array.from({ length: n }, () => p);
  return ["gk", ...rep("def", formation.def), ...rep("mid", formation.mid), ...rep("att", formation.att)];
}

/**
 * Aufstellung wechseln, ohne die Karten zu verlieren: jede Karte bleibt auf ihrer
 * LINIE (eine Verteidiger-Karte wandert auf einen Verteidiger-Platz). Was keinen
 * Platz mehr findet, wird GENANNT statt still verworfen — bei 4-4-2 → 4-3-3 fliegt
 * ein Mittelfeldspieler, und das soll er lesen, nicht suchen.
 */
export function reslot(
  slots: readonly (string | null)[],
  from: Formation,
  to: Formation,
): { slots: (string | null)[]; dropped: string[] } {
  const fromPos = slotPositions(from);
  const toPos = slotPositions(to);
  const pools: Record<Position, string[]> = { gk: [], def: [], mid: [], att: [] };
  for (let i = 0; i < TEAM_SIZE; i++) {
    const id = slots[i];
    if (id !== null && id !== undefined) pools[fromPos[i]!].push(id);
  }
  const next = toPos.map((p) => pools[p].shift() ?? null);
  const dropped = [...pools.gk, ...pools.def, ...pools.mid, ...pools.att];
  return { slots: next, dropped };
}
