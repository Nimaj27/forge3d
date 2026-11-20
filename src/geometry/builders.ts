/**
 * Constructeurs asynchrones (texte, SVG, image) branchés sur le moteur.
 * Complétés aux jalons J3 (texte, SVG) et J4 (image en relief).
 */
import type { PrimitiveBuilders } from './primitives';

export interface BuilderDeps {
  /** Charge un fichier de police TTF (nom de fichier dans public/fonts) */
  loadFont: (file: string) => Promise<ArrayBuffer>;
}

export function createBuilders(_deps: BuilderDeps): PrimitiveBuilders {
  return {};
}
