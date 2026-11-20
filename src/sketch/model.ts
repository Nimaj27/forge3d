/**
 * Modèle éditable du croquis 2D : formes (chemins, cercles, rectangles arrondis, polygones)
 * converties en contours fermés `Loop` de la Scène.
 */
import { newId, type Loop, type Segment, type Vec2 } from '../../shared/scene';
import { loopToPolygon } from '../geometry/curves';

export type PathSeg = { t: 'line' } | { t: 'arc'; bulge: number } | { t: 'curve' } | { t: 'bezier'; c1: Vec2; c2: Vec2 };

export type SketchShape =
  /** Chemin fermé : le segment i va de points[i] à points[i + 1] (le dernier revient au premier) */
  | { id: string; kind: 'path'; points: Vec2[]; segs: PathSeg[] }
  | { id: string; kind: 'circle'; c: Vec2; r: number }
  | { id: string; kind: 'rect'; c: Vec2; w: number; h: number; r: number }
  | { id: string; kind: 'polygon'; c: Vec2; r: number; n: number; rot: number };

/** tan(90°/4) : bulge d'un quart de cercle */
export const QUARTER_BULGE = Math.tan(Math.PI / 8);

const r6 = (v: number) => Math.round(v * 1e6) / 1e6;

/** Points de contrôle d'une courbe lisse (Catmull-Rom) entre p1 et p2. */
export function smoothControls(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2): [Vec2, Vec2] {
  return [
    [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6],
    [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6],
  ];
}

/** Forme → contour fermé de la Scène. */
export function shapeToLoop(s: SketchShape): Loop {
  switch (s.kind) {
    case 'circle':
      return {
        start: [s.c[0] + s.r, s.c[1]],
        segments: [
          { type: 'arc', to: [s.c[0] - s.r, s.c[1]], bulge: 1 },
          { type: 'arc', to: [s.c[0] + s.r, s.c[1]], bulge: 1 },
        ],
      };
    case 'rect': {
      const hw = s.w / 2;
      const hh = s.h / 2;
      const r = Math.max(0, Math.min(s.r, hw - 1e-3, hh - 1e-3));
      const [cx, cy] = s.c;
      if (r <= 1e-3)
        return {
          start: [cx - hw, cy - hh],
          segments: [
            { type: 'line', to: [cx + hw, cy - hh] },
            { type: 'line', to: [cx + hw, cy + hh] },
            { type: 'line', to: [cx - hw, cy + hh] },
            { type: 'line', to: [cx - hw, cy - hh] },
          ],
        };
      const segs: Segment[] = [
        { type: 'line', to: [cx + hw - r, cy - hh] },
        { type: 'arc', to: [cx + hw, cy - hh + r], bulge: QUARTER_BULGE },
        { type: 'line', to: [cx + hw, cy + hh - r] },
        { type: 'arc', to: [cx + hw - r, cy + hh], bulge: QUARTER_BULGE },
        { type: 'line', to: [cx - hw + r, cy + hh] },
        { type: 'arc', to: [cx - hw, cy + hh - r], bulge: QUARTER_BULGE },
        { type: 'line', to: [cx - hw, cy - hh + r] },
        { type: 'arc', to: [cx - hw + r, cy - hh], bulge: QUARTER_BULGE },
      ];
      return { start: [cx - hw + r, cy - hh], segments: segs };
    }
    case 'polygon': {
      const pts = polygonPoints(s);
      return { start: pts[0], segments: pts.slice(1).concat([pts[0]]).map((to) => ({ type: 'line' as const, to })) };
    }
    case 'path': {
      const n = s.points.length;
      const segments: Segment[] = s.segs.map((seg, i) => {
        const a = s.points[i];
        const b = s.points[(i + 1) % n];
        switch (seg.t) {
          case 'line':
            return { type: 'line', to: b };
          case 'arc':
            return { type: 'arc', to: b, bulge: seg.bulge };
          case 'bezier':
            return { type: 'bezier', c1: seg.c1, c2: seg.c2, to: b };
          case 'curve': {
            const [c1, c2] = smoothControls(s.points[(i - 1 + n) % n], a, b, s.points[(i + 2) % n]);
            return { type: 'bezier', c1, c2, to: b };
          }
        }
      });
      return { start: s.points[0], segments };
    }
  }
}

