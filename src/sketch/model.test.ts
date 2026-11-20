import { describe, expect, it } from 'vitest';
import type { Vec2 } from '../../shared/scene';
import { signedArea } from '../geometry/curves';
import { bulgeFromHandle, loopToShape, mirrorShape, segmentHandle, shapePolygon, shapeToLoop, symmetrize, type SketchShape } from './model';

const area = (s: SketchShape) => signedArea(shapePolygon(s, 0.005));

describe('modèle du croquis', () => {
  it('cercle, rectangle arrondi, polygone → contours corrects', () => {
    expect(area({ id: 'c', kind: 'circle', c: [5, 5], r: 10 })).toBeCloseTo(Math.PI * 100, 0);
    const rr = area({ id: 'r', kind: 'rect', c: [0, 0], w: 40, h: 20, r: 5 });
    expect(rr).toBeCloseTo(40 * 20 - (4 - Math.PI) * 25, 0);
    const hex = area({ id: 'p', kind: 'polygon', c: [0, 0], r: 10, n: 6, rot: 0 });
    expect(hex).toBeCloseTo((3 * Math.sqrt(3) / 2) * 100, 3);
  });

  it('poignée du milieu ↔ bulge (aller-retour)', () => {
    const a: Vec2 = [0, 0];
    const b: Vec2 = [10, 0];
    for (const bulge of [-1, -0.3, 0, 0.4142, 1]) {
      expect(bulgeFromHandle(a, b, segmentHandle(a, b, bulge))).toBeCloseTo(bulge, 9);
    }
    // bulge 1 : demi-cercle dont le sommet est à 5 mm de la corde
    const h = segmentHandle(a, b, 1);
    expect(Math.abs(h[1])).toBeCloseTo(5, 9);
  });

  it('la poignée correspond bien au sommet de l’arc aplati', () => {
    const s: SketchShape = { id: 'x', kind: 'path', points: [[0, 0], [10, 0], [10, 10]], segs: [{ t: 'arc', bulge: 0.5 }, { t: 'line' }, { t: 'line' }] };
    const poly = shapePolygon(s, 0.001);
    const h = segmentHandle([0, 0], [10, 0], 0.5);
    const nearest = Math.min(...poly.map((p) => Math.hypot(p[0] - h[0], p[1] - h[1])));
    expect(nearest).toBeLessThan(0.01);
  });

  it('miroir : même aire, même orientation', () => {
    const s: SketchShape = {
      id: 'x',
      kind: 'path',
      points: [[2, 0], [12, 0], [14, 8], [4, 10]],
      segs: [{ t: 'line' }, { t: 'arc', bulge: 0.3 }, { t: 'curve' }, { t: 'bezier', c1: [3, 7], c2: [1, 3] }],
    };
    const m = mirrorShape(s);
    expect(area(m)).toBeCloseTo(area(s), 3);
    const xs = shapePolygon(m).map((p) => p[0]);
    const origXs = shapePolygon(s).map((p) => p[0]);
    expect(Math.max(...xs)).toBeCloseTo(-Math.min(...origXs), 6);
  });

  it('symétrie : un demi-profil appuyé sur l’axe devient une forme symétrique unique', () => {
    const half: SketchShape = {
      id: 'v',
      kind: 'path',
      points: [[0, 0], [30, 0], [24, 60], [0, 60]],
      segs: [{ t: 'line' }, { t: 'arc', bulge: -0.2 }, { t: 'line' }, { t: 'line' }],
    };
    const res = symmetrize(half);
    expect(res).toHaveLength(1);
    const poly = shapePolygon(res[0], 0.005);
    const xs = poly.map((p) => p[0]);
    expect(Math.min(...xs)).toBeCloseTo(-Math.max(...xs), 3);
    expect(Math.abs(signedArea(poly))).toBeCloseTo(2 * Math.abs(area(half)), 1);
  });

  it('symétrie : une forme éloignée de l’axe est dupliquée', () => {
    const res = symmetrize({ id: 'c', kind: 'circle', c: [20, 0], r: 5 });
    expect(res).toHaveLength(2);
  });

  it('contour → forme → contour (réédition)', () => {
    const loop = shapeToLoop({ id: 'r', kind: 'rect', c: [0, 0], w: 30, h: 20, r: 3 });
    const back = shapeToLoop(loopToShape(loop));
    expect(signedArea(shapePolygon(loopToShape(back)))).toBeCloseTo(signedArea(shapePolygon(loopToShape(loop))), 6);
  });
});
