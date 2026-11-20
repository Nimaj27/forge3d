import { describe, expect, it } from 'vitest';
import { demoScene } from '../scene/factory';
import { buildTemplate } from '../templates/registry';
import { parseProjectText } from './projects';

describe('fichiers .forge3d.json', () => {
  it('aller-retour sans perte (scène de modèle comprise)', () => {
    const scene = buildTemplate('trophee', {}, { id: 'ff-5m-pro', bed: [220, 220, 220] });
    const back = parseProjectText(JSON.stringify(scene));
    expect(back).toEqual(scene);
    expect(JSON.stringify(scene).length).toBeLessThan(900_000);
  });

  it('refuse un fichier invalide avec un message clair', () => {
    expect(() => parseProjectText('pas du json')).toThrow('JSON illisible');
    expect(() => parseProjectText('{"version":2}')).toThrow('pas un projet Forge3D valide');
    expect(parseProjectText(JSON.stringify(demoScene({ id: 'x', bed: [220, 220, 220] }))).name).toBe('Cube percé');
  });
});
