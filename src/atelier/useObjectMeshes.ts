/**
 * Maillages individuels des objets (atelier) : un objet n'est recalculé que si sa forme change ;
 * un simple déplacement ne sollicite pas le worker.
 */
import { useEffect, useRef, useState } from 'react';
import type { SceneObject } from '../../shared/scene';
import { hashValue } from '../geometry/cache';
import { geometry } from '../geometry/client';
import type { Bounds, MeshData } from '../geometry/types';

export interface ObjectMesh {
  key: string;
  mesh: MeshData | null;
  bounds: Bounds | null;
  error?: string;
}

/** Empreinte de la forme d'un objet (sans position, rotation ni nom). */
export function shapeKey(o: SceneObject): string {
  if (o.kind === 'group') return hashValue({ k: 'group', c: o.children.map((c) => ({ ...c, name: undefined, locked: undefined })) });
  return hashValue({ k: o.kind, p: o.params });
}

export function useObjectMeshes(objects: readonly SceneObject[]): Record<string, ObjectMesh> {
  const [meshes, setMeshes] = useState<Record<string, ObjectMesh>>({});
  const inflight = useRef(new Map<string, string>());

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      for (const o of objects) {
        const key = shapeKey(o);
        if (meshes[o.id]?.key === key || inflight.current.get(o.id) === key) continue;
        inflight.current.set(o.id, key);
        void geometry()
          .evaluateObject(o)
          .then((r) => {
            if (inflight.current.get(o.id) !== key) return; // une version plus récente est en cours
            inflight.current.delete(o.id);
            if (cancelled && !r) return;
            setMeshes((prev) => ({ ...prev, [o.id]: { key, mesh: r.mesh, bounds: r.bounds, error: r.error } }));
          });
      }
      // nettoyage des objets supprimés
      setMeshes((prev) => {
        const ids = new Set(objects.map((o) => o.id));
        const stale = Object.keys(prev).filter((id) => !ids.has(id));
        if (!stale.length) return prev;
        const next = { ...prev };
        stale.forEach((id) => delete next[id]);
        return next;
      });
    }, 40);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // `meshes` est lu pour éviter les recalculs inutiles, sans relancer l'effet
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objects]);

  return meshes;
}
