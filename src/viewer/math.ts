/** Conversions entre transformations de la Scène et matrices three.js. */
import { Euler, MathUtils, Matrix4, Quaternion, Vector3 } from 'three';
import type { Scene, SceneObject, Transform, Vec3 } from '../../shared/scene';

/**
 * Ordre de rotation : X puis Y puis Z autour des axes fixes (comme manifold `rotate`),
 * soit l'ordre « ZYX » des angles d'Euler de three.js.
 */
export const EULER_ORDER = 'ZYX' as const;

export function transformToMatrix(t: Transform, out = new Matrix4()): Matrix4 {
  const q = new Quaternion().setFromEuler(
    new Euler(MathUtils.degToRad(t.rotation[0]), MathUtils.degToRad(t.rotation[1]), MathUtils.degToRad(t.rotation[2]), EULER_ORDER),
  );
  const s = t.scale ?? [1, 1, 1];
  return out.compose(new Vector3(...t.position), q, new Vector3(...s));
}

/** Matrice → transformation (rotation en degrés, arrondie au millième). */
export function matrixToTransform(m: Matrix4, keepScale: boolean): Transform {
  const pos = new Vector3();
  const q = new Quaternion();
  const s = new Vector3();
  m.decompose(pos, q, s);
  const e = new Euler().setFromQuaternion(q, EULER_ORDER);
  const r = (v: number) => Math.round(v * 1000) / 1000;
  const t: Transform = {
    position: [r(pos.x), r(pos.y), r(pos.z)],
    rotation: [r(MathUtils.radToDeg(e.x)), r(MathUtils.radToDeg(e.y)), r(MathUtils.radToDeg(e.z))],
  };
  if (keepScale && (Math.abs(s.x - 1) > 1e-6 || Math.abs(s.y - 1) > 1e-6 || Math.abs(s.z - 1) > 1e-6)) {
    t.scale = [r(s.x), r(s.y), r(s.z)];
  }
  return t;
}

/** Matrice monde d'un objet (produit des transformations de ses groupes parents). */
export function worldMatrixOf(scene: Scene, id: string): Matrix4 | null {
  for (const part of scene.parts) {
    const chain = pathTo(part.objects, id);
    if (chain) {
      const m = new Matrix4();
      for (const o of chain) m.multiply(transformToMatrix(o.transform));
      return m;
    }
  }
  return null;
}

/** Matrice monde du parent d'un objet (identité au premier niveau). */
export function parentMatrixOf(scene: Scene, id: string): Matrix4 {
  for (const part of scene.parts) {
    const chain = pathTo(part.objects, id);
    if (chain) {
      const m = new Matrix4();
      for (const o of chain.slice(0, -1)) m.multiply(transformToMatrix(o.transform));
      return m;
    }
  }
  return new Matrix4();
}

function pathTo(list: readonly SceneObject[], id: string): SceneObject[] | null {
  for (const o of list) {
    if (o.id === id) return [o];
    if (o.kind === 'group') {
      const sub = pathTo(o.children, id);
      if (sub) return [o, ...sub];
    }
  }
  return null;
}

export function vec3(v: Vector3): Vec3 {
  return [v.x, v.y, v.z];
}
