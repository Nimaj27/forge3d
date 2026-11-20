/** Contours prêts à l'emploi pour les modèles (en mm, centrés sur l'origine sauf mention). */
import type { Loop, Vec2 } from '../../shared/scene';
import { shapeToLoop } from '../sketch/model';

export function rectLoop(w: number, h: number, r = 0, c: Vec2 = [0, 0]): Loop {
  return shapeToLoop({ id: 'r', kind: 'rect', c, w, h, r });
}

export function circleLoop(r: number, c: Vec2 = [0, 0]): Loop {
  return shapeToLoop({ id: 'c', kind: 'circle', c, r });
}

/** Contour polygonal fermé (lignes droites). */
export function polyLoop(points: Vec2[]): Loop {
  return { start: points[0], segments: [...points.slice(1), points[0]].map((to) => ({ type: 'line' as const, to })) };
}

/** Étoile à n branches (pointe en haut). */
export function starLoop(rOuter: number, rInner: number, n = 5, c: Vec2 = [0, 0]): Loop {
  const pts: Vec2[] = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? rOuter : rInner;
    const a = Math.PI / 2 + (Math.PI * i) / n;
    pts.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]);
  }
  return polyLoop(pts);
}

/** Cœur de largeur `w` (pointe en bas), centré. */
export function heartLoop(w: number, c: Vec2 = [0, 0]): Loop {
  const k = w / 2;
  const p = (x: number, y: number): Vec2 => [c[0] + x * k, c[1] + y * k];
  return {
    start: p(0, -0.9),
    segments: [
      { type: 'bezier', c1: p(0.55, -0.4), c2: p(1.05, -0.05), to: p(1, 0.35) },
      { type: 'bezier', c1: p(0.95, 0.85), c2: p(0.25, 0.95), to: p(0, 0.5) },
      { type: 'bezier', c1: p(-0.25, 0.95), c2: p(-0.95, 0.85), to: p(-1, 0.35) },
      { type: 'bezier', c1: p(-1.05, -0.05), c2: p(-0.55, -0.4), to: p(0, -0.9) },
    ],
  };
}

/**
 * Écusson (bouclier héraldique « français ancien ») : dessus plat, flancs droits puis arrondis
 * jusqu'à une pointe en bas. Origine au milieu du bord supérieur ; `inset` rétrécit le contour.
 */
export function shieldLoop(w: number, h: number, inset = 0, top: Vec2 = [0, 0]): Loop {
  const hw = w / 2 - inset;
  const tY = top[1] - inset;
  const bottom = top[1] - h + inset * 1.6;
  const shoulder = tY - (h - inset * 2.6) * 0.45;
  const x0 = top[0];
  return {
    start: [x0 - hw, tY],
    segments: [
      { type: 'line', to: [x0 + hw, tY] },
      { type: 'line', to: [x0 + hw, shoulder] },
      { type: 'bezier', c1: [x0 + hw, shoulder - (shoulder - bottom) * 0.55], c2: [x0 + hw * 0.45, bottom + (shoulder - bottom) * 0.12], to: [x0, bottom] },
      { type: 'bezier', c1: [x0 - hw * 0.45, bottom + (shoulder - bottom) * 0.12], c2: [x0 - hw, shoulder - (shoulder - bottom) * 0.55], to: [x0 - hw, shoulder] },
      { type: 'line', to: [x0 - hw, tY] },
    ],
  };
}

/** Points régulièrement espacés le long d'un contour (rivets, perçages décoratifs). */
export function pointsAlong(poly: Vec2[], spacing: number): Vec2[] {
  const out: Vec2[] = [];
  let carry = spacing / 2;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let t = carry;
    while (t <= len) {
      out.push([a[0] + ((b[0] - a[0]) * t) / len, a[1] + ((b[1] - a[1]) * t) / len]);
      t += spacing;
    }
    carry = t - len;
  }
  return out;
}
