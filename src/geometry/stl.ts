/** Écriture et lecture de STL binaire. */

const HEADER = 'Forge3D - https://forge3d.web.app - unites : mm';

/** Soupe de triangles (9 float32 par triangle) → STL binaire. */
export function writeBinaryStl(soup: Float32Array, header = HEADER): ArrayBuffer {
  const triCount = Math.floor(soup.length / 9);
  const buffer = new ArrayBuffer(84 + triCount * 50);
  const view = new DataView(buffer);
  const head = new TextEncoder().encode(header.slice(0, 80));
  new Uint8Array(buffer, 0, 80).set(head);
  view.setUint32(80, triCount, true);
  let off = 84;
  for (let t = 0; t < triCount; t++) {
    const o = t * 9;
    const ux = soup[o + 3] - soup[o];
    const uy = soup[o + 4] - soup[o + 1];
    const uz = soup[o + 5] - soup[o + 2];
    const vx = soup[o + 6] - soup[o];
    const vy = soup[o + 7] - soup[o + 1];
    const vz = soup[o + 8] - soup[o + 2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len;
    ny /= len;
    nz /= len;
    view.setFloat32(off, nx, true);
    view.setFloat32(off + 4, ny, true);
    view.setFloat32(off + 8, nz, true);
    off += 12;
    for (let k = 0; k < 9; k++) {
      view.setFloat32(off, soup[o + k], true);
      off += 4;
    }
    view.setUint16(off, 0, true);
    off += 2;
  }
  return buffer;
}

/** STL binaire → soupe de triangles (pour les tests et l'import). */
export function readBinaryStl(buffer: ArrayBuffer): Float32Array {
  const view = new DataView(buffer);
  const triCount = view.getUint32(80, true);
  if (84 + triCount * 50 !== buffer.byteLength) throw new Error('STL binaire invalide');
  const out = new Float32Array(triCount * 9);
  let off = 84;
  for (let t = 0; t < triCount; t++) {
    off += 12;
    for (let k = 0; k < 9; k++) {
      out[t * 9 + k] = view.getFloat32(off, true);
      off += 4;
    }
    off += 2;
  }
  return out;
}
