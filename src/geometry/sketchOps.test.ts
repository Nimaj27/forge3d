import { describe, expect, it } from 'vitest';
import { parseScene, type Part } from '../../shared/scene';
import { shapeToLoop } from '../sketch/model';
import { isPrintable } from './meshCheck';
import { getNodeEngine, getNodeWasm } from './nodeEngine';
import { readBinaryStl } from './stl';
import { validateTriangleSoup } from './meshCheck';
import { shellLoops } from './sketchOps';

function part(objects: unknown[]): Part {
  return parseScene({ version: 1, printer: { id: 'x', bed: [220, 220, 220] }, parts: [{ id: 'p', name: 'Vase', objects }] }).parts[0];
}

describe('croquis → 3D', () => {
  it('J3 : le vase de la maquette (Ø 64 × 100, paroi 2,5) se modélise et s’exporte', async () => {
    const wasm = await getNodeWasm();
    // silhouette extérieure dessinée à droite de l'axe : fond, ventre galbé, col, ouverture
    const silhouette = shapeToLoop({
      id: 's',
      kind: 'path',
      // paroi droite jusqu'au ventre (rayon 32 exact), puis col galbé et ouverture évasée
      points: [
        [0, 0],
        [32, 0],
        [32, 40],
        [22, 80],
        [24, 100],
        [0, 100],
      ],
      segs: [{ t: 'line' }, { t: 'line' }, { t: 'curve' }, { t: 'curve' }, { t: 'line' }, { t: 'line' }],
    });
    const wall = shellLoops(wasm, [silhouette], 2.5, 'revolve');
    expect(wall.length).toBe(1);

    const engine = await getNodeEngine();
    const p = part([{ id: 'vase', kind: 'sketch', params: { loops: wall, op: 'revolve', angle: 360, segments: 96 } }]);
    const ev = await engine.evaluatePart(p);
    expect(ev.status).toBe('ok');
    const b = ev.bounds!;
    expect(b.max[0] - b.min[0]).toBeGreaterThan(63.9);
    expect(b.max[0] - b.min[0]).toBeLessThan(64.1);
    expect(b.max[2] - b.min[2]).toBeCloseTo(100, 1);
    expect(b.min[2]).toBeCloseTo(0, 3);
    // creux : volume bien inférieur au plein
    expect(ev.volume).toBeLessThan(0.35 * Math.PI * 30 * 30 * 100);

    const report = await engine.analyzePart(p, [220, 220, 220]);
    const byId = Object.fromEntries(report.checks.map((c) => [c.id, c.level]));
    expect(byId.manifold).toBe('ok');
    expect(byId.bed).toBe('ok');
    expect(byId.flat).toBe('ok');

    const file = await engine.exportPart(p, 'vase.stl');
    expect(isPrintable(file.validation)).toBe(true);
    expect(validateTriangleSoup(readBinaryStl(file.data))).toMatchObject({ nonManifoldEdges: 0, components: 1 });
  });

  it('contour creux en extrusion (anneau)', async () => {
    const wasm = await getNodeWasm();
    const ring = shellLoops(wasm, [shapeToLoop({ id: 'c', kind: 'circle', c: [0, 0], r: 20 })], 2, 'extrude');
    expect(ring.length).toBe(2); // contour extérieur + contour intérieur
    const engine = await getNodeEngine();
    const ev = await engine.evaluatePart(part([{ id: 'a', kind: 'sketch', params: { loops: ring, op: 'extrude', height: 10 } }]));
    expect(ev.volume).toBeGreaterThan(Math.PI * (400 - 324) * 10 * 0.97);
    expect(ev.volume).toBeLessThan(Math.PI * (400 - 324) * 10 * 1.01);
  });

  it('extrusion d’un croquis avec un trou (EvenOdd) et révolution partielle', async () => {
    const engine = await getNodeEngine();
    const outer = shapeToLoop({ id: 'r', kind: 'rect', c: [0, 0], w: 40, h: 30, r: 4 });
    const hole = shapeToLoop({ id: 'h', kind: 'circle', c: [0, 0], r: 6 });
    const ev = await engine.evaluatePart(part([{ id: 'a', kind: 'sketch', params: { loops: [outer, hole], op: 'extrude', height: 5 } }]));
    expect(ev.status).toBe('ok');
    const file = await engine.exportPart(part([{ id: 'a', kind: 'sketch', params: { loops: [outer, hole], op: 'extrude', height: 5 } }]), 'x.stl');
    expect(isPrintable(file.validation)).toBe(true);
    const half = await engine.evaluatePart(
      part([{ id: 'b', kind: 'sketch', params: { loops: [shapeToLoop({ id: 'q', kind: 'rect', c: [15, 10], w: 10, h: 20, r: 0 })], op: 'revolve', angle: 180 } }]),
    );
    expect(half.status).toBe('ok');
  });
});
