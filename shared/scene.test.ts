import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { parseScene, safeParseScene, sceneSchema, walkObjects } from './scene';

const minimal = {
  version: 1,
  printer: { id: 'ff-5m-pro', bed: [220, 220, 220] },
  parts: [
    {
      id: 'p1',
      objects: [
        { id: 'a', kind: 'box', params: {} },
        {
          id: 'g',
          kind: 'group',
          mode: 'hole',
          children: [{ id: 'c', kind: 'cylinder', params: { radius: 3, height: 30 } }],
        },
      ],
    },
  ],
};

describe('schéma de Scène', () => {
  it('complète les valeurs par défaut', () => {
    const s = parseScene(minimal);
    expect(s.unit).toBe('mm');
    expect(s.layerHeight).toBe(0.2);
    expect(s.firstLayerHeight).toBe(0.2);
    const box = s.parts[0].objects[0];
    expect(box.kind).toBe('box');
    if (box.kind === 'box') expect(box.params.size).toEqual([20, 20, 20]);
    expect(box.mode).toBe('solid');
    expect(box.transform.position).toEqual([0, 0, 0]);
  });

  it('valide les groupes récursivement', () => {
    const s = parseScene(minimal);
    const seen: string[] = [];
    walkObjects(s.parts[0].objects, (o) => seen.push(o.id));
    expect(seen).toEqual(['a', 'g', 'c']);
    const g = s.parts[0].objects[1];
    if (g.kind === 'group' && g.children[0].kind === 'cylinder') {
      expect(g.children[0].params.segments).toBe(64);
    } else {
      throw new Error('groupe mal interprété');
    }
  });

  it('refuse un type inconnu ou une dimension négative', () => {
    const bad1 = structuredClone(minimal) as typeof minimal;
    (bad1.parts[0].objects[0] as { kind: string }).kind = 'teapot';
    expect(safeParseScene(bad1).success).toBe(false);

    const bad2 = structuredClone(minimal);
    (bad2.parts[0].objects[0] as { params: unknown }).params = { size: [10, -1, 10] };
    expect(safeParseScene(bad2).success).toBe(false);
  });

  it('se convertit en JSON Schema (pour l’outil build_scene de l’IA)', () => {
    const schema = z.toJSONSchema(sceneSchema, { io: 'input', unrepresentable: 'any' });
    expect(schema.type).toBe('object');
    expect(JSON.stringify(schema)).toContain('colorChanges');
  });
});