export function polygonPoints(s: Extract<SketchShape, { kind: 'polygon' }>): Vec2[] {
  const n = Math.max(3, Math.round(s.n));
  const pts: Vec2[] = [];
  for (let i = 0; i < n; i++) {
    const a = ((s.rot + 90) * Math.PI) / 180 + (2 * Math.PI * i) / n;
    pts.push([r6(s.c[0] + s.r * Math.cos(a)), r6(s.c[1] + s.r * Math.sin(a))]);
  }
  return pts;
}

/** Contour de la Scène → chemin éditable. */
export function loopToShape(loop: Loop): SketchShape {
  const points: Vec2[] = [loop.start];
  const segs: PathSeg[] = [];
  loop.segments.forEach((seg, i) => {
    if (seg.type === 'line') segs.push({ t: 'line' });
    else if (seg.type === 'arc') segs.push({ t: 'arc', bulge: seg.bulge });
    else segs.push({ t: 'bezier', c1: seg.c1, c2: seg.c2 });
    if (i < loop.segments.length - 1) points.push(seg.to);
  });
  // si le dernier segment ne revient pas exactement au départ, on ajoute le point
  const last = loop.segments[loop.segments.length - 1]?.to;
  if (last && (Math.abs(last[0] - loop.start[0]) > 1e-6 || Math.abs(last[1] - loop.start[1]) > 1e-6)) {
    points.push(last);
    segs.push({ t: 'line' });
  }
  return { id: newId('s'), kind: 'path', points, segs };
}

/** Polygone aplati d'une forme (affichage, aire, tests de clic). */
export function shapePolygon(s: SketchShape, tol = 0.02): Vec2[] {
  return loopToPolygon(shapeToLoop(s), tol);
}

export function shapeBounds(shapes: readonly SketchShape[]): { min: Vec2; max: Vec2 } | null {
  let min: Vec2 | null = null;
  let max: Vec2 | null = null;
  for (const s of shapes)
    for (const [x, y] of shapePolygon(s, 0.05)) {
      min = min ? [Math.min(min[0], x), Math.min(min[1], y)] : [x, y];
      max = max ? [Math.max(max[0], x), Math.max(max[1], y)] : [x, y];
    }
  return min && max ? { min, max } : null;
}

/** Point dans le polygone (règle pair-impair). */
export function pointInPolygon([x, y]: Vec2, poly: readonly Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Distance d'un point à un polygone fermé (contour). */
export function distanceToPolygon(p: Vec2, poly: readonly Vec2[]): number {
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
    best = Math.min(best, Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy)));
  }
  return best;
}

// ---------------------------------------------------------------------------
// Arcs : poignée du milieu ↔ bulge
// ---------------------------------------------------------------------------

/** Position de la poignée au milieu d'un segment (sommet de l'arc pour un arc). */
export function segmentHandle(a: Vec2, b: Vec2, bulge: number): Vec2 {
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  const c = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const ln: Vec2 = [-(b[1] - a[1]) / c, (b[0] - a[0]) / c];
  const s = (c / 2) * bulge;
  return [mx - ln[0] * s, my - ln[1] * s];
}

/** Bulge correspondant à une poignée déplacée en `h`. */
export function bulgeFromHandle(a: Vec2, b: Vec2, h: Vec2): number {
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  const c = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const ln: Vec2 = [-(b[1] - a[1]) / c, (b[0] - a[0]) / c];
  const s = -((h[0] - mx) * ln[0] + (h[1] - my) * ln[1]);
  const bulge = (2 * s) / c;
  return Math.max(-20, Math.min(20, bulge));
}

// ---------------------------------------------------------------------------
// Symétrie (axe vertical x = 0)
// ---------------------------------------------------------------------------

function mirrorSeg(seg: PathSeg): PathSeg {
  if (seg.t === 'arc') return { t: 'arc', bulge: seg.bulge };
  if (seg.t === 'bezier') return { t: 'bezier', c1: [-seg.c2[0], seg.c2[1]], c2: [-seg.c1[0], seg.c1[1]] };
  return seg;
}

