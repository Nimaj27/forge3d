/**
 * Image en relief : logo (seuil → contours → extrusion) ou photo (carte de hauteur / lithophane).
 * Le décodage de l'image est injecté (worker : OffscreenCanvas ; tests : sharp).
 */
import type { CrossSection, Manifold, ManifoldToplevel, Vec2 as MVec2 } from 'manifold-3d';
import type { ImageParams } from '../../shared/scene';
import { Arena } from './cache';

/** Image en niveaux de gris (0 = noir, 255 = blanc), ligne 0 en haut. */
export interface GrayImage {
  width: number;
  height: number;
  data: Uint8Array;
}

export type ImageDecoder = (src: string, maxSize: number) => Promise<GrayImage>;

/** Nombre maximal de pixels sur le grand côté (compromis finesse / temps de calcul). */
export const MAX_IMAGE_PX = 220;

/** Pixels « allumés » (relief) d'un logo par seuil. */
export function thresholdMask(img: GrayImage, threshold: number, invert: boolean): Uint8Array {
  const mask = new Uint8Array(img.width * img.height);
  for (let i = 0; i < mask.length; i++) {
    const dark = img.data[i] < threshold;
    mask[i] = (invert ? !dark : dark) ? 1 : 0;
  }
  return mask;
}

/**
 * Masque → rectangles (plages horizontales fusionnées verticalement), en mm, y vers le haut,
 * centrés sur l'origine.
 */
export function maskRectangles(mask: Uint8Array, w: number, h: number, pixel: number): MVec2[][] {
  const rects: MVec2[][] = [];
  const open = new Map<string, { x0: number; x1: number; y0: number }>();
  const ox = (-w * pixel) / 2;
  const oy = (h * pixel) / 2;
  const emit = (r: { x0: number; x1: number; y0: number }, y1: number) => {
    const xa = ox + r.x0 * pixel;
    const xb = ox + r.x1 * pixel;
    const ya = oy - y1 * pixel;
    const yb = oy - r.y0 * pixel;
    rects.push([
      [xa, ya],
      [xb, ya],
      [xb, yb],
      [xa, yb],
    ]);
  };
  for (let y = 0; y <= h; y++) {
    const runs = new Set<string>();
    if (y < h) {
      let x = 0;
      while (x < w) {
        if (!mask[y * w + x]) {
          x++;
          continue;
        }
        const x0 = x;
        while (x < w && mask[y * w + x]) x++;
        const key = `${x0}:${x}`;
        runs.add(key);
        if (!open.has(key)) open.set(key, { x0, x1: x, y0: y });
      }
    }
    for (const [key, r] of open) {
      if (!runs.has(key)) {
        emit(r, y);
        open.delete(key);
      }
    }
  }
  return rects;
}

export function logoCrossSection(wasm: ManifoldToplevel, img: GrayImage, p: ImageParams, arena: Arena): CrossSection | null {
  const pixel = p.width / img.width;
  const rects = maskRectangles(thresholdMask(img, p.threshold, p.invert), img.width, img.height, pixel);
  if (!rects.length) return null;
  let cs = arena.track(new wasm.CrossSection(rects, 'NonZero'));
  // lissage des marches d'escalier et suppression des détails < 0,4 mm
  const smooth = Math.min(0.2, pixel * 0.45);
  cs = arena.track(cs.offset(-smooth, 'Round', 2, 12));
  cs = arena.track(cs.offset(smooth * 2, 'Round', 2, 12));
  cs = arena.track(cs.offset(-smooth, 'Round', 2, 12));
  cs = arena.track(cs.simplify(pixel * 0.1));
  return cs.isEmpty() ? null : cs;
}

/**
 * Carte de hauteur : solide fermé (dessus = image, dessous plat), centré sur l'origine.
 * Sombre = épais (lithophane) ; `invert` inverse.
 */
export function heightmapMesh(wasm: ManifoldToplevel, img: GrayImage, p: ImageParams): Manifold {
  const nx = img.width;
  const ny = img.height;
  const pixel = p.width / Math.max(1, nx - 1);
  const ox = -((nx - 1) * pixel) / 2;
  const oy = ((ny - 1) * pixel) / 2;
  const minH = Math.max(0.2, p.minHeight);
  const maxH = Math.max(minH + 0.1, p.maxHeight);
  const pos = new Float32Array(nx * ny * 2 * 3);
  for (let y = 0; y < ny; y++)
    for (let x = 0; x < nx; x++) {
      const g = img.data[y * nx + x] / 255;
      const t = p.invert ? g : 1 - g;
      const i = y * nx + x;
      const px = ox + x * pixel;
      const py = oy - y * pixel;
      pos.set([px, py, minH + (maxH - minH) * t], i * 3);
      pos.set([px, py, 0], (nx * ny + i) * 3);
    }
  const tris: number[] = [];
  const T = (x: number, y: number) => y * nx + x;
  const B = (x: number, y: number) => nx * ny + y * nx + x;
  for (let y = 0; y < ny - 1; y++)
    for (let x = 0; x < nx - 1; x++) {
      // dessus (normale +z) : y croissant vers le bas de l'image → sens adapté
      tris.push(T(x, y), T(x, y + 1), T(x + 1, y + 1), T(x, y), T(x + 1, y + 1), T(x + 1, y));
      // dessous (normale −z)
      tris.push(B(x, y), B(x + 1, y + 1), B(x, y + 1), B(x, y), B(x + 1, y), B(x + 1, y + 1));
    }
  // côtés
  for (let x = 0; x < nx - 1; x++) {
    // bord haut de l'image (y = 0, côté +Y monde)
    tris.push(T(x, 0), T(x + 1, 0), B(x + 1, 0), T(x, 0), B(x + 1, 0), B(x, 0));
    // bord bas (y = ny − 1, côté −Y)
    const yb = ny - 1;
    tris.push(T(x, yb), B(x + 1, yb), T(x + 1, yb), T(x, yb), B(x, yb), B(x + 1, yb));
  }
  for (let y = 0; y < ny - 1; y++) {
    // bord gauche (x = 0, côté −X)
    tris.push(T(0, y), B(0, y + 1), T(0, y + 1), T(0, y), B(0, y), B(0, y + 1));
    // bord droit (x = nx − 1, côté +X)
    const xr = nx - 1;
    tris.push(T(xr, y), T(xr, y + 1), B(xr, y + 1), T(xr, y), B(xr, y + 1), B(xr, y));
  }
  const mesh = new wasm.Mesh({ numProp: 3, vertProperties: pos, triVerts: new Uint32Array(tris) });
  mesh.merge();
  return wasm.Manifold.ofMesh(mesh);
}

export async function buildImage(wasm: ManifoldToplevel, decode: ImageDecoder | undefined, p: ImageParams, warnings: string[]): Promise<Manifold | null> {
  if (!decode) {
    warnings.push('Image : décodage indisponible.');
    return null;
  }
  let img: GrayImage;
  try {
    img = await decode(p.src, p.mode === 'heightmap' ? 160 : MAX_IMAGE_PX);
  } catch {
    warnings.push('Image illisible.');
    return null;
  }
  if (img.width < 2 || img.height < 2) return null;
  if (p.mode === 'heightmap') return heightmapMesh(wasm, img, p);
  const arena = new Arena();
  try {
    const cs = logoCrossSection(wasm, img, p, arena);
    if (!cs) {
      warnings.push('Image : aucun motif détecté avec ce seuil.');
      return null;
    }
    return cs.extrude(p.maxHeight);
  } finally {
    arena.dispose();
  }
}
