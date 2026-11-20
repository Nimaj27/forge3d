/**
 * Vérifications avant impression (brief §5), dans l'orientation d'impression.
 */
import type { Manifold } from 'manifold-3d';
import type { Vec3 } from '../../shared/scene';
import { mm } from '../lib/format';
import { Arena } from './cache';
import { isPrintable } from './meshCheck';
import type { Bounds, CheckItem, MeshValidation } from './types';

/** Seuils de détection. */
export const OVERHANG_COS = Math.cos((45 * Math.PI) / 180); // surplomb > 45° par rapport à la verticale
const OVERHANG_MIN_CLEARANCE = 2.5; // mm : en dessous, le slicer fait un pont / petit porte-à-faux
const OVERHANG_MIN_AREA = 60; // mm²
const THIN_HALF_WIDTH = 0.2; // érosion de 0,2 mm → détails < 0,4 mm
/** Une zone fine d'un seul tenant au-delà de cette aire est signalée (les pointes de lettres, plus petites, sont ignorées). */
const THIN_MIN_FEATURE_AREA = 0.6; // mm²

/** Contrôle « tient sur le plateau » avec suggestions de correction. */
export function checkBed(size: Vec3, bed: Vec3): CheckItem {
  const fits = (s: Vec3) => s[0] <= bed[0] + 1e-6 && s[1] <= bed[1] + 1e-6 && s[2] <= bed[2] + 1e-6;
  const bedLabel = `${mm(bed[0], 0)}`;
  if (fits(size)) return { id: 'bed', level: 'ok', message: `Tient sur le plateau (${bedLabel})` };
  const rotated: Vec3 = [size[1], size[0], size[2]];
  if (fits(rotated))
    return {
      id: 'bed',
      level: 'error',
      message: 'Ne tient pas sur le plateau',
      detail: 'Elle tiendrait en la faisant pivoter de 90°.',
      fix: 'rotate90',
    };
  const sorted = [...size].sort((a, b) => b - a);
  const flat: Vec3 = [sorted[0], sorted[1], sorted[2]];
  if (fits(flat) || fits([flat[1], flat[0], flat[2]]))
    return {
      id: 'bed',
      level: 'error',
      message: 'Ne tient pas sur le plateau',
      detail: 'Elle tiendrait couchée à plat.',
      fix: 'layFlat',
    };
  return {
    id: 'bed',
    level: 'error',
    message: 'Ne tient pas sur le plateau',
    detail: `Dimensions ${size.map((v) => mm(v, 0)).join(' × ')} pour un volume de ${bed.map((v) => mm(v, 0)).join(' × ')}.`,
  };
}

export function checkManifold(v: MeshValidation | null): CheckItem {
  if (!v || v.triangleCount === 0) return { id: 'manifold', level: 'error', message: 'Pièce vide : rien à imprimer' };
  if (isPrintable(v)) return { id: 'manifold', level: 'ok', message: 'Maillage étanche, 1 seul bloc' };
  const problems: string[] = [];
  if (v.nonManifoldEdges) problems.push(`${v.nonManifoldEdges} arête(s) non-manifold`);
  if (v.degenerateTriangles) problems.push(`${v.degenerateTriangles} triangle(s) dégénéré(s)`);
  if (v.components > 1) problems.push(`${v.components} blocs séparés`);
  const onlyBlocks = !v.nonManifoldEdges && !v.degenerateTriangles;
  return {
    id: 'manifold',
    level: onlyBlocks ? 'warn' : 'error',
    message: onlyBlocks ? `Maillage étanche, mais ${v.components} blocs séparés` : 'Maillage à corriger',
    detail: problems.join(', ') + '.',
  };
}

export function checkFlat(bounds: Bounds): CheckItem {
  const z = bounds.min[2];
  if (Math.abs(z) <= 0.01) return { id: 'flat', level: 'ok', message: 'Posée à plat sur le plateau' };
  return {
    id: 'flat',
    level: 'warn',
    message: z > 0 ? `Ne touche pas le plateau (z min = ${mm(z, 2)})` : `Passe sous le plateau (z min = ${mm(z, 2)})`,
    fix: 'dropToBed',
  };
}

/**
 * Surplombs > 45° : faces tournées vers le bas, sauf celles qui reposent presque
 * sur une autre partie (petits porte-à-faux, bas des lettres en relief…).
 */
