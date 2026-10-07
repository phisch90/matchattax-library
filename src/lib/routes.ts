/**
 * Die Adressen der App — als Raute-Pfade (`#/teams`), damit GitHub Pages nie eine
 * Datei suchen muss, die es nicht gibt. Ein Lesezeichen auf ein Team geht damit auch
 * ohne 404-Umweg auf.
 */
export type Route =
  | { kind: "sammlung" }
  | { kind: "karteNeu" }
  | { kind: "karte"; id: string }
  | { kind: "teams" }
  | { kind: "team"; id: string }
  | { kind: "einstellungen" }
  | { kind: "unbekannt"; path: string };

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#/, "").replace(/\/+$/, "") || "/";
  if (path === "/") return { kind: "sammlung" };
  if (path === "/karte/neu") return { kind: "karteNeu" };
  let m = /^\/karte\/([^/]+)$/.exec(path);
  if (m !== null) return { kind: "karte", id: decodeURIComponent(m[1]!) };
  if (path === "/teams") return { kind: "teams" };
  m = /^\/teams\/([^/]+)$/.exec(path);
  if (m !== null) return { kind: "team", id: decodeURIComponent(m[1]!) };
  if (path === "/einstellungen") return { kind: "einstellungen" };
  return { kind: "unbekannt", path };
}

export const HREF = {
  sammlung: "#/",
  karteNeu: "#/karte/neu",
  karte: (id: string): string => `#/karte/${encodeURIComponent(id)}`,
  teams: "#/teams",
  team: (id: string): string => `#/teams/${encodeURIComponent(id)}`,
  einstellungen: "#/einstellungen",
} as const;

/** Zu welchem Reiter der Hauptnavigation eine Adresse gehört. */
export function navSection(route: Route): "sammlung" | "teams" | "einstellungen" {
  switch (route.kind) {
    case "teams":
    case "team":
      return "teams";
    case "einstellungen":
      return "einstellungen";
    default:
      return "sammlung";
  }
}
