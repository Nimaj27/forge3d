/** Aplatissement des courbes (Bézier, arcs) en polylignes, et utilitaires de polygones. */
import type { Loop, Vec2 } from '../../shared/scene';

/** Tolérance d'aplatissement par défaut (écart maximal à la courbe, en mm). */
export const DEFAULT_TOLERANCE = 0.02;

const MAX_STEPS = 128;

function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

/** Bézier cubique → points (sans le point de départ). */
export function flattenCubic(p0: Vec2, c1: Vec2, c2: Vec2, p3: Vec2, tol = DEFAULT_TOLERANCE, out: Vec2[] = []): Vec2[] {
  const ddx = Math.max(Math.abs(p0[0] - 2 * c1[0] + c2[0]), Math.abs(c1[0] - 2 * c2[0] + p3[0]));
  const ddy = Math.max(Math.abs(p0[1] - 2 * c1[1] + c2[1]), Math.abs(c1[1] - 2 * c2[1] + p3[1]));
  const m = Math.hypot(ddx, ddy);
  const n = Math.min(MAX_STEPS, Math.max(1, Math.ceil(Math.sqrt((0.75 * m) / tol))));
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    const a = u * u * u;
    const b = 3 * u * u * t;
    const c = 3 * u * t * t;
    const d = t * t * t;
    out.push([a * p0[0] + b * c1[0] + c * c2[0] + d * p3[0], a * p0[1] + b * c1[1] + c * c2[1] + d * p3[1]]);
  }
  return out;
}

/** Bézier quadratique → points (sans le point de départ). */
export function flattenQuad(p0: Vec2, c: Vec2, p1: Vec2, tol = DEFAULT_TOLERANCE, out: Vec2[] = []): Vec2[] {
  const m = Math.hypot(p0[0] - 2 * c[0] + p1[0], p0[1] - 2 * c[1] + p1[1]);
  const n = Math.min(MAX_STEPS, Math.max(1, Math.ceil(Math.sqrt((0.25 * m) / tol))));
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    out.push([u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1]]);
  }
  return out;
}

/** Centre, rayon et angles d'un arc défini par ses extrémités et son bulge. */
export function arcFromBulge(p0: Vec2, p1: Vec2, bulge: number) {
  const theta = 4 * Math.atan(bulge); // angle balayé, signé
  const chord = dist(p0, p1);
  const r = chord / (2 * Math.sin(Math.abs(theta) / 2));
  const mx = (p0[0] + p1[0]) / 2;
  const my = (p0[1] + p1[1]) / 2;
  // distance signée du milieu de la corde au centre
  const h = (chord / 2) / Math.tan(theta / 2);
  const ux = (p1[0] - p0[0]) / chord;
  const uy = (p1[1] - p0[1]) / chord;
  // normale à gauche de la corde
  const cx = mx - uy * h;
  const cy = my + ux * h;
  const a0 = Math.atan2(p0[1] - cy, p0[0] - cx);
  return { center: [cx, cy] as Vec2, radius: r, startAngle: a0, sweep: theta };
}

/** Arc (bulge) → points (sans le point de départ). Bulge nul ou corde nulle → segment. */
export function flattenArc(p0: Vec2, p1: Vec2, bulge: number, tol = DEFAULT_TOLERANCE, out: Vec2[] = []): Vec2[] {
  const chord = dist(p0, p1);
  if (Math.abs(bulge) < 1e-9 || chord < 1e-9) {
    out.push([p1[0], p1[1]]);
    return out;
  }
  const { center, radius, startAngle, sweep } = arcFromBulge(p0, p1, bulge);
  const stepAngle = radius > tol ? 2 * Math.acos(Math.max(-1, 1 - tol / radius)) : Math.PI / 4;
  const n = Math.min(MAX_STEPS * 2, Math.max(2, Math.ceil(Math.abs(sweep) / Math.max(stepAngle, 1e-3))));
  for (let i = 1; i < n; i++) {
    const a = startAngle + (sweep * i) / n;
    out.push([center[0] + radius * Math.cos(a), center[1] + radius * Math.sin(a)]);
  }
  out.push([p1[0], p1[1]]);
  return out;
}

/** Contour de croquis → polygone fermé (dernier point ≠ premier). */
export function loopToPolygon(loop: Loop, tol = DEFAULT_TOLERANCE): Vec2[] {
  const pts: Vec2[] = [[loop.start[0], loop.start[1]]];
  let cur: Vec2 = loop.start;
  for (const seg of loop.segments) {
    if (seg.type === 'line') pts.push([seg.to[0], seg.to[1]]);
    else if (seg.type === 'arc') flattenArc(cur, seg.to, seg.bulge, tol, pts);
    else flattenCubic(cur, seg.c1, seg.c2, seg.to, tol, pts);
    cur = seg.to;
  }
  return cleanPolygon(pts);
}

/** Supprime les doublons consécutifs et la fermeture explicite. */
export function cleanPolygon(pts: Vec2[], eps = 1e-6): Vec2[] {
  const out: Vec2[] = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (!last || Math.abs(last[0] - p[0]) > eps || Math.abs(last[1] - p[1]) > eps) out.push(p);
  }
  while (out.length > 1) {
    const a = out[0];
    const b = out[out.length - 1];
    if (Math.abs(a[0] - b[0]) <= eps && Math.abs(a[1] - b[1]) <= eps) out.pop();
    else break;
  }
  return out;
}

/** Aire signée (positive si sens trigonométrique). */
export function signedArea(pts: readonly Vec2[]): number {
  let a = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    a += (pts[j][0] - pts[i][0]) * (pts[j][1] + pts[i][1]);
  }
  return a / 2;
}

/** Boîte englobante d'un ensemble de polygones. */
export function polygonsBounds(polys: readonly (readonly Vec2[])[]): { min: Vec2; max: Vec2 } | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const poly of polys)
    for (const [x, y] of poly) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  return Number.isFinite(minX) ? { min: [minX, minY], max: [maxX, maxY] } : null;
}

/** Cercle en polygone (sens trigonométrique). */
export function circlePolygon(cx: number, cy: number, r: number, segments = 48): Vec2[] {
  const pts: Vec2[] = [];
  for (let i = 0; i < segments; i++) {
    const a = (2 * Math.PI * i) / segments;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

/** Rectangle arrondi centré (sens trigonométrique). */
export function roundedRectPolygon(w: number, h: number, r: number, cornerSegments = 8): Vec2[] {
  const rr = Math.max(0, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4));
  const hw = w / 2;
  const hh = h / 2;
  if (rr <= 1e-4)
    return [
      [-hw, -hh],
      [hw, -hh],
      [hw, hh],
      [-hw, hh],
    ];
  const pts: Vec2[] = [];
  const corners: [number, number, number][] = [
    [hw - rr, -hh + rr, -Math.PI / 2],
    [hw - rr, hh - rr, 0],
    [-hw + rr, hh - rr, Math.PI / 2],
    [-hw + rr, -hh + rr, Math.PI],
  ];
  for (const [cx, cy, a0] of corners) {
    for (let i = 0; i <= cornerSegments; i++) {
      const a = a0 + (Math.PI / 2) * (i / cornerSegments);
      pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]);
    }
  }
  return cleanPolygon(pts);
}