export function measureOverhangs(m: Manifold, positions: Float32Array, indices: Uint32Array): { area: number; maxZ: number } {
  let area = 0;
  let maxZ = 0;
  const triCount = indices.length / 3;
  // Échantillonnage : au plus ~4000 rayons.
  const candidates: number[] = [];
  const areas: number[] = [];
  for (let t = 0; t < triCount; t++) {
    const a = indices[t * 3] * 3;
    const b = indices[t * 3 + 1] * 3;
    const c = indices[t * 3 + 2] * 3;
    const ux = positions[b] - positions[a];
    const uy = positions[b + 1] - positions[a + 1];
    const uz = positions[b + 2] - positions[a + 2];
    const vx = positions[c] - positions[a];
    const vy = positions[c + 1] - positions[a + 1];
    const vz = positions[c + 2] - positions[a + 2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz);
    if (len < 1e-12) continue;
    if (nz / len >= -OVERHANG_COS) continue;
    const minZ = Math.min(positions[a + 2], positions[b + 2], positions[c + 2]);
    if (minZ < 0.05) continue; // posée sur le plateau
    candidates.push(t);
    areas.push(len / 2);
  }
  if (!candidates.length) return { area: 0, maxZ: 0 };
  const step = Math.max(1, Math.ceil(candidates.length / 4000));
  for (let i = 0; i < candidates.length; i += step) {
    const t = candidates[i];
    const a = indices[t * 3] * 3;
    const b = indices[t * 3 + 1] * 3;
    const c = indices[t * 3 + 2] * 3;
    const cx = (positions[a] + positions[b] + positions[c]) / 3;
    const cy = (positions[a + 1] + positions[b + 1] + positions[c + 1]) / 3;
    const cz = (positions[a + 2] + positions[b + 2] + positions[c + 2]) / 3;
    const hits = m.rayCast([cx, cy, cz - 0.02], [cx, cy, -1]);
    let clearance = cz;
    for (const h of hits) if (h.distance > 0.001) clearance = Math.min(clearance, h.distance + 0.02);
    if (clearance > OVERHANG_MIN_CLEARANCE) {
      // compense l'échantillonnage
      let w = 0;
      for (let k = i; k < Math.min(i + step, candidates.length); k++) w += areas[k];
      area += w;
      maxZ = Math.max(maxZ, cz);
    }
  }
  return { area, maxZ };
}

export function checkOverhang(area: number, maxZ: number): CheckItem {
  if (area < OVERHANG_MIN_AREA) return { id: 'overhang', level: 'ok', message: 'Aucun support nécessaire' };
  return {
    id: 'overhang',
    level: 'warn',
    message: 'Surplombs de plus de 45° : supports probablement nécessaires',
    detail: `Environ ${Math.round(area)} mm² en surplomb, jusqu’à ${mm(maxZ, 1)} de hauteur.`,
  };
}

/** Détails plus fins que 0,4 mm : ouverture morphologique de tranches horizontales. */
export function findThinZ(m: Manifold, bounds: Bounds, maxSlices = 30): number[] {
  const height = bounds.max[2] - bounds.min[2];
  if (height <= 0) return [];
  const n = Math.max(1, Math.min(maxSlices, Math.ceil(height / 0.8)));
  const out: number[] = [];
  const arena = new Arena();
  try {
    for (let i = 0; i < n; i++) {
      const z = bounds.min[2] + ((i + 0.5) * height) / n;
      const cs = arena.track(m.slice(z));
      const area = cs.area();
      if (area < 0.01) continue;
      const eroded = arena.track(cs.offset(-THIN_HALF_WIDTH, 'Round', 2, 16));
      const opened = arena.track(eroded.offset(THIN_HALF_WIDTH, 'Round', 2, 16));
      if (area - opened.area() < THIN_MIN_FEATURE_AREA) continue;
      // parties qui disparaissent, une par une : seules les zones fines étendues comptent
      const lost = arena.track(cs.subtract(opened));
      const pieces = lost.decompose();
      let significant = false;
      for (const piece of pieces) {
        if (piece.area() > THIN_MIN_FEATURE_AREA) significant = true;
        piece.delete();
      }
      if (significant) out.push(Math.round(z * 10) / 10);
    }
  } finally {
    arena.dispose();
  }
  return out;
}

export function checkThin(thinZ: number[], size: Vec3): CheckItem {
  const minDim = Math.min(...size);
  if (minDim < 0.4)
    return { id: 'thin', level: 'warn', message: 'Pièce plus fine que 0,4 mm', detail: 'Elle risque de ne pas s’imprimer.' };
  if (!thinZ.length) return { id: 'thin', level: 'ok', message: 'Pas de détail plus fin que 0,4 mm' };
  return {
    id: 'thin',
    level: 'warn',
    message: 'Détails plus fins que 0,4 mm',
    detail: `Vers ${thinZ.slice(0, 4).map((z) => mm(z, 1)).join(', ')}${thinZ.length > 4 ? '…' : ''} : ils risquent de disparaître.`,
  };
}