/** Copie miroir d'une forme (x → −x), orientation conservée. */
export function mirrorShape(s: SketchShape): SketchShape {
  switch (s.kind) {
    case 'circle':
    case 'rect':
      return { ...s, id: newId('s'), c: [-s.c[0], s.c[1]] };
    case 'polygon':
      return { ...s, id: newId('s'), c: [-s.c[0], s.c[1]], rot: -s.rot };
    case 'path': {
      // inverser l'ordre pour garder le sens de parcours après le miroir
      const n = s.points.length;
      const points = s.points.map(([x, y]) => [-x, y] as Vec2).reverse();
      const segs: PathSeg[] = [];
      for (let k = 0; k < n; k++) {
        // le segment k du chemin inversé correspond au segment (n − 2 − k) mod n de l'original
        const orig = s.segs[(n - 2 - k + n) % n];
        segs.push(mirrorSeg(orig));
      }
      return { id: newId('s'), kind: 'path', points, segs };
    }
  }
}

const ON_AXIS = 0.01;

/**
 * Symétrie : un chemin qui s'appuie sur l'axe (au moins deux points à x = 0) est complété
 * en une seule forme symétrique ; sinon on ajoute une copie miroir.
 */
export function symmetrize(s: SketchShape): SketchShape[] {
  if (s.kind !== 'path') return [s, mirrorShape(s)];
  const n = s.points.length;
  const axis = s.points.map((p, i) => (Math.abs(p[0]) < ON_AXIS ? i : -1)).filter((i) => i >= 0);
  if (axis.length < 2) return [s, mirrorShape(s)];
  // Cherche deux points d'axe consécutifs (dans l'ordre cyclique) séparant la moitié dessinée.
  for (let k = 0; k < axis.length; k++) {
    const a = axis[k];
    const b = axis[(k + 1) % axis.length];
    // chaîne a → b
    const chain: number[] = [];
    for (let i = a; ; i = (i + 1) % n) {
      chain.push(i);
      if (i === b && chain.length > 1) break;
      if (chain.length > n + 1) break;
    }
    const interior = chain.slice(1, -1);
    if (!interior.length || interior.some((i) => Math.abs(s.points[i][0]) < ON_AXIS)) continue;
    const side = Math.sign(s.points[interior[0]][0]);
    if (interior.some((i) => Math.sign(s.points[i][0]) !== side)) continue;
    // nouvelle forme : a → … → b (moitié), puis miroir b → … → a
    const points: Vec2[] = chain.map((i) => [i === a || i === b ? 0 : s.points[i][0], s.points[i][1]] as Vec2);
    const segs: PathSeg[] = chain.slice(0, -1).map((i) => s.segs[i]);
    const back = [...chain].reverse(); // b … a
    for (let j = 0; j < back.length - 1; j++) {
      const from = back[j];
      const to = back[j + 1];
      // segment original (to → from) parcouru à l'envers dans le miroir : bulge inchangé, contrôles échangés
      const orig = s.segs[to];
      const mirrored: PathSeg =
        orig.t === 'bezier' ? { t: 'bezier', c1: [-orig.c2[0], orig.c2[1]], c2: [-orig.c1[0], orig.c1[1]] } : orig;
      if (j < back.length - 2) points.push([-s.points[to][0], s.points[to][1]]);
      segs.push(mirrored);
      void from;
    }
    return [{ id: s.id, kind: 'path', points, segs }];
  }
  return [s, mirrorShape(s)];
}

// ---------------------------------------------------------------------------
// Mesures
// ---------------------------------------------------------------------------

/** Longueur d'un segment de chemin (approximation par aplatissement pour les courbes). */
export function segmentLength(s: Extract<SketchShape, { kind: 'path' }>, i: number): number {
  const loop = shapeToLoop(s);
  const a = i === 0 ? loop.start : loop.segments[i - 1].to;
  const seg = loop.segments[i];
  const pts = loopToPolygon({ start: a, segments: [seg, { type: 'line', to: a }] }, 0.01);
  let len = 0;
  // la dernière arête (retour) est exclue
  for (let k = 0; k < pts.length - 1; k++) len += Math.hypot(pts[k + 1][0] - pts[k][0], pts[k + 1][1] - pts[k][1]);
  return len;
}

/** Nombre de contours d'un ensemble de formes. */
export function describeShapes(shapes: readonly SketchShape[]): string {
  if (!shapes.length) return 'aucun contour';
  return shapes.length === 1 ? 'contour fermé' : `${shapes.length} contours fermés`;
}
