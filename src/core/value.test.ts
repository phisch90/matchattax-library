import { describe, expect, it } from "vitest";
import { formatValue, parseValueTenths, valueInputText } from "./value.js";

describe("Kartenwert in Zehnteln", () => {
  it("liest den Aufdruck mit Punkt, Komma, mit und ohne M", () => {
    expect(parseValueTenths("10.0M")).toBe(100);
    expect(parseValueTenths("10,5")).toBe(105);
    expect(parseValueTenths(" 7 ")).toBe(70);
    expect(parseValueTenths("0.5m")).toBe(5);
    expect(parseValueTenths("12.")).toBe(120);
  });

  it("gibt null für Leeres oder Unsinn — ein leeres Feld ist kein Wert 0", () => {
    expect(parseValueTenths("")).toBe(null);
    expect(parseValueTenths("abc")).toBe(null);
    expect(parseValueTenths("-3")).toBe(null);
    expect(parseValueTenths("1.2.3")).toBe(null);
  });

  it("zeigt wie die Karte: Punkt und M, immer eine Nachkommastelle", () => {
    expect(formatValue(100)).toBe("10.0M");
    expect(formatValue(105)).toBe("10.5M");
    expect(formatValue(5)).toBe("0.5M");
    expect(formatValue(0)).toBe("0.0M");
  });

  it("Eingabetext und Anzeige sind dieselbe Zahl", () => {
    for (const tenths of [0, 5, 100, 105, 999]) {
      expect(parseValueTenths(valueInputText(tenths))).toBe(tenths);
    }
  });
});
