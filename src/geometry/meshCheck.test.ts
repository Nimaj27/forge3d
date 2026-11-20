import { describe, expect, it } from 'vitest';
import { isPrintable, validateTriangleSoup } from './meshCheck';
import { readBinaryStl, writeBinaryStl } from './stl';

/** Tétraèdre fermé, correctement orienté. */
function tetra(offset = 0): number[] {
  const v = [
    [0, 0, 0],
    [10, 0, 0],
    [0, 10, 0],
    [0, 0, 10],
  ].map(([x, y, z]) => [x + offset, y, z]);
  const faces = [
    [0, 2, 1],
    [0, 1, 3],
    [1, 2, 3],
    [0, 3, 2],
  ];
  return faces.flatMap((f) => f.flatMap((i) => v[i]));
}

describe('vérification de maillage (comme un slicer)', () => {
  it('accepte un solide fermé', () => {
    const v = validateTriangleSoup(new Float32Array(tetra()));
    expect(v).toMatchObject({ vertexCount: 4, triangleCount: 4, nonManifoldEdges: 0, degenerateTriangles: 0, components: 1 });
    expect(isPrintable(v)).toBe(true);
  });

  it('détecte un trou dans le maillage', () => {
    const v = validateTriangleSoup(new Float32Array(tetra().slice(0, 27)));
    expect(v.nonManifoldEdges).toBe(3);
    expect(isPrintable(v)).toBe(false);
  });

  it('détecte une face retournée', () => {
    const soup = tetra();
    // inverse le premier triangle
    const t = soup.slice(0, 9);
    soup.splice(0, 9, ...t.slice(3, 6), ...t.slice(0, 3), ...t.slice(6, 9));
    expect(validateTriangleSoup(new Float32Array(soup)).nonManifoldEdges).toBeGreaterThan(0);
  });

  it('compte les blocs séparés', () => {
    const v = validateTriangleSoup(new Float32Array([...tetra(), ...tetra(50)]));
    expect(v.components).toBe(2);
    expect(v.nonManifoldEdges).toBe(0);
  });

  it('détecte les triangles dégénérés', () => {
    const v = validateTriangleSoup(new Float32Array([...tetra(), 1, 1, 1, 2, 2, 2, 3, 3, 3]));
    expect(v.degenerateTriangles).toBe(1);
  });

  it('écrit et relit un STL binaire', () => {
    const soup = new Float32Array(tetra());
    const buf = writeBinaryStl(soup);
    expect(buf.byteLength).toBe(84 + 4 * 50);
    expect(Array.from(readBinaryStl(buf))).toEqual(Array.from(soup));
  });
});
