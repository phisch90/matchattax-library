import { describe, expect, it } from "vitest";
import {
  CURRENT_SEASONS,
  normalizeSeason,
  seasonChoices,
  seasonStartYear,
  sortSeasonsDesc,
} from "./seasons.js";

describe("Saisons", () => {
  it("bringt die üblichen Schreibweisen auf 25/26", () => {
    expect(normalizeSeason("25/26")).toBe("25/26");
    expect(normalizeSeason("2025/26")).toBe("25/26");
    expect(normalizeSeason("2025/2026")).toBe("25/26");
    expect(normalizeSeason("25-26")).toBe("25/26");
    expect(normalizeSeason(" 25 / 26 ")).toBe("25/26");
    expect(normalizeSeason("09/10")).toBe("09/10");
  });

  it("lehnt ab, was keine zwei aufeinanderfolgenden Jahre sind", () => {
    expect(normalizeSeason("25/27")).toBe(null);
    expect(normalizeSeason("Herbst")).toBe(null);
    expect(normalizeSeason("")).toBe(null);
  });

  it("sortiert neueste zuerst, doppelte raus, Unlesbares hinten", () => {
    expect(sortSeasonsDesc(["25/26", "2026/27", "24/25", "26/27", "Sondersatz", ""])).toEqual([
      "26/27",
      "25/26",
      "24/25",
      "Sondersatz",
    ]);
  });

  it("die aktuellen Saisons stehen immer zur Wahl — auch in einer leeren Sammlung", () => {
    expect(seasonChoices([])).toEqual([...CURRENT_SEASONS]);
    expect(seasonChoices(["23/24"])).toEqual(["26/27", "25/26", "23/24"]);
    expect(seasonStartYear("26/27")).toBe(2026);
    expect(seasonStartYear("Herbst")).toBe(null);
  });
});
