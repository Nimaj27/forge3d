/** Définition commune des modèles paramétriques : (réglages) => Scène. */
import type { z } from 'zod';
import { parseScene, type Part, type Scene, type SceneObject, type Transform, type Vec3 } from '../../shared/scene';
import type { ExtraCheck } from '../components/ChecksPanel';
import type { TemplateId } from './catalog';

export type FieldType = 'text' | 'textarea' | 'number' | 'slider' | 'select' | 'toggle' | 'image' | 'font';

export interface TemplateField<P> {
  key: keyof P & string;
  label: string;
  type: FieldType;
  section: string;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  options?: { value: string; label: string }[];
  help?: string;
  /** Champ affiché seulement si la condition est vraie */
  showIf?: (p: P) => boolean;
}

export interface TemplateSection {
  id: string;
  label: string;
  /** Préfixes d'identifiants d'objets rattachés à cette section (sélection dans la liste) */
  objects?: string[];
}

export interface Printer {
  id: string;
  bed: Vec3;
}

export interface TemplateDef<P extends Record<string, unknown>> {
  id: TemplateId;
  name: string;
  defaults: P;
  schema: z.ZodType<P>;
  sections: TemplateSection[];
  fields: TemplateField<P>[];
  build: (params: P, printer: Printer) => Scene;
  /** Vérifications propres au modèle (ex. jeu tenon / mortaise) */
  extraChecks?: (params: P) => ExtraCheck[];
}

/** Objet de scène (identifiant stable, pour garder la sélection entre deux reconstructions). */
export function obj(
  id: string,
  name: string,
  kind: SceneObject['kind'],
  params: Record<string, unknown>,
  transform: Partial<Transform> = {},
  mode: 'solid' | 'hole' = 'solid',
  children?: unknown[],
): Record<string, unknown> {
  return {
    id,
    name,
    kind,
    mode,
    params,
    transform: { position: transform.position ?? [0, 0, 0], rotation: transform.rotation ?? [0, 0, 0], ...(transform.scale ? { scale: transform.scale } : {}) },
    ...(children ? { children } : {}),
  };
}

/** Assemble et valide la scène d'un modèle. */
export function templateScene(
  id: TemplateId,
  name: string,
  printer: Printer,
  parts: (Omit<Part, 'objects'> & { objects: Record<string, unknown>[] })[],
  params: Record<string, unknown>,
): Scene {
  return parseScene({
    version: 1,
    name,
    unit: 'mm',
    printer,
    layerHeight: 0.2,
    firstLayerHeight: 0.2,
    parts,
    template: { id, params },
  });
}

/** Aligne une hauteur sur un sommet de couche (pour des pauses de couleur nettes). */
export function snapToLayer(z: number, first = 0.2, layer = 0.2): number {
  if (z <= first) return first;
  return Math.round((first + Math.round((z - first) / layer) * layer) * 1e4) / 1e4;
}
