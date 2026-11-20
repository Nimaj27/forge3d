/**
 * Calcul des pauses de couleur (imprimante mono-buse, brief §5).
 *
 * Les sommets de couche valent `firstLayerHeight + k × layerHeight` (k ≥ 0).
 * Pour un changement de couleur à Zc, la pause se fait au plus petit sommet
 * de couche strictement supérieur à Zc.
 */
export function pauseHeight(zc: number, firstLayerHeight: number, layerHeight: number): number {
  if (zc < firstLayerHeight - 1e-9) return round(firstLayerHeight);
  const q = (zc - firstLayerHeight) / layerHeight;
  // Tolérance : 8,0 doit être reconnu comme sommet de couche malgré les arrondis flottants.
  const k = Math.floor(q + 1e-6) + 1;
  return round(firstLayerHeight + k * layerHeight);
}

/** Pauses triées et dédoublonnées pour une liste de changements. */
export function pauseHeights(changes: readonly number[] | undefined, firstLayerHeight: number, layerHeight: number): number[] {
  if (!changes?.length) return [];
  const set = new Set(changes.map((z) => pauseHeight(z, firstLayerHeight, layerHeight)));
  return [...set].sort((a, b) => a - b);
}

/** Tranche de couleur : [from, to] en mm (to = Infinity pour la dernière). */
export interface ColorBand {
  color: string;
  /** Hauteur du bas de la première couche de cette couleur */
  from: number;
  /** Sommet de la dernière couche de cette couleur */
  to: number;
  /** Hauteur de la pause qui démarre cette couleur (sommet de sa première couche) */
  pauseAt?: number;
}

/**
 * Tranches de couleur d'une pièce : couleurs explicites, sinon alternance des filaments.
 * `breaks` sont les hauteurs de pause (déjà calculées).
 */
export function colorBands(breaks: readonly number[], layerHeight: number, colors: readonly string[] | undefined, filaments: readonly string[]): ColorBand[] {
  const bands: ColorBand[] = [];
  const pick = (i: number) => colors?.[i] ?? filaments[i % filaments.length] ?? '#9A9DA2';
  let from = 0;
  for (let i = 0; i <= breaks.length; i++) {
    const pauseAt = i > 0 ? breaks[i - 1] : undefined;
    const to = i < breaks.length ? round(breaks[i] - layerHeight) : Number.POSITIVE_INFINITY;
    bands.push({ color: pick(i), from, to, pauseAt });
    if (i < breaks.length) from = round(breaks[i] - layerHeight);
  }
  return bands;
}

function round(v: number): number {
  return Math.round(v * 1e4) / 1e4;
}
