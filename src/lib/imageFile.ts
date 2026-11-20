/** Lecture d'une image choisie par l'utilisateur, réduite pour rester légère dans la scène. */

const ACCEPTED = /^image\/(png|jpeg|webp|gif|bmp|svg\+xml)$/;

/**
 * Lit un fichier image et renvoie une data URL PNG (côté le plus long ≤ `maxSize` px).
 * Les images restent dans le document de scène : on évite les fichiers de plusieurs Mo.
 */
export async function readImageFile(file: File, maxSize = 512): Promise<string> {
  if (!ACCEPTED.test(file.type)) throw new Error('Format d’image non pris en charge (PNG, JPEG, WebP, GIF).');
  if (file.size > 20 * 1024 * 1024) throw new Error('Image trop lourde (20 Mo au maximum).');
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Impossible de lire l’image.');
    // fond blanc : la transparence devient « clair » (pas de relief)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);
    return canvas.toDataURL('image/png');
  } finally {
    bitmap.close();
  }
}

/** Lit un fichier image en base64 brut (sans préfixe), pour l'envoyer à l'IA. */
export async function imageFileToBase64Jpeg(file: File, maxSize = 1024): Promise<{ data: string; mediaType: 'image/jpeg' }> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Impossible de lire l’image.');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const url = canvas.toDataURL('image/jpeg', 0.85);
    return { data: url.slice(url.indexOf(',') + 1), mediaType: 'image/jpeg' };
  } finally {
    bitmap.close();
  }
}
