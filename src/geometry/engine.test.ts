import { describe, expect, it } from 'vitest';
import { parseScene, type Part } from '../../shared/scene';
import { isPrintable } from './meshCheck';
import { getNodeEngine } from './nodeEngine';
import { readBinaryStl } from './stl';
import { validateTriangleSoup } from './meshCheck';

const BED: [number, number, number] = [220, 220, 220];

function part(objects: unknown[], extra: Record<string, unknown> = {}): Part {
  return parseScene({ version: 1, printer: { id: 'ff-5m-pro', bed: BED }, parts: [{ id: 'p', name: 'Test', objects, ...extra }] })
    .parts[0];
}

describe('moteur géométrique', () => {
  it('J1 : cube + cylindre « trou » → STL étanche', async () => {
    const engine = await getNodeEngine();
    const p = part([
      { id: 'cube', kind: 'box', params: { size: [40, 40, 20] } },
      {
        id: 'trou',
        kind: 'cylinder',
        mode: 'hole',
        transform: { position: [0, 0, -1] },
        params: { radius: 8, height: 22 },
      },
    ]);
    const ev = await engine.evaluatePart(p);
    expect(ev.status).toBe('ok');
    expect(ev.bounds?.min).toEqual([-20, -20, 0]);
    expect(ev.bounds?.max).toEqual([20, 20, 20]);
    // volume = cube − cylindre (polygone à 64 côtés)
    const cyl = 0.5 * 64 * 8 * 8 * Math.sin((2 * Math.PI) / 64) * 20;
    expect(ev.volume).toBeCloseTo(40 * 40 * 20 - cyl, 1);

    const file = await engine.exportPart(p, 'test.stl');
    expect(isPrintable(file.validation)).toBe(true);
    // relecture du STL comme un slicer
    const reread = validateTriangleSoup(readBinaryStl(file.data));
    expect(reread).toMatchObject({ nonManifoldEdges: 0, degenerateTriangles: 0, components: 1 });

    const report = await engine.analyzePart(p, BED);
    const byId = Object.fromEntries(report.checks.map((c) => [c.id, c.level]));
    expect(byId).toEqual({ bed: 'ok', manifold: 'ok', thin: 'ok', overhang: 'ok', flat: 'ok' });
  });

  it('signale une pièce trop grande et propose une correction', async () => {
    const engine = await getNodeEngine();
    const report = await engine.analyzePart(part([{ id: 'a', kind: 'box', params: { size: [300, 10, 10] } }]), BED);
    const bed = report.checks.find((c) => c.id === 'bed');
    expect(bed?.level).toBe('error');
    // Prusa MK4 (250 × 210 × 220) : une barre debout de 240 mm tient couchée.
    const tall = await engine.analyzePart(part([{ id: 'b', kind: 'box', params: { size: [20, 20, 240] } }]), [250, 210, 220]);
    expect(tall.checks.find((c) => c.id === 'bed')?.fix).toBe('layFlat');
    const wide = await engine.analyzePart(part([{ id: 'c', kind: 'box', params: { size: [20, 240, 20] } }]), [250, 210, 220]);
    expect(wide.checks.find((c) => c.id === 'bed')?.fix).toBe('rotate90');
  });

  it('détecte deux blocs séparés et une pièce qui flotte', async () => {
    const engine = await getNodeEngine();
    const report = await engine.analyzePart(
      part([
        { id: 'a', kind: 'box', params: { size: [10, 10, 10] }, transform: { position: [0, 0, 2] } },
        { id: 'b', kind: 'box', params: { size: [10, 10, 10] }, transform: { position: [40, 0, 2] } },
      ]),
      BED,
    );
    const byId = Object.fromEntries(report.checks.map((c) => [c.id, c]));
    expect(byId.manifold.level).toBe('warn');
    expect(byId.flat.level).toBe('warn');
    expect(byId.flat.fix).toBe('dropToBed');
  });

  it('détecte les surplombs (T posé sur sa barre verticale)', async () => {
    const engine = await getNodeEngine();
    const report = await engine.analyzePart(
      part([
        { id: 'pied', kind: 'box', params: { size: [6, 6, 30] } },
        { id: 'barre', kind: 'box', params: { size: [60, 20, 5] }, transform: { position: [0, 0, 29.5] } },
      ]),
      BED,
    );
    expect(report.checks.find((c) => c.id === 'overhang')?.level).toBe('warn');
  });

  it('détecte les parois plus fines que 0,4 mm', async () => {
    const engine = await getNodeEngine();
    const report = await engine.analyzePart(
      part([
        { id: 'base', kind: 'box', params: { size: [30, 30, 2] } },
        { id: 'lame', kind: 'box', params: { size: [30, 0.3, 10] }, transform: { position: [0, 0, 1.5] } },
      ]),
      BED,
    );
    expect(report.checks.find((c) => c.id === 'thin')?.level).toBe('warn');
  });

  it('couche une pièce « à plat sur le dos » pour l’impression', async () => {
    const engine = await getNodeEngine();
    // Plaque debout de 100 (X) × 6 (Y) × 150 (Z)
    const ev = await engine.evaluatePart(
      part([{ id: 'plaque', kind: 'box', params: { size: [100, 6, 150] } }], { printOrientation: 'flatOnBack' }),
    );
    const pb = ev.printBounds!;
    expect(pb.min[2]).toBeCloseTo(0, 6);
    expect(pb.max[2] - pb.min[2]).toBeCloseTo(6, 6);
    expect(pb.max[1] - pb.min[1]).toBeCloseTo(150, 6);
  });

  it('évalue les groupes (trou dans un groupe percé)', async () => {
    const engine = await getNodeEngine();
    const ev = await engine.evaluatePart(
      part([
        { id: 'base', kind: 'box', params: { size: [20, 20, 10] } },
        {
          id: 'g',
          kind: 'group',
          mode: 'solid',
          transform: { position: [0, 0, 10] },
          children: [
            { id: 'tube', kind: 'tube', params: { outerRadius: 5, innerRadius: 3, height: 10 } },
            { id: 't', kind: 'cylinder', mode: 'hole', params: { radius: 1, height: 20 }, transform: { position: [0, 0, -5] } },
          ],
        },
      ]),
    );
    expect(ev.status).toBe('ok');
    expect(ev.bounds?.max[2]).toBeCloseTo(20, 6);
  });

  it('arrondit les arêtes d’un cube', async () => {
    const engine = await getNodeEngine();
    const ev = await engine.evaluatePart(part([{ id: 'a', kind: 'box', params: { size: [20, 20, 20], edgeRadius: 3 } }]));
    expect(ev.status).toBe('ok');
    expect(ev.bounds?.max[2]).toBeCloseTo(20, 3);
    expect(ev.volume).toBeLessThan(8000);
    expect(ev.volume).toBeGreaterThan(7000);
  });

  it('respecte l’ordre de rotation X puis Y puis Z (axes fixes)', async () => {
    const engine = await getNodeEngine();
    // Barre le long de X, rotation [90, 0, 90] : X → Y
    const ev = await engine.evaluatePart(
      part([{ id: 'a', kind: 'box', params: { size: [40, 2, 2] }, transform: { rotation: [90, 0, 90] } }]),
    );
    const b = ev.bounds!;
    expect(b.max[1] - b.min[1]).toBeCloseTo(40, 4);
  });
});
