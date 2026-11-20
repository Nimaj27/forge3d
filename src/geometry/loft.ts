/**
 * Loft : une seule coque continue reliant des sections octogonales (rectangles chanfreinés).
 * Évite les unions de troncs empilés (faces coplanaires) — leçon du trophée (brief §4).
 */
import type { Manifold, ManifoldToplevel } from 'manifold-3d';
import type { LoftParams } from '../../shared/scene';

/** Octogone : rectangle w × d aux coins chanfreinés de c (sens trigonométrique). */
export function octagon(w: number, d: number, c: number): [number, number][] {
  const hw = w / 2;
  const hd = d / 2;
  const k = Math.max(0.05, Math.min(c, hw - 0.05, hd - 0.05));
  return [
    [hw - k, -hd],
    [hw, -hd + k],
    [hw, hd - k],
    [hw - k, hd],
    [-hw + k, hd],
    [-hw, hd - k],
    [-hw, -hd + k],
    [-hw + k, -hd],
  ];
}

export function buildLoft(wasm: ManifoldToplevel, p: LoftParams, warnings: string[]): Manifold | null {
  // sections triées, doublons exacts retirés
  const sections = [...p.sections].sort((a, b) => a.z - b.z).filter((s, i, arr) => {
    const prev = arr[i - 1];
    return !prev || s.z !== prev.z || s.width !== prev.width || s.depth !== prev.depth || s.chamfer !== prev.chamfer;
  });
  if (sections.length < 2 || sections[sections.length - 1].z - sections[0].z <= 0) {
    warnings.push('Coque : il faut au moins deux sections à des hauteurs différentes.');
    return null;
  }
  const rings = sections.map((s) => octagon(s.width, s.depth, s.chamfer));
  const n = rings.length;
  const pos = new Float32Array(n * 8 * 3);
  rings.forEach((ring, i) =>
    ring.forEach(([x, y], j) => {
      const o = (i * 8 + j) * 3;
      pos[o] = x;
      pos[o + 1] = y;
      pos[o + 2] = sections[i].z;
    }),
  );
  const tris: number[] = [];
  for (let i = 0; i < n - 1; i++)
    for (let j = 0; j < 8; j++) {
      const a = i * 8 + j;
      const b = i * 8 + ((j + 1) % 8);
      const c = (i + 1) * 8 + ((j + 1) % 8);
      const d = (i + 1) * 8 + j;
      tris.push(a, b, c, a, c, d);
    }
  // fond (normale −z) et dessus (+z)
  const top = (n - 1) * 8;
  for (let j = 1; j < 7; j++) {
    tris.push(0, j + 1, j);
    tris.push(top, top + j, top + j + 1);
  }
  const mesh = new wasm.Mesh({ numProp: 3, vertProperties: pos, triVerts: new Uint32Array(tris) });
  mesh.merge();
  try {
    return wasm.Manifold.ofMesh(mesh);
  } catch (err) {
    warnings.push(`Coque invalide (${err instanceof Error ? err.message : 'géométrie'}).`);
    return null;
  }
}
