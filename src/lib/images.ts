/**
 * Compression côté client avant stockage.
 *
 * Tant que la persistance est locale, chaque image consomme le quota du
 * navigateur (~5 Mo au total). Une photo de téléphone brute fait 3 à 8 Mo :
 * sans cette étape, le vision board casserait l'application au deuxième ajout.
 */

const MAX_EDGE = 1200;
const QUALITY = 0.72;

export const MAX_IMAGE_BYTES = 700_000;

export async function compressImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Ce fichier n'est pas une image.");
  }

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (context === null) throw new Error("Impossible de préparer l'image.");

  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const encoded = canvas.toDataURL("image/jpeg", QUALITY);

  if (encoded.length > MAX_IMAGE_BYTES) {
    throw new Error(
      "Image trop lourde même après compression. Choisis-en une plus petite.",
    );
  }

  return encoded;
}

export function approximateSize(state: unknown): number {
  try {
    return JSON.stringify(state).length;
  } catch {
    return 0;
  }
}
