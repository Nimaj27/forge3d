/**
 * Opérations immuables sur la Scène (aucune mutation : on renvoie de nouveaux objets).
 */
import { newId, type Part, type Scene, type SceneObject, type Transform, type Vec3 } from '../../shared/scene';

/** Trouve un objet (récursivement) et sa pièce. */
export function findObject(scene: Scene, id: string): { object: SceneObject; part: Part; parent: SceneObject | null } | null {
  for (const part of scene.parts) {
    const found = findIn(part.objects, id, null);
    if (found) return { ...found, part };
  }
  return null;
}

function findIn(list: readonly SceneObject[], id: string, parent: SceneObject | null): { object: SceneObject; parent: SceneObject | null } | null {
  for (const o of list) {
    if (o.id === id) return { object: o, parent };
    if (o.kind === 'group') {
      const f = findIn(o.children, id, o);
      if (f) return f;
    }
  }
  return null;
}

/** Applique `fn` à l'objet `id` où qu'il soit dans l'arbre. */
export function updateObject(scene: Scene, id: string, fn: (o: SceneObject) => SceneObject): Scene {
  let changed = false;
  const mapList = (list: SceneObject[]): SceneObject[] => {
    let listChanged = false;
    const out = list.map((o) => {
      if (o.id === id) {
        const next = fn(o);
        if (next !== o) {
          listChanged = changed = true;
        }
        return next;
      }
      if (o.kind === 'group') {
        const children = mapList(o.children);
        if (children !== o.children) {
          listChanged = true;
          return { ...o, children };
        }
      }
      return o;
    });
    return listChanged ? out : list;
  };
  const parts = scene.parts.map((p) => {
    const objects = mapList(p.objects);
    return objects === p.objects ? p : { ...p, objects };
  });
  return changed ? { ...scene, parts } : scene;
}

/** Fusionne des paramètres dans l'objet. */
export function patchParams(scene: Scene, id: string, patch: Record<string, unknown>): Scene {
  return updateObject(scene, id, (o) => ({ ...o, params: { ...o.params, ...patch } }) as SceneObject);
}

export function patchTransform(scene: Scene, id: string, patch: Partial<Transform>): Scene {
  return updateObject(scene, id, (o) => ({ ...o, transform: { ...o.transform, ...patch } }));
}

/** Supprime des objets (à toute profondeur). */
export function removeObjects(scene: Scene, ids: readonly string[]): Scene {
  const set = new Set(ids);
  const filter = (list: SceneObject[]): SceneObject[] =>
    list
      .filter((o) => !set.has(o.id))
      .map((o) => (o.kind === 'group' ? { ...o, children: filter(o.children) } : o));
  return { ...scene, parts: scene.parts.map((p) => ({ ...p, objects: filter(p.objects) })) };
}

/** Ajoute un objet à la fin d'une pièce (la première si non précisée). */
export function addObject(scene: Scene, obj: SceneObject, partId?: string): Scene {
  const target = partId ?? scene.parts[0]?.id;
  return {
    ...scene,
    parts: scene.parts.map((p) => (p.id === target ? { ...p, objects: [...p.objects, obj] } : p)),
  };
}

/** Copie profonde avec de nouveaux identifiants. */
export function cloneWithNewIds(obj: SceneObject): SceneObject {
  const copy = structuredClone(obj);
  const renew = (o: SceneObject) => {
    o.id = newId(o.kind === 'group' ? 'g' : 'o');
    if (o.kind === 'group') o.children.forEach(renew);
  };
  renew(copy);
  return copy;
}

/** Duplique des objets de premier niveau d'une pièce, décalés de `offset`. */
export function duplicateObjects(scene: Scene, ids: readonly string[], offset: Vec3 = [10, 10, 0]): { scene: Scene; newIds: string[] } {
  const newIds: string[] = [];
  const parts = scene.parts.map((p) => {
    const extra: SceneObject[] = [];
    for (const o of p.objects) {
      if (!ids.includes(o.id)) continue;
      const c = cloneWithNewIds(o);
      c.name = o.name ? `${o.name} (copie)` : '';
      const pos = c.transform.position;
      c.transform = { ...c.transform, position: [pos[0] + offset[0], pos[1] + offset[1], pos[2] + offset[2]] };
      extra.push(c);
      newIds.push(c.id);
    }
    return extra.length ? { ...p, objects: [...p.objects, ...extra] } : p;
  });
  return { scene: { ...scene, parts }, newIds };
}

/** Pièce qui contient l'objet de premier niveau `id`. */
export function partOfObject(scene: Scene, id: string): Part | undefined {
  return scene.parts.find((p) => findIn(p.objects, id, null));
}

/** Liste « à plat » des objets d'une pièce, avec profondeur. */
export function flattenObjects(list: readonly SceneObject[], depth = 0): { object: SceneObject; depth: number }[] {
  const out: { object: SceneObject; depth: number }[] = [];
  for (const o of list) {
    out.push({ object: o, depth });
    if (o.kind === 'group') out.push(...flattenObjects(o.children, depth + 1));
  }
  return out;
}

/** Remplace une pièce. */
export function updatePart(scene: Scene, partId: string, fn: (p: Part) => Part): Scene {
  return { ...scene, parts: scene.parts.map((p) => (p.id === partId ? fn(p) : p)) };
}
