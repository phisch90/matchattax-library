/**
 * Die Karte im Foto finden — ohne Dienst, ohne Schlüssel, im Browser.
 *
 * Sein Wunsch: „kannst du die bilder automatisch beschneiden? Sodass weniger
 * Hintergrund-Rand dran ist." Der Weg: der RAND des Fotos ist der Tisch. Seine Farbe
 * wird aus dem Randstreifen geschätzt (Median je Kanal, damit eine Karte, die den
 * Rand berührt, ihn nicht verfälscht); alles, was sich davon deutlich abhebt, ist
 * Vordergrund; das größte zusammenhängende Stück davon ist die Karte. Die Schwelle
 * richtet sich nach der Unruhe des Randes selbst — Holzmaserung hebt sie an.
 *
 * Was NICHT geht, und zwar grundsätzlich: eine Karte, die dem Untergrund ähnelt
 * (helle Karte auf weißem Blatt), oder ein Foto, das die Karte schon randlos zeigt —
 * dann ist der Rand die Karte selbst, und ihr Inneres sähe aus wie das Motiv. Dafür
 * gibt es die Plausibilitätsprüfung (Seitenverhältnis einer Karte, Füllung, Größe)
 * und den Rückfall: findet sich keine Karte, bleibt das Foto, wie es ist. Nichts
 * wird falsch abgeschnitten, nur manchmal nicht abgeschnitten.
 *
 * Reine Rechnung auf Pixeln, damit sie ohne Browser prüfbar ist (`crop.test.ts`).
 */

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 63 × 88 mm: eine Karte hochkant ist 0,716 breit zu hoch; bis etwa 15° Neigung bleibt der Kasten unter 0,86. */
const PORTRAIT_MIN = 0.62;
const PORTRAIT_MAX = 0.88;
/** Mindestens so viel des Bildes muss die Karte einnehmen — sonst ist es ein Fleck, keine Karte. */
const MIN_AREA = 0.1;
/** Höchstens so viel — darüber ist nichts abzuschneiden. */
const MAX_AREA = 0.985;
/** Wie viel vom Kasten das Stück füllen muss: ein Rechteck fast ganz, eine Spinne nicht. */
const MIN_FILL = 0.45;
/** Luft um die gefundene Karte, Anteil ihrer Breite bzw. Höhe. */
const MARGIN = 0.015;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0;
}

function isCardAspect(w: number, h: number): boolean {
  const r = w / h;
  return (r >= PORTRAIT_MIN && r <= PORTRAIT_MAX) || (1 / r >= PORTRAIT_MIN && 1 / r <= PORTRAIT_MAX);
}

/**
 * Findet den Kasten der Karte in einem RGBA-Bild (wie `getImageData` es liefert),
 * oder `null`, wenn sich keine Karte plausibel abhebt. Gedacht für ein verkleinertes
 * Bild (längste Kante um 256 px); der Aufrufer rechnet den Kasten hoch.
 */
export function findCardBox(data: Uint8ClampedArray, width: number, height: number): Box | null {
  if (width < 16 || height < 16) return null;
  const ring = Math.max(2, Math.round(Math.min(width, height) * 0.04));

  // 1. Der Untergrund: Median der Randpixel je Kanal.
  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];
  const ringIndices: number[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x >= ring && x < width - ring && y >= ring && y < height - ring) continue;
      const i = (y * width + x) * 4;
      rs.push(data[i]!);
      gs.push(data[i + 1]!);
      bs.push(data[i + 2]!);
      ringIndices.push(i);
    }
  }
  const bg = [median(rs), median(gs), median(bs)] as const;
  const dist = (i: number): number =>
    Math.max(Math.abs(data[i]! - bg[0]), Math.abs(data[i + 1]! - bg[1]), Math.abs(data[i + 2]! - bg[2]));

  // 2. Die Schwelle aus der Unruhe des Randes: glatt → 28, Maserung → höher, nie über 96.
  const spread = percentile(ringIndices.map(dist), 0.9);
  const threshold = Math.min(96, Math.max(28, spread * 2 + 16));

  // 3. Vordergrund-Maske.
  const n = width * height;
  const mask = new Uint8Array(n);
  for (let p = 0; p < n; p++) if (dist(p * 4) > threshold) mask[p] = 1;

  // 4. Das größte zusammenhängende Stück (4er-Nachbarschaft), mit seinem Kasten.
  const seen = new Uint8Array(n);
  const stack = new Int32Array(n);
  let best: { count: number; x0: number; y0: number; x1: number; y1: number } | null = null;
  for (let start = 0; start < n; start++) {
    if (mask[start] === 0 || seen[start] === 1) continue;
    let top = 0;
    stack[top++] = start;
    seen[start] = 1;
    let count = 0;
    let x0 = width;
    let y0 = height;
    let x1 = -1;
    let y1 = -1;
    while (top > 0) {
      const p = stack[--top]!;
      count++;
      const x = p % width;
      const y = (p - x) / width;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      const around = [x > 0 ? p - 1 : -1, x < width - 1 ? p + 1 : -1, y > 0 ? p - width : -1, y < height - 1 ? p + width : -1];
      for (const q of around) {
        if (q < 0 || mask[q] === 0 || seen[q] === 1) continue;
        seen[q] = 1;
        stack[top++] = q;
      }
    }
    if (best === null || count > best.count) best = { count, x0, y0, x1, y1 };
  }
  if (best === null) return null;

  // 5. Ist das eine Karte? Groß genug, nicht das ganze Bild, gut gefüllt, Kartenformat.
  const bw = best.x1 - best.x0 + 1;
  const bh = best.y1 - best.y0 + 1;
  const area = (bw * bh) / n;
  if (area < MIN_AREA || area > MAX_AREA) return null;
  if (best.count / (bw * bh) < MIN_FILL) return null;
  if (!isCardAspect(bw, bh)) return null;

  // 6. Etwas Luft, im Bild gehalten.
  const mx = Math.round(bw * MARGIN);
  const my = Math.round(bh * MARGIN);
  const x = Math.max(0, best.x0 - mx);
  const y = Math.max(0, best.y0 - my);
  return { x, y, w: Math.min(width, best.x1 + 1 + mx) - x, h: Math.min(height, best.y1 + 1 + my) - y };
}

/** Den Kasten aus dem verkleinerten Bild auf das Original hochrechnen, ganzzahlig und im Bild. */
export function scaleBox(box: Box, factor: number, width: number, height: number): Box {
  const x = Math.max(0, Math.floor(box.x * factor));
  const y = Math.max(0, Math.floor(box.y * factor));
  const w = Math.min(width - x, Math.ceil(box.w * factor));
  const h = Math.min(height - y, Math.ceil(box.h * factor));
  return { x, y, w, h };
}
