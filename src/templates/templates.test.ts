import { describe, expect, it } from 'vitest';
import type { Scene } from '../../shared/scene';
import { isPrintable } from '../geometry/meshCheck';
import { getNodeEngine } from '../geometry/nodeEngine';
import { pauseHeights } from '../lib/layers';
import { buildTemplate, TEMPLATES } from './registry';

const FIVE_M_PRO = { id: 'ff-5m-pro', bed: [220, 220, 220] as [number, number, number] };

async function checkScene(scene: Scene) {
  const engine = await getNodeEngine();
  const results = [];
  for (const part of scene.parts) {
    const ev = await engine.evaluatePart(part);
    expect(ev.status, `${scene.name} / ${part.name} : ${ev.error ?? ''} ${ev.warnings.join(' ')}`).toBe('ok');
    const file = await engine.exportPart(part, `${part.id}.stl`);
    expect(isPrintable(file.validation), `${part.name} : ${JSON.stringify(file.validation)}`).toBe(true);
    const report = await engine.analyzePart(part, FIVE_M_PRO.bed);
    const bed = report.checks.find((c) => c.id === 'bed');
    expect(bed?.level, `${part.name} doit tenir sur le plateau de la 5M Pro`).toBe('ok');
    results.push({ part, ev, report });
  }
  return results;
}

describe('modèles paramétriques : valeurs par défaut → STL valides sur la 5M Pro', () => {
  for (const [id, def] of Object.entries(TEMPLATES)) {
    if (id === 'trophee') continue;
    it(`${def.name}`, async () => {
      const scene = buildTemplate(id, {}, FIVE_M_PRO);
      expect(scene.template?.id).toBe(id);
      await checkScene(scene);
    });
  }

  it('Trophée : 250 mm, 2 STL valides, pauses 7,8 / 8,2 / 58,2 mm', async () => {
    const scene = buildTemplate('trophee', {}, FIVE_M_PRO);
    expect(scene.parts.map((p) => p.name)).toEqual(['Bouclier', 'Socle']);
    const results = await checkScene(scene);
    // hauteur assemblée
    const zMax = Math.max(...results.map((r) => r.ev.bounds!.max[2]));
    const zMin = Math.min(...results.map((r) => r.ev.bounds!.min[2]));
    expect(zMax - zMin).toBeGreaterThan(249.5);
    expect(zMax - zMin).toBeLessThan(250.5);
    // pauses
    const [bouclier, socle] = scene.parts;
    expect(pauseHeights(bouclier.colorChanges, scene.firstLayerHeight, scene.layerHeight)).toEqual([7.8]);
    expect(pauseHeights(socle.colorChanges, scene.firstLayerHeight, scene.layerHeight)).toEqual([8.2, 58.2]);
    // bouclier imprimé à plat : 9,8 mm d'épaisseur, posé sur le plateau
    const pb = results[0].ev.printBounds!;
    expect(pb.max[2] - pb.min[2]).toBeCloseTo(9.8, 2);
    expect(pb.min[2]).toBeCloseTo(0, 4);
    // socle 70 mm, posé à plat ; aucun support nécessaire pour le socle ni le bouclier
    expect(results[1].ev.bounds!.max[2]).toBeCloseTo(70, 3);
    for (const r of results) expect(r.report.checks.find((c) => c.id === 'overhang')?.level, r.part.name).toBe('ok');
  });

  it('Trophée réduit (180 mm) sans banderole ni blason : toujours valide', async () => {
    const scene = buildTemplate('trophee', { hauteurTotale: 180, banderole: '', blason: 'aucun' }, FIVE_M_PRO);
    await checkScene(scene);
  });

  it('Porte-clés : pause à 3,2 mm, forme écusson et cœur valides', async () => {
    const scene = buildTemplate('porte-cles', { forme: 'ecusson', motif: 'coeur' }, FIVE_M_PRO);
    expect(pauseHeights(scene.parts[0].colorChanges, 0.2, 0.2)).toEqual([3.2]);
    await checkScene(scene);
  });

  it('Boîte coulissante et image en mode photo : valides', async () => {
    await checkScene(buildTemplate('boite', { couvercle: 'coulissant' }, FIVE_M_PRO));
    await checkScene(buildTemplate('image-relief', { style: 'photo' }, FIVE_M_PRO));
  });

  it('réglages invalides → valeurs par défaut', () => {
    const scene = buildTemplate('plaque', { largeur: -5, texte: 'OK' }, FIVE_M_PRO);
    expect(scene.template?.params.largeur).toBe(150);
    expect(scene.template?.params.texte).toBe('OK');
  });
});
