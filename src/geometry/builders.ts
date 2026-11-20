/**
 * Constructeurs asynchrones branchés sur le moteur : texte (polices TTF), dessin SVG, image.
 */
import type { CrossSection, Manifold, ManifoldToplevel, Vec2 as MVec2 } from 'manifold-3d';
import type { SvgParams } from '../../shared/scene';
import { Arena } from './cache';
import type { PrimitiveBuilders } from './primitives';
import { parseSvg } from './svgParse';
import { buildText, FontLibrary } from './text';

export interface BuilderDeps {
  /** Charge un fichier de police TTF (nom de fichier dans public/fonts) */
  loadFont: (file: string) => Promise<ArrayBuffer>;
}

export function createBuilders(deps: BuilderDeps): PrimitiveBuilders & { fonts: FontLibrary } {
  const fonts = new FontLibrary(deps.loadFont);
  return {
    fonts,
    text: (wasm, obj, warnings) => buildText(wasm, fonts, obj.params, warnings),
    svg: async (wasm, obj, warnings) => buildSvg(wasm, obj.params, warnings),
  };
}

/** Section 2D d'un SVG, mise à la largeur demandée et centrée sur l'origine. */
export function svgCrossSection(wasm: ManifoldToplevel, src: string, width: number, arena: Arena): CrossSection | null {
  const { CrossSection } = wasm;
  const shapes = parseSvg(src);
  if (!shapes.length) return null;
  const sections = shapes.map((s) => arena.track(new CrossSection(s.polygons as MVec2[][], s.fillRule)));
  let cs = sections.length === 1 ? sections[0] : arena.track(CrossSection.union(sections));
  if (cs.isEmpty()) return null;
  const b = cs.bounds();
  const w = b.max[0] - b.min[0];
  if (w <= 0) return null;
  const k = width / w;
  cs = arena.track(cs.translate([-(b.min[0] + b.max[0]) / 2, -(b.min[1] + b.max[1]) / 2]));
  cs = arena.track(cs.scale(k));
  // pincements séparés
  cs = arena.track(cs.offset(-0.015, 'Miter', 2));
  cs = arena.track(cs.offset(0.015, 'Miter', 2));
  return cs.isEmpty() ? null : cs;
}

export function buildSvg(wasm: ManifoldToplevel, p: SvgParams, warnings: string[]): Manifold | null {
  const arena = new Arena();
  try {
    const cs = svgCrossSection(wasm, p.src, p.width, arena);
    if (!cs) {
      warnings.push('Dessin SVG : aucune forme remplie trouvée.');
      return null;
    }
    return cs.extrude(p.depth);
  } catch (err) {
    warnings.push(`Dessin SVG illisible (${err instanceof Error ? err.message : 'erreur'}).`);
    return null;
  } finally {
    arena.dispose();
  }
}
