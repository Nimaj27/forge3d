/**
 * Export des STL (un fichier binaire par pièce) et du projet complet (.zip).
 * Avant l'export, chaque maillage est vérifié comme le ferait un slicer.
 */
import JSZip from 'jszip';
import type { Part, Scene } from '../../shared/scene';
import { geometry } from '../geometry/client';
import { isPrintable } from '../geometry/meshCheck';
import type { ExportedFile } from '../geometry/types';
import { downloadBlob, safeFileName } from './download';
import { mm } from './format';
import { pauseHeights } from './layers';

export interface ExportResult {
  files: ExportedFile[];
  warnings: string[];
}

function printableParts(scene: Scene): Part[] {
  return scene.parts.filter((p) => p.objects.some((o) => !o.hidden));
}

export function stlFileName(scene: Scene, part: Part): string {
  const multi = printableParts(scene).length > 1;
  return multi ? `${safeFileName(part.name, 'piece')}.stl` : `${safeFileName(scene.name)}.stl`;
}

/** Calcule les STL de toutes les pièces (dans le worker). */
export async function buildStlFiles(scene: Scene): Promise<ExportResult> {
  const parts = printableParts(scene);
  if (!parts.length) throw new Error('Rien à exporter : la scène est vide.');
  const files: ExportedFile[] = [];
  const warnings: string[] = [];
  for (const part of parts) {
    const file = await geometry().exportPart(part, stlFileName(scene, part));
    files.push(file);
    const v = file.validation;
    if (!isPrintable(v)) {
      const issues: string[] = [];
      if (v.nonManifoldEdges) issues.push(`${v.nonManifoldEdges} arête(s) non-manifold`);
      if (v.degenerateTriangles) issues.push(`${v.degenerateTriangles} triangle(s) dégénéré(s)`);
      if (v.components > 1) issues.push(`${v.components} blocs séparés`);
      warnings.push(`« ${part.name} » : ${issues.join(', ')}.`);
    }
  }
  return { files, warnings };
}

/** Télécharge les STL : un fichier par pièce, ou une archive si `zip`. */
export async function exportStl(scene: Scene, opts: { zip?: boolean } = {}): Promise<ExportResult> {
  const result = await buildStlFiles(scene);
  if (result.files.length === 1) {
    const f = result.files[0];
    downloadBlob(new Blob([f.data], { type: 'model/stl' }), f.fileName);
  } else if (opts.zip) {
    const zip = new JSZip();
    for (const f of result.files) zip.file(f.fileName, f.data);
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    downloadBlob(blob, `${safeFileName(scene.name)}-stl.zip`);
  } else {
    for (const f of result.files) {
      downloadBlob(new Blob([f.data], { type: 'model/stl' }), f.fileName);
      await new Promise((r) => setTimeout(r, 350));
    }
  }
  return result;
}

/** Texte d'accompagnement : pauses de couleur à régler dans le slicer. */
export function printNotes(scene: Scene): string {
  const lines = [
    `Forge3D — ${scene.name}`,
    `Hauteur de couche : ${mm(scene.layerHeight, 2)} (première couche : ${mm(scene.firstLayerHeight, 2)})`,
    '',
  ];
  for (const part of printableParts(scene)) {
    const pauses = pauseHeights(part.colorChanges, scene.firstLayerHeight, scene.layerHeight);
    lines.push(`${stlFileName(scene, part)} :`);
    if (pauses.length) for (const p of pauses) lines.push(`  - Pause à ${mm(p, 2)} (changement de filament)`);
    else lines.push('  - Une seule couleur');
    lines.push('');
  }
  lines.push('Fichiers STL en millimètres. Projet modifiable : ouvrez le fichier .forge3d.json dans Forge3D.');
  return lines.join('\n');
}

/** Archive complète : STL + projet .forge3d.json + notes d'impression. */
export async function exportProjectZip(scene: Scene): Promise<ExportResult> {
  const result = await buildStlFiles(scene);
  const zip = new JSZip();
  const base = safeFileName(scene.name);
  for (const f of result.files) zip.file(f.fileName, f.data);
  zip.file(`${base}.forge3d.json`, JSON.stringify(scene, null, 2));
  zip.file('LISEZMOI.txt', printNotes(scene));
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  downloadBlob(blob, `${base}.zip`);
  return result;
}
