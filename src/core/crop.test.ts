import { describe, expect, it } from "vitest";
import { findCardBox, scaleBox } from "./crop.js";

/**
 * Ein gezeichnetes Foto: Tisch, darauf eine Karte, in der Karte ein dunkles Feld.
 * Das Rauschen ist deterministisch (kein Zufall im Test), damit ein Fehlschlag
 * reproduzierbar ist.
 */
function foto({
  width,
  height,
  table,
  card,
  cardColor,
  noise = 0,
}: {
  width: number;
  height: number;
  table: [number, number, number];
  card: { x: number; y: number; w: number; h: number } | null;
  cardColor: [number, number, number];
  noise?: number;
}): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  let seed = 7;
  const rnd = (): number => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return (seed / 2147483648) * 2 - 1;
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const inCard = card !== null && x >= card.x && x < card.x + card.w && y >= card.y && y < card.y + card.h;
      const inPanel =
        card !== null && inCard && x >= card.x + card.w * 0.15 && x < card.x + card.w * 0.85 && y >= card.y + card.h * 0.1 && y < card.y + card.h * 0.6;
      const base = inPanel ? [20, 24, 36] : inCard ? cardColor : table;
      for (let c = 0; c < 3; c++) data[i + c] = Math.max(0, Math.min(255, Math.round(base[c]! + rnd() * noise)));
      data[i + 3] = 255;
    }
  }
  return data;
}

const TISCH: [number, number, number] = [96, 64, 32];
const KARTE: [number, number, number] = [245, 158, 11];

describe("Die Karte im Foto finden", () => {
  it("findet die Karte auf einem glatten Tisch, mit etwas Luft drumherum", () => {
    const box = findCardBox(foto({ width: 140, height: 176, table: TISCH, card: { x: 30, y: 24, w: 80, h: 112 }, cardColor: KARTE }), 140, 176);
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(28);
    expect(box!.x).toBeLessThanOrEqual(30);
    expect(box!.y).toBeGreaterThanOrEqual(22);
    expect(box!.y).toBeLessThanOrEqual(24);
    expect(box!.x + box!.w).toBeGreaterThanOrEqual(110);
    expect(box!.x + box!.w).toBeLessThanOrEqual(113);
    expect(box!.y + box!.h).toBeGreaterThanOrEqual(136);
    expect(box!.y + box!.h).toBeLessThanOrEqual(140);
  });

  it("hält eine Holzmaserung aus (Rauschen am Rand hebt die Schwelle)", () => {
    const box = findCardBox(foto({ width: 140, height: 176, table: TISCH, card: { x: 30, y: 24, w: 80, h: 112 }, cardColor: KARTE, noise: 18 }), 140, 176);
    expect(box).not.toBeNull();
    expect(Math.abs(box!.x - 29)).toBeLessThanOrEqual(2);
    expect(Math.abs(box!.w - 82)).toBeLessThanOrEqual(4);
  });

  it("eine Karte quer liegt genauso gut", () => {
    const box = findCardBox(foto({ width: 176, height: 140, table: TISCH, card: { x: 24, y: 30, w: 112, h: 80 }, cardColor: KARTE }), 176, 140);
    expect(box).not.toBeNull();
    expect(box!.w).toBeGreaterThan(box!.h);
  });

  it("ohne Karte gibt es keinen Kasten — das Foto bleibt, wie es ist", () => {
    expect(findCardBox(foto({ width: 140, height: 176, table: TISCH, card: null, cardColor: KARTE, noise: 10 }), 140, 176)).toBeNull();
  });

  it("eine Karte, die sich vom Tisch nicht abhebt, wird nicht geraten", () => {
    const fast = [100, 66, 34] as [number, number, number];
    expect(findCardBox(foto({ width: 140, height: 176, table: TISCH, card: { x: 30, y: 24, w: 80, h: 112 }, cardColor: fast }), 140, 176)).toBeNull();
  });

  it("ein Fleck, der kein Kartenformat hat, wird nicht zur Karte (quadratisch, zu klein)", () => {
    expect(findCardBox(foto({ width: 140, height: 176, table: TISCH, card: { x: 40, y: 40, w: 60, h: 60 }, cardColor: KARTE }), 140, 176)).toBeNull();
    expect(findCardBox(foto({ width: 140, height: 176, table: TISCH, card: { x: 60, y: 70, w: 20, h: 28 }, cardColor: KARTE }), 140, 176)).toBeNull();
  });

  it("ein Mini-Bild wirft nicht", () => {
    expect(findCardBox(new Uint8ClampedArray(8 * 8 * 4), 8, 8)).toBeNull();
  });

  it("der Kasten wird ganzzahlig hochgerechnet und bleibt im Bild", () => {
    expect(scaleBox({ x: 10, y: 20, w: 100, h: 140 }, 5.5, 1000, 1000)).toEqual({ x: 55, y: 110, w: 550, h: 770 });
    const eng = scaleBox({ x: 10, y: 20, w: 100, h: 140 }, 10, 600, 500);
    expect(eng.x + eng.w).toBeLessThanOrEqual(600);
    expect(eng.y + eng.h).toBeLessThanOrEqual(500);
  });
});
