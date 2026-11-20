/**
 * Données d'affichage d'une scène : évaluations (aperçu), vérifications, éléments du viewer,
 * et corrections automatiques proposées par les vérifications.
 */
import { useMemo } from 'react';
import { Box3, Matrix4, Vector3 } from 'three';
import type { Part, Scene, Vec3 } from '../../shared/scene';
import { usePartEvaluations, usePartReports } from '../geometry/useEvaluation';
import type { Bounds, CheckFix, CheckLevel, PartEvaluation, PartReport } from '../geometry/types';
import { colorBands, pauseHeights } from '../lib/layers';
import { useSettings } from '../store/settingsStore';
import { matrixToTransform, transformToMatrix } from '../viewer/math';
import type { ViewerItem } from '../viewer/Viewer3D';

export interface SceneView {
  evaluations: Record<string, PartEvaluation>;
  reports: Record<string, PartReport>;
  items: ViewerItem[];
  /** Boîte englobante de l'assemblage */
  bounds: Bounds | null;
  evaluating: boolean;
  checking: boolean;
  /** Niveau global : erreur > avertissement > ok */
  status: CheckLevel;
}

export function useSceneView(scene: Scene, bed: Vec3): SceneView {
  const { evaluations, busy } = usePartEvaluations(scene.parts);
  const { reports, busy: checking } = usePartReports(scene.parts, bed);
  const filaments = useSettings((s) => s.filaments);

  const items = useMemo(() => {
    const out: ViewerItem[] = [];
    for (const p of scene.parts) {
      const ev = evaluations[p.id];
      if (!ev || ev.status !== 'ok' || !ev.mesh || !ev.bounds || !ev.printBounds) continue;
      const pauses = pauseHeights(p.colorChanges, scene.firstLayerHeight, scene.layerHeight);
      const bands = colorBands(pauses, scene.layerHeight, p.colors, filaments);
      out.push({
        id: p.id,
        hash: ev.hash,
        mesh: ev.mesh,
        printMatrix: ev.printMatrix,
        bounds: ev.bounds,
        printBounds: ev.printBounds,
        breaks: bands.slice(1).map((b) => b.from),
        colors: bands.map((b) => b.color),
      });
    }
    return out;
  }, [scene.parts, scene.firstLayerHeight, scene.layerHeight, evaluations, filaments]);

  const bounds = useMemo(() => {
    if (!items.length) return null;
    const box = new Box3();
    for (const it of items) {
      box.expandByPoint(new Vector3(...it.bounds.min));
      box.expandByPoint(new Vector3(...it.bounds.max));
    }
    return { min: [box.min.x, box.min.y, box.min.z] as Vec3, max: [box.max.x, box.max.y, box.max.z] as Vec3 };
  }, [items]);

  const status = useMemo<CheckLevel>(() => {
    const rs = scene.parts.map((p) => reports[p.id]).filter(Boolean);
    if (checking || rs.length < scene.parts.length) return 'pending';
    const levels = rs.flatMap((r) => r.checks.map((c) => c.level));
    if (levels.includes('error')) return 'error';
    if (levels.includes('warn')) return 'warn';
    return 'ok';
  }, [reports, checking, scene.parts]);

  return { evaluations, reports, items, bounds, evaluating: busy, checking, status };
}

/** Applique une matrice à tous les objets de premier niveau d'une pièce. */
export function transformPart(part: Part, m: Matrix4): Part {
  return {
    ...part,
    objects: part.objects.map((o) => {
      const world = m.clone().multiply(transformToMatrix(o.transform));
      return { ...o, transform: matrixToTransform(world, !!o.transform.scale) };
    }),
  };
}

/** Correction proposée par une vérification (poser à plat, pivoter, coucher). */
export function applyFix(part: Part, fix: CheckFix, ev: PartEvaluation | undefined): Part {
  if (!ev?.bounds) return part;
  const b = ev.bounds;
  const center = new Vector3((b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, 0);
  if (fix === 'dropToBed') {
    // pour une pièce couchée sur le dos, la pose est automatique : rien à faire
    if (part.printOrientation === 'flatOnBack') return part;
    return transformPart(part, new Matrix4().makeTranslation(0, 0, -b.min[2]));
  }
  if (fix === 'rotate90') {
    const m = new Matrix4()
      .makeTranslation(center.x, center.y, 0)
      .multiply(new Matrix4().makeRotationZ(Math.PI / 2))
      .multiply(new Matrix4().makeTranslation(-center.x, -center.y, 0));
    return transformPart(part, m);
  }
  // layFlat : la plus petite dimension devient la hauteur
  const size = [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]];
  const smallest = size.indexOf(Math.min(...size));
  if (smallest === 2) return part;
  const rot = smallest === 1 ? new Matrix4().makeRotationX(-Math.PI / 2) : new Matrix4().makeRotationY(Math.PI / 2);
  const box = new Box3(new Vector3(...b.min), new Vector3(...b.max)).applyMatrix4(rot);
  const m = new Matrix4().makeTranslation(-(box.min.x + box.max.x) / 2, -(box.min.y + box.max.y) / 2, -box.min.z).multiply(rot);
  return transformPart(part, m);
}
