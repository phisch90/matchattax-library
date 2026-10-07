/**
 * Kartenfotos vom iPhone sind 3 bis 5 MB. Bei ein paar hundert Karten wären das
 * über ein Gigabyte in der Datenbank des Browsers — und jede Sicherung ebenso groß.
 * Deshalb wird beim Aufnehmen verkleinert, nicht erst beim Sichern.
 *
 * Zwei Fassungen je Foto: eine zum Ansehen (längste Kante 1200 px, lesbar bis zum
 * Kleingedruckten) und ein kleines Bild für die Liste, das AN der Karte liegt, damit
 * die Startseite nicht für jede Kachel die Fototabelle fragen muss.
 */

export const PHOTO_MAX_PX = 1200;
export const THUMB_MAX_PX = 320;
const PHOTO_QUALITY = 0.82;
const THUMB_QUALITY = 0.75;

export interface ShrunkPhoto {
  full: Blob;
  thumb: Blob;
  width: number;
  height: number;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Bild konnte nicht geladen werden."));
    image.src = url;
  });
}

function draw(
  image: HTMLImageElement,
  maxPx: number,
  quality: number,
): Promise<{ blob: Blob; width: number; height: number }> {
  const longest = Math.max(image.naturalWidth, image.naturalHeight);
  const scale = Math.min(1, maxPx / longest);
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (context === null) return Promise.reject(new Error("Keine Zeichenfläche."));
  context.drawImage(image, 0, 0, width, height);
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

/** Wirft, wenn das Bild nicht lesbar ist — der Aufrufer sagt es ihm in einem Satz. */
export async function shrinkPhoto(file: Blob): Promise<ShrunkPhoto> {
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    const full = await draw(image, PHOTO_MAX_PX, PHOTO_QUALITY);
    const thumb = await draw(image, THUMB_MAX_PX, THUMB_QUALITY);
    return { full: full.blob, thumb: thumb.blob, width: full.width, height: full.height };
  } finally {
    URL.revokeObjectURL(url);
  }
}
