import { describe, expect, it } from 'vitest';
import { parseScene, type Scene } from '../../shared/scene';
import type { Bounds } from '../geometry/types';
import { alignObjects, applyScaleToObject, groupObjects, mirrorObjects, ungroupObject } from './actions';

function scene(): Scene {
  return parseScene({
    version: 1,
    printer: { id: 'x', bed: [220, 220, 220] },
    parts: [
      {
        id: 'p',
        objects: [
          { id: 'a', kind: 'box', params: { size: [10, 10, 10] }, transform: { position: [0, 0, 0] } },
          { id: 'b', kind: 'box', params: { size: [20, 20, 20] }, transform: { position: [40, 0, 5] } },
        ],
      },
    ],
  });
}

const local: Record<string, Bounds> = {
  a: { min: [-5, -5, 0], max: [5, 5, 10] },
  b: { min: [-10, -10, 0], max: [10, 10, 20] },
};
const boundsOf = (id: string) => local[id] ?? null;

describe('actions de l’atelier', () => {
  it('groupe puis dégroupe sans déplacer les objets', () => {
    const g = groupObjects(scene(), ['a', 'b'], boundsOf)!;
    expect(g).not.toBeNull();
    const group = g.scene.parts[0].objects[0];
    expect(group.kind).toBe('group');
    // origine : centre XY de la sélection (x ∈ [−5, 50]), bas en Z
    expect(group.transform.position).toEqual([22.5, 0, 0]);
    const u = ungroupObject(g.scene, g.groupId)!;
    const [a, b] = u.scene.parts[0].objects;
    expect(a.transform.position).toEqual([0, 0, 0]);
    expect(b.transform.position).toEqual([40, 0, 5]);
  });

  it('aligne en bas et à gauche', () => {
    const s1 = alignObjects(scene(), ['a', 'b'], 2, 'min', boundsOf);
    expect(s1.parts[0].objects[1].transform.position[2]).toBe(0);
    const s2 = alignObjects(scene(), ['a', 'b'], 0, 'min', boundsOf);
    // gauche commune = −5 → b (demi-largeur 10) centré à 5
    expect(s2.parts[0].objects[1].transform.position[0]).toBe(5);
  });

  it('centre un objet seul sur le plateau', () => {
    const s = alignObjects(scene(), ['b'], 0, 'center', boundsOf);
    expect(s.parts[0].objects[1].transform.position[0]).toBe(0);
  });

  it('fait un miroir autour du centre de la sélection', () => {
    const s = mirrorObjects(scene(), ['a', 'b'], 0, boundsOf);
    const [a, b] = s.parts[0].objects;
    // boîte commune x ∈ [−5, 50] → centre 22,5 : a (0) → 45, b (40) → 5
    expect(a.transform.position[0]).toBeCloseTo(45, 6);
    expect(b.transform.position[0]).toBeCloseTo(5, 6);
    expect(a.transform.scale?.[0]).toBeCloseTo(-1, 6);
  });

  it('convertit une mise à l’échelle en dimensions réelles', () => {
    const box = scene().parts[0].objects[0];
    const scaled = applyScaleToObject(box, [2, 1.5, 0.5], true);
    expect(scaled.kind === 'box' && scaled.params.size).toEqual([20, 15, 5]);
  });
});
