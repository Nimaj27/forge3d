/**
 * Opérations 2D sur les croquis (exécutées dans le worker, avec les CrossSection de manifold).
 */
import type { CrossSection, ManifoldToplevel, Vec2 as MVec2 } from 'manifold-3d';
import type { Loop, Vec2 } from '../../shared/scene';
import { Arena } from './cache';
import { loopToPolygon } from './curves';

function polygonsToLoops(polys: Vec2[][]): Loop[] {
  return polys
    .filter((p) => p.length >= 3)
    .map((p) => ({
      start: round2(p[0]),
      segments: [...p.slice(1).map((to) => ({ type: 'line' as const, to: round2(to) })), { type: 'line' as const, to: round2(p[0]) }],
    }));
}

function round2([x, y]: Vec2): Vec2 {
  return [Math.round(x * 1e4) / 1e4, Math.round(y * 1e4) / 1e4];
}

/**
 * Creuse un croquis en paroi d'épaisseur constante.
 * - « revolve » : la silhouette (appuyée sur l'axe x = 0) devient le profil d'un vase ouvert
 *   en haut, avec un fond de la même épaisseur.
 * - « extrude » : contour creux (anneau) de l'épaisseur demandée.
 */
export function shellLoops(wasm: ManifoldToplevel, loops: readonly Loop[], thickness: number, mode: 'revolve' | 'extrude'): Loop[] {
  const { CrossSection } = wasm;
  const arena = new Arena();
  try {
    const polys = loops.map((l) => loopToPolygon(l)).filter((p) => p.length >= 3);
    if (!polys.length || thickness <= 0) return [...loops];
    let cs: CrossSection = arena.track(new CrossSection(polys as MVec2[][], 'EvenOdd'));
    let wall: CrossSection;
    if (mode === 'extrude') {
      const inner = arena.track(cs.offset(-thickness, 'Round', 2, 64));
      wall = arena.track(cs.subtract(inner));
    } else {
      // demi-profil (x ≥ 0) + son miroir = silhouette pleine, sans arête sur l'axe
      const b0 = cs.bounds();
      const big = Math.max(Math.abs(b0.min[0]), Math.abs(b0.max[0]), 1) + 10;
      const h0 = b0.max[1] - b0.min[1] + 20;
      const rightSq = arena.track(CrossSection.square([big, h0]));
      const right = arena.track(rightSq.translate([0, b0.min[1] - 10]));
      cs = arena.track(cs.intersect(right));
      const mirror = arena.track(cs.mirror([1, 0]));
      const full = arena.track(cs.add(mirror));
      const b = full.bounds();
      // bande au-dessus de l'ouverture : l'intérieur creusé débouche en haut
      const bandSq = arena.track(CrossSection.square([2 * big, 3 * thickness + 2]));
      const band = arena.track(bandSq.translate([-big, b.max[1] - 1e-3]));
      const ext = arena.track(full.add(band));
      const inner = arena.track(ext.offset(-thickness, 'Round', 2, 96));
      const shell = arena.track(full.subtract(inner));
      wall = arena.track(shell.intersect(right));
    }
    // élimine les éclats (< 0,6 mm) si la paroi est assez épaisse pour le supporter
    if (thickness > 0.8) {
      wall = arena.track(wall.offset(-0.3, 'Miter', 2));
      wall = arena.track(wall.offset(0.3, 'Miter', 2));
    }
    wall = arena.track(wall.simplify(0.002));
    if (wall.isEmpty()) return [...loops];
    return polygonsToLoops(wall.toPolygons() as Vec2[][]);
  } finally {
    arena.dispose();
  }
}
