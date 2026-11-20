import { describe, expect, it } from 'vitest';
import { getNodeEngine } from '../geometry/nodeEngine';
import { buildTemplate, TEMPLATES } from './registry';

/** Budget de calcul de la géométrie d'un modèle courant (brief §10, J7). */
const BUDGET_MS = 300;
const BED = { id: 'ff-5m-pro', bed: [220, 220, 220] as [number, number, number] };

describe('performances de la géométrie', () => {
  it('chaque modèle courant se calcule en moins de 300 ms (moteur chaud)', async () => {
    const engine = await getNodeEngine();
    // préchauffage : chargement des polices et du WASM, hors mesure
    await engine.evaluatePart(buildTemplate('porte-cles', {}, BED).parts[0]);
    const timings: Record<string, number> = {};
    for (const id of Object.keys(TEMPLATES)) {
      engine.clear();
      const scene = buildTemplate(id, {}, BED);
      const t0 = performance.now();
      for (const part of scene.parts) await engine.evaluatePart(part);
      timings[id] = Math.round(performance.now() - t0);
    }
    console.info('Temps de calcul (ms) :', timings);
    for (const [id, ms] of Object.entries(timings)) {
      if (id === 'trophee') continue; // 2 pièces, 60+ éléments : hors « modèles courants »
      expect(ms, id).toBeLessThan(BUDGET_MS);
    }
    // le trophée complet reste interactif
    expect(timings.trophee).toBeLessThan(800);
    // une modification de texte ne recalcule que ce qui change
    const t0 = performance.now();
    await engine.evaluatePart(buildTemplate('porte-cles', { texte: 'LÉA' }, BED).parts[0]);
    expect(performance.now() - t0).toBeLessThan(BUDGET_MS);
  });
});
