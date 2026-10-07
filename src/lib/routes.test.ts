import { describe, expect, it } from "vitest";
import { HREF, navSection, parseRoute } from "./routes.js";

describe("Adressen", () => {
  it("liest jede Adresse, die die App selbst baut", () => {
    expect(parseRoute(HREF.sammlung)).toEqual({ kind: "sammlung" });
    expect(parseRoute("")).toEqual({ kind: "sammlung" });
    expect(parseRoute("#")).toEqual({ kind: "sammlung" });
    expect(parseRoute(HREF.karteNeu)).toEqual({ kind: "karteNeu" });
    expect(parseRoute(HREF.karte("abc-123"))).toEqual({ kind: "karte", id: "abc-123" });
    expect(parseRoute(HREF.teams)).toEqual({ kind: "teams" });
    expect(parseRoute(HREF.team("t1"))).toEqual({ kind: "team", id: "t1" });
    expect(parseRoute(HREF.einstellungen)).toEqual({ kind: "einstellungen" });
  });

  it("verträgt einen Schrägstrich am Ende und meldet Unbekanntes als solches", () => {
    expect(parseRoute("#/teams/")).toEqual({ kind: "teams" });
    expect(parseRoute("#/karte/neu/")).toEqual({ kind: "karteNeu" });
    expect(parseRoute("#/wuerfel")).toEqual({ kind: "unbekannt", path: "/wuerfel" });
    expect(parseRoute("#/karte/a/b")).toEqual({ kind: "unbekannt", path: "/karte/a/b" });
  });

  it("die Kennung übersteht die Adresse, auch mit Sonderzeichen", () => {
    const id = "x y/z";
    expect(parseRoute(HREF.karte(id))).toEqual({ kind: "karte", id });
  });

  it("der Reiter folgt der Adresse: eine Karte gehört zur Sammlung, ein Team zu den Teams", () => {
    expect(navSection(parseRoute(HREF.karte("a")))).toBe("sammlung");
    expect(navSection(parseRoute(HREF.karteNeu))).toBe("sammlung");
    expect(navSection(parseRoute(HREF.team("a")))).toBe("teams");
    expect(navSection(parseRoute(HREF.einstellungen))).toBe("einstellungen");
  });
});
