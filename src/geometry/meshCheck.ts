/**
 * Vérification d'un maillage « comme un slicer » (brief §4) :
 * fusion exacte des sommets en float32, arêtes non-manifold, triangles dégénérés, nombre de blocs.
 */
import type { MeshValidation } from './types';

/**
 * @param soup triangles en « soupe » : 9 float32 par triangle (comme dans un STL).
 */
export function validateTriangleSoup(soup: Float32Array): MeshValidation {
  const triCount = Math.floor(soup.length / 9);
  const bits = new Uint32Array(soup.buffer, soup.byteOffset, triCount * 9);

  // 1. Fusion exacte des sommets (bits float32 identiques ; −0 et +0 confondus).
  const ids = new Uint32Array(triCount * 3);
  const index = new Map<string, number>();
  for (let v = 0; v < triCount * 3; v++) {
    const o = v * 3;
    const key = `${norm(soup[o], bits[o])},${norm(soup[o + 1], bits[o + 1])},${norm(soup[o + 2], bits[o + 2])}`;
    let id = index.get(key);
    if (id === undefined) {
      id = index.size;
      index.set(key, id);
    }
    ids[v] = id;
  }
  const vertexCount = index.size;

  // 2. Triangles dégénérés (sommets confondus ou aire nulle).
  let degenerate = 0;
  const valid = new Uint8Array(triCount);
  for (let t = 0; t < triCount; t++) {
    const a = ids[t * 3];
    const b = ids[t * 3 + 1];
    const c = ids[t * 3 + 2];
    if (a === b || b === c || a === c || triangleArea2(soup, t) < 1e-14) {
      degenerate++;
    } else {
      valid[t] = 1;
    }
  }

  // 3. Arêtes : chaque arête doit être partagée par exactement 2 triangles, en sens opposés.
  const edges = new Map<number, number>(); // clé non orientée → compteur signé encodé
  const N = vertexCount + 1;
  for (let t = 0; t < triCount; t++) {
    if (!valid[t]) continue;
    for (let e = 0; e < 3; e++) {
      const a = ids[t * 3 + e];
      const b = ids[t * 3 + ((e + 1) % 3)];
      const lo = a < b ? a : b;
      const hi = a < b ? b : a;
      const key = lo * N + hi;
      // encode : unités = nombre d'utilisations, et ±1000 selon le sens
      const dir = a < b ? 1000 : -1000;
      edges.set(key, (edges.get(key) ?? 0) + 1 + dir);
    }
  }
  let nonManifold = 0;
  for (const code of edges.values()) {
    // Correct : 2 utilisations, une dans chaque sens → code = 2
    if (code !== 2) nonManifold++;
  }

  // 4. Blocs (composantes connexes par sommets partagés).
  const parent = new Int32Array(vertexCount);
  for (let i = 0; i < vertexCount; i++) parent[i] = i;
  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };
  const used = new Uint8Array(vertexCount);
  for (let t = 0; t < triCount; t++) {
    if (!valid[t]) continue;
    const a = ids[t * 3];
    const b = ids[t * 3 + 1];
    const c = ids[t * 3 + 2];
    used[a] = used[b] = used[c] = 1;
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
    const rc = find(c);
    const ra2 = find(a);
    if (ra2 !== rc) parent[rc] = ra2;
  }
  let components = 0;
  for (let i = 0; i < vertexCount; i++) if (used[i] && find(i) === i) components++;

  return { vertexCount, triangleCount: triCount, nonManifoldEdges: nonManifold, degenerateTriangles: degenerate, components };
}

function norm(value: number, bits: number): number {
  return value === 0 ? 0 : bits;
}

/** Double de l'aire au carré (en float64 à partir des float32), pour tester les triangles plats. */
function triangleArea2(s: Float32Array, t: number): number {
  const o = t * 9;
  const ux = s[o + 3] - s[o];
  const uy = s[o + 4] - s[o + 1];
  const uz = s[o + 5] - s[o + 2];
  const vx = s[o + 6] - s[o];
  const vy = s[o + 7] - s[o + 1];
  const vz = s[o + 8] - s[o + 2];
  const cx = uy * vz - uz * vy;
  const cy = uz * vx - ux * vz;
  const cz = ux * vy - uy * vx;
  return cx * cx + cy * cy + cz * cz;
}

/** Maillage indexé → soupe de triangles float32. */
export function toTriangleSoup(positions: Float32Array, indices: Uint32Array, stride = 3): Float32Array {
  const out = new Float32Array(indices.length * 3);
  for (let i = 0; i < indices.length; i++) {
    const v = indices[i] * stride;
    out[i * 3] = positions[v];
    out[i * 3 + 1] = positions[v + 1];
    out[i * 3 + 2] = positions[v + 2];
  }
  return out;
}

/** Résumé lisible : true si le maillage est imprimable sans réparation. */
export function isPrintable(v: MeshValidation): boolean {
  return v.nonManifoldEdges === 0 && v.degenerateTriangles === 0 && v.components === 1 && v.triangleCount > 0;
}
