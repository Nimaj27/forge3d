/**
 * Opérations de l'atelier sur la scène : grouper, dégrouper, aligner, miroir, poser, ajouter.
 * Fonctions pures (la scène n'est jamais modifiée en place).
 */
import { Box3, Matrix4, Vector3 } from 'three';
import type { Part, Scene, SceneObject, Vec3 } from '../../shared/scene';
import type { Bounds } from '../geometry/types';
import { createGroup } from '../scene/factory';
import { matrixToTransform, transformToMatrix } from '../viewer/math';

export type BoundsOf = (id: string) => Bounds | null;

/** Boîte englobante monde d'un objet de premier niveau. */
export function worldBox(obj: SceneObject, local: Bounds | null): Box3 | null {
  if (!local) return null;
  const box = new Box3(new Vector3(...local.min), new Vector3(...local.max));
  return box.applyMatrix4(transformToMatrix(obj.transform));
}

function topLevel(scene: Scene, ids: readonly string[]): { part: Part; objects: SceneObject[] } | null {
  for (const part of scene.parts) {
    const objects = part.objects.filter((o) => ids.includes(o.id));
    if (objects.length) return { part, objects };
  }
  return null;
}

function unionBox(objects: SceneObject[], boundsOf: BoundsOf): Box3 | null {
  const box = new Box3();
  for (const o of objects) {
    const b = worldBox(o, boundsOf(o.id));
    if (b) box.union(b);
  }
  return box.isEmpty() ? null : box;
}

function mapTop(scene: Scene, partId: string, fn: (o: SceneObject) => SceneObject): Scene {
  return { ...scene, parts: scene.parts.map((p) => (p.id === partId ? { ...p, objects: p.objects.map(fn) } : p)) };
}

/** Groupe des objets de premier niveau d'une même pièce. */
export function groupObjects(scene: Scene, ids: readonly string[], boundsOf: BoundsOf): { scene: Scene; groupId: string } | null {
  const sel = topLevel(scene, ids);
  if (!sel || sel.objects.length < 2) return null;
  const box = unionBox(sel.objects, boundsOf);
  const origin = box ? new Vector3((box.min.x + box.max.x) / 2, (box.min.y + box.max.y) / 2, box.min.z) : new Vector3();
  const r = (v: number) => Math.round(v * 1000) / 1000;
  const children = sel.objects.map((o) => ({
    ...o,
    transform: {
      ...o.transform,
      position: [r(o.transform.position[0] - origin.x), r(o.transform.position[1] - origin.y), r(o.transform.position[2] - origin.z)] as Vec3,
    },
  }));
  const group = createGroup(children, 'Groupe', [r(origin.x), r(origin.y), r(origin.z)]);
  // le groupe prend la place du premier objet sélectionné dans la liste
  const firstIndex = sel.part.objects.findIndex((o) => ids.includes(o.id));
  const remaining = sel.part.objects.filter((o) => !ids.includes(o.id));
  remaining.splice(Math.min(firstIndex, remaining.length), 0, group);
  return {
    scene: { ...scene, parts: scene.parts.map((p) => (p.id === sel.part.id ? { ...p, objects: remaining } : p)) },
    groupId: group.id,
  };
}

/** Dégroupe : les enfants reprennent des transformations absolues. */
export function ungroupObject(scene: Scene, groupId: string): { scene: Scene; childIds: string[]; droppedHoles: number } | null {
  for (const part of scene.parts) {
    const index = part.objects.findIndex((o) => o.id === groupId);
    if (index < 0) continue;
    const group = part.objects[index];
    if (group.kind !== 'group') return null;
    const g = transformToMatrix(group.transform);
    let droppedHoles = 0;
    const children: SceneObject[] = [];
    for (const c of group.children) {
      // Un groupe « trou » : ses solides deviennent des trous ; ses trous internes n'ont plus de sens.
      if (group.mode === 'hole' && c.mode === 'hole') {
        droppedHoles++;
        continue;
      }
      const m = g.clone().multiply(transformToMatrix(c.transform));
      children.push({
        ...c,
        mode: group.mode === 'hole' ? 'hole' : c.mode,
        transform: matrixToTransform(m, !!c.transform.scale || !!group.transform.scale),
      });
    }
    const objects = [...part.objects];
    objects.splice(index, 1, ...children);
    return {
      scene: { ...scene, parts: scene.parts.map((p) => (p.id === part.id ? { ...p, objects } : p)) },
      childIds: children.map((c) => c.id),
      droppedHoles,
    };
  }
  return null;
}

export type AlignMode = 'min' | 'center' | 'max';

