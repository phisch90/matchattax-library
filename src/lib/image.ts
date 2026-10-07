import { findCardBox, scaleBox, type Box } from "../core/crop.js";

/**
 * Kartenfotos vom iPhone sind 3 bis 5 MB. Bei ein paar hundert Karten wären das
 * über ein Gigabyte in der Datenbank des Browsers — und jede Sicherung ebenso groß.
 * Deshalb wird beim Aufnehmen verkleinert, nicht erst beim Sichern.
 *
 * Zwei Fassungen je Foto: eine zum Ansehen (längste Kante 900 px — bei einer Karte
 * von 63 × 88 mm sind das rund 10 Pixel je Millimeter, das Kleingedruckte bleibt
 * lesbar) und ein kleines Bild für die Liste, das AN der Karte liegt, damit die
 * Startseite nicht für jede Kachel die Fototabelle fragen muss.
 *
 * Sein Wort nach dem ersten Tag: „Bild gerne kleiner rechnen." Vorher 1200 / 320 px.
 * Fotos, die schon gespeichert sind, bleiben, wie sie sind — umgerechnet wird nur,
 * was neu hereinkommt.
 *
 * ZUSCHNEIDEN („Sodass weniger Hintergrund-Rand dran ist"): vor dem Verkleinern wird
 * die Karte gesucht (`core/crop.ts`, auf einer kleinen Kopie des Bildes) und nur
 * dieser Ausschnitt gespeichert. Findet sich keine, bleibt das ganze Foto. Beide
 * Fassungen zeigen denselben Ausschnitt.
 */

export const PHOTO_MAX_PX = 900;
export const THUMB_MAX_PX = 240;
/** Für die Kartensuche reicht ein kleines Bild — und es ist in Millisekunden gerechnet. */
const ANALYSIS_MAX_PX = 256;
const PHOTO_QUALITY = 0.78;
const THUMB_QUALITY = 0.72;

export interface ShrunkPhoto {
  full: Blob;
  thumb: Blob;
  width: number;
  height: number;
  /** Wurde auf die Karte zugeschnitten? Nur Auskunft, wird nicht gespeichert. */
  cropped: boolean;
}

export interface ShrinkOptions {
  /** Die Karte suchen und das Foto auf sie zuschneiden. */
  crop: boolean;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Bild konnte nicht geladen werden."));
    image.src = url;
  });
}

function canvasOf(width: number, height: number): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D } {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (context === null) throw new Error("Keine Zeichenfläche.");
  return { canvas, context };
}

/** Der Ausschnitt `region` des Bildes, verkleinert auf `maxPx` längste Kante, als JPEG. */
function draw(
  image: HTMLImageElement,
  region: Box,
  maxPx: number,
  quality: number,
): Promise<{ blob: Blob; width: number; height: number }> {
  const longest = Math.max(region.w, region.h);
  const scale = Math.min(1, maxPx / longest);
  const width = Math.max(1, Math.round(region.w * scale));
  const height = Math.max(1, Math.round(region.h * scale));
  const { canvas, context } = canvasOf(width, height);
  context.drawImage(image, region.x, region.y, region.w, region.h, 0, 0, width, height);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob === null) reject(new Error("Bild konnte nicht gespeichert werden."));
        else resolve({ blob, width, height });
      },
      "image/jpeg",
      quality,
    );
  });
}

/** Die Karte im Bild suchen — auf einer kleinen Kopie, das Ergebnis hochgerechnet. `null`: keine gefunden. */
function cardRegion(image: HTMLImageElement): Box | null {
  const w = image.naturalWidth;
  const h = image.naturalHeight;
  const factor = Math.max(w, h) / ANALYSIS_MAX_PX;
  const sw = Math.max(16, Math.round(w / factor));
  const sh = Math.max(16, Math.round(h / factor));
  const { canvas, context } = canvasOf(sw, sh);
  context.drawImage(image, 0, 0, sw, sh);
  const box = findCardBox(context.getImageData(0, 0, sw, sh).data, sw, sh);
  canvas.width = 0;
  return box === null ? null : scaleBox(box, w / sw, w, h);
}

/** Wirft, wenn das Bild nicht lesbar ist — der Aufrufer sagt es ihm in einem Satz. */
export async function shrinkPhoto(file: Blob, options: ShrinkOptions = { crop: false }): Promise<ShrunkPhoto> {
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    const whole: Box = { x: 0, y: 0, w: image.naturalWidth, h: image.naturalHeight };
    const found = options.crop ? cardRegion(image) : null;
    const region = found ?? whole;
    const full = await draw(image, region, PHOTO_MAX_PX, PHOTO_QUALITY);
    const thumb = await draw(image, region, THUMB_MAX_PX, THUMB_QUALITY);
    return { full: full.blob, thumb: thumb.blob, width: full.width, height: full.height, cropped: found !== null };
  } finally {
    URL.revokeObjectURL(url);
  }
}
