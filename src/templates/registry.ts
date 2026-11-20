/**
 * Registre des modèles paramétriques : construction, chargement dans l'éditeur, mise à jour des réglages.
 */
import type { Scene } from '../../shared/scene';
import type { ExtraCheck } from '../components/ChecksPanel';
import { resolvePrinter } from '../lib/printers';
import { useCurrentProject } from '../projects/projects';
import { useSceneStore } from '../store/sceneStore';
import { useSettings } from '../store/settingsStore';
import { boite } from './boite';
import type { TemplateId } from './catalog';
import { imageRelief } from './imageRelief';
import { plaque } from './plaque';
import { porteCles } from './porteCles';
import { supportTelephone } from './supportTelephone';
import { trophee } from './trophee';
import type { Printer, TemplateDef } from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTemplate = TemplateDef<any>;

export const TEMPLATES: Record<TemplateId, AnyTemplate> = {
  trophee,
  plaque,
  'porte-cles': porteCles,
  boite,
  'support-telephone': supportTelephone,
  'image-relief': imageRelief,
};

export function getTemplate(id: string): AnyTemplate | null {
  return (TEMPLATES as Record<string, AnyTemplate>)[id] ?? null;
}

/** Réglages complétés et validés (valeurs invalides → valeurs par défaut). */
export function normalizeParams(def: AnyTemplate, params: Record<string, unknown>): Record<string, unknown> {
  const merged = { ...def.defaults, ...params };
  const res = def.schema.safeParse(merged);
  if (res.success) return res.data as Record<string, unknown>;
  // on écarte les champs fautifs un par un
  const clean: Record<string, unknown> = { ...def.defaults };
  for (const [k, v] of Object.entries(params)) {
    const attempt = def.schema.safeParse({ ...clean, [k]: v });
    if (attempt.success) clean[k] = v;
  }
  return clean;
}

export function buildTemplate(id: string, params: Record<string, unknown>, printer: Printer): Scene {
  const def = getTemplate(id);
  if (!def) throw new Error(`Modèle inconnu : ${id}`);
  return def.build(normalizeParams(def, params), printer);
}

function currentPrinter(): Printer {
  const s = useSettings.getState();
  const p = resolvePrinter(s.printerId, s.customBed);
  return { id: p.id, bed: p.bed };
}

/** Ouvre un modèle avec ses réglages par défaut dans l'éditeur. */
export async function loadTemplate(id: string): Promise<boolean> {
  const def = getTemplate(id);
  if (!def) return false;
  useSceneStore.getState().setScene(def.build(def.defaults, currentPrinter()), { keepHistory: true });
  useCurrentProject.getState().setId(null);
  return true;
}

/** Modifie des réglages du modèle de la scène courante (annulable). */
export function updateTemplateParams(patch: Record<string, unknown>): void {
  const store = useSceneStore.getState();
  const t = store.scene.template;
  const def = t ? getTemplate(t.id) : null;
  if (!t || !def) return;
  const params = normalizeParams(def, { ...t.params, ...patch });
  const next = def.build(params, store.scene.printer);
  // conserve le nom donné par l'utilisateur et les couleurs choisies
  const colors = Object.fromEntries(store.scene.parts.map((p) => [p.id, p.colors]));
  store.update(() => ({
    ...next,
    name: store.scene.name,
    parts: next.parts.map((p) => (colors[p.id] ? { ...p, colors: colors[p.id] } : p)),
  }));
}

/** Vérifications propres au modèle courant. */
export function templateChecks(scene: Scene): ExtraCheck[] {
  const def = scene.template ? getTemplate(scene.template.id) : null;
  if (!def?.extraChecks || !scene.template) return [];
  return def.extraChecks(normalizeParams(def, scene.template.params));
}