/** Aligne les objets sélectionnés sur leur boîte commune (ou sur le plateau s'il n'y en a qu'un). */
export function alignObjects(scene: Scene, ids: readonly string[], axis: 0 | 1 | 2, mode: AlignMode, boundsOf: BoundsOf): Scene {
  const sel = topLevel(scene, ids);
  if (!sel) return scene;
  const ref = sel.objects.length > 1 ? unionBox(sel.objects, boundsOf) : null;
  const key = (['x', 'y', 'z'] as const)[axis];
  return mapTop(scene, sel.part.id, (o) => {
    if (!ids.includes(o.id) || o.locked) return o;
    const b = worldBox(o, boundsOf(o.id));
    if (!b) return o;
    let target: number;
    if (ref) {
      target = mode === 'min' ? ref.min[key] : mode === 'max' ? ref.max[key] : (ref.min[key] + ref.max[key]) / 2;
    } else {
      // un seul objet : référence = plateau (centre en X/Y, dessus du plateau en Z)
      target = 0;
      if (axis === 2) mode = 'min';
    }
    const current = mode === 'min' ? b.min[key] : mode === 'max' ? b.max[key] : (b.min[key] + b.max[key]) / 2;
    const delta = target - current;
    if (Math.abs(delta) < 1e-6) return o;
    const position = [...o.transform.position] as Vec3;
    position[axis] = Math.round((position[axis] + delta) * 1000) / 1000;
    return { ...o, transform: { ...o.transform, position } };
  });
}

/** Pose la sélection sur le plateau (z min = 0), en bloc. */
export function dropOnBed(scene: Scene, ids: readonly string[], boundsOf: BoundsOf): Scene {
  const sel = topLevel(scene, ids);
  if (!sel) return scene;
  const box = unionBox(sel.objects, boundsOf);
  if (!box) return scene;
  const dz = -box.min.z;
  return mapTop(scene, sel.part.id, (o) =>
    ids.includes(o.id) && !o.locked
      ? { ...o, transform: { ...o.transform, position: [o.transform.position[0], o.transform.position[1], Math.round((o.transform.position[2] + dz) * 1000) / 1000] } }
      : o,
  );
}

/** Miroir de la sélection selon un axe, autour du centre de la sélection. */
export function mirrorObjects(scene: Scene, ids: readonly string[], axis: 0 | 1 | 2, boundsOf: BoundsOf): Scene {
  const sel = topLevel(scene, ids);
  if (!sel) return scene;
  const box = unionBox(sel.objects, boundsOf);
  const c = box ? box.getCenter(new Vector3()) : new Vector3();
  const s = new Vector3(1, 1, 1).setComponent(axis, -1);
  const mirror = new Matrix4()
    .makeTranslation(c.x, c.y, c.z)
    .multiply(new Matrix4().makeScale(s.x, s.y, s.z))
    .multiply(new Matrix4().makeTranslation(-c.x, -c.y, -c.z));
  return mapTop(scene, sel.part.id, (o) => {
    if (!ids.includes(o.id) || o.locked) return o;
    const m = mirror.clone().multiply(transformToMatrix(o.transform));
    return { ...o, transform: matrixToTransform(m, true) };
  });
}

/**
 * Convertit une mise à l'échelle du gizmo en paramètres (dimensions réelles) quand c'est possible ;
 * sinon conserve une échelle dans la transformation (texte, croquis, groupes…).
 */
export function applyScaleToObject(o: SceneObject, scale: Vec3, snap: boolean): SceneObject {
  const r = (v: number) => (snap ? Math.max(1, Math.round(v)) : Math.round(v * 100) / 100);
  const rr = (v: number) => (snap ? Math.max(0.5, Math.round(v * 2) / 2) : Math.round(v * 100) / 100);
  const [sx, sy, sz] = scale.map(Math.abs) as Vec3;
  const sxy = (sx + sy) / 2;
  switch (o.kind) {
    case 'box':
      return { ...o, params: { ...o.params, size: [r(o.params.size[0] * sx), r(o.params.size[1] * sy), r(o.params.size[2] * sz)] } };
    case 'cylinder':
      return { ...o, params: { ...o.params, radius: rr(o.params.radius * sxy), height: r(o.params.height * sz) } };
    case 'sphere':
      return { ...o, params: { ...o.params, radius: rr(o.params.radius * Math.max(sx, sy, sz)) } };
    case 'cone':
      return {
        ...o,
        params: { ...o.params, radiusBottom: rr(o.params.radiusBottom * sxy), radiusTop: rr(o.params.radiusTop * sxy), height: r(o.params.height * sz) },
      };
    case 'tube':
      return {
        ...o,
        params: { ...o.params, outerRadius: rr(o.params.outerRadius * sxy), innerRadius: rr(o.params.innerRadius * sxy), height: r(o.params.height * sz) },
      };
    default: {
      const prev = o.transform.scale ?? [1, 1, 1];
      const next = [prev[0] * scale[0], prev[1] * scale[1], prev[2] * scale[2]].map((v) => Math.round(v * 1000) / 1000) as Vec3;
      return { ...o, transform: { ...o.transform, scale: next } };
    }
  }
}

/** Place un nouvel objet à droite du contenu existant de la pièce (sans chevauchement). */
export function freeSpot(part: Part, boundsOf: BoundsOf, width: number): Vec3 {
  const box = unionBox(part.objects, boundsOf);
  if (!box) return [0, 0, 0];
  const x = Math.round(box.max.x + 10 + width / 2);
  return [x, Math.round((box.min.y + box.max.y) / 2), 0];
}
