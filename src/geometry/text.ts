/**
 * Texte 3D : mise en page avec opentype.js, courbes aplaties, CrossSection en EvenOdd
 * (une par glyphe, puis union), épaississement des contours, texte sur arc.
 */
import type { CrossSection, Manifold, ManifoldToplevel, Vec2 as MVec2 } from 'manifold-3d';
import opentype from 'opentype.js';
import { FONT_INFO, type FontId, type TextParams, type Vec2 } from '../../shared/scene';
import { Arena } from './cache';
import { cleanPolygon, flattenCubic, flattenQuad } from './curves';

type Font = opentype.Font;

/** Chargeur de polices (fichiers TTF), mis en cache. */
export class FontLibrary {
  private cache = new Map<string, Promise<Font>>();
  constructor(private readonly load: (file: string) => Promise<ArrayBuffer>) {}

  get(id: FontId): Promise<Font> {
    const file = FONT_INFO[id]?.file ?? FONT_INFO.moderne.file;
    let p = this.cache.get(file);
    if (!p) {
      p = this.load(file).then((buf) => opentype.parse(buf));
      this.cache.set(file, p);
      p.catch(() => this.cache.delete(file));
    }
    return p;
  }
}

/**
 * Hauteur des capitales en unités de police : mesurée sur le glyphe « H » (plus fiable que
 * l'en-tête OS/2, parfois approximatif), pour que le réglage corresponde au relief imprimé.
 */
function capUnits(font: Font): number {
  const bb = font.charToGlyph('H').getBoundingBox();
  if (bb.y2 - bb.y1 > 0) return bb.y2 - Math.max(0, bb.y1);
  const os2 = font.tables.os2 as { sCapHeight?: number } | undefined;
  return os2?.sCapHeight && os2.sCapHeight > 0 ? os2.sCapHeight : font.unitsPerEm * 0.7;
}

/** Commandes d'un chemin opentype → polygones (y vers le haut, en mm). */
function pathToPolygons(path: opentype.Path, dx: number, dy: number, tol: number): Vec2[][] {
  const out: Vec2[][] = [];
  let cur: Vec2[] | null = null;
  let last: Vec2 = [0, 0];
  const P = (x: number, y: number): Vec2 => [x + dx, -y + dy];
  for (const c of path.commands) {
    switch (c.type) {
      case 'M':
        if (cur && cur.length > 2) out.push(cur);
        last = P(c.x, c.y);
        cur = [last];
        break;
      case 'L':
        last = P(c.x, c.y);
        cur?.push(last);
        break;
      case 'Q': {
        const end = P(c.x, c.y);
        if (cur) flattenQuad(last, P(c.x1, c.y1), end, tol, cur);
        last = end;
        break;
      }
      case 'C': {
        const end = P(c.x, c.y);
        if (cur) flattenCubic(last, P(c.x1, c.y1), P(c.x2, c.y2), end, tol, cur);
        last = end;
        break;
      }
      case 'Z':
        if (cur && cur.length > 2) out.push(cur);
        cur = null;
        break;
    }
  }
  if (cur && cur.length > 2) out.push(cur);
  return out.map((p) => cleanPolygon(p)).filter((p) => p.length >= 3);
}

export interface TextLayout {
  /** Polygones par glyphe (chaque glyphe : contours EvenOdd) */
  glyphs: Vec2[][][];
  /** Caractères absents de la police */
  missing: string[];
  width: number;
  height: number;
}

/** Met en page le texte (plusieurs lignes, alignement, crénage, espacement). Origine : centre du bloc. */
export function layoutText(font: Font, p: Pick<TextParams, 'text' | 'capHeight' | 'align' | 'letterSpacing' | 'lineSpacing'>, tol = 0.01): TextLayout {
  const fontSize = (p.capHeight * font.unitsPerEm) / capUnits(font);
  const scale = fontSize / font.unitsPerEm;
  const lines = p.text.replace(/\r/g, '').split('\n');
  const step = p.lineSpacing * p.capHeight;
  const glyphs: Vec2[][][] = [];
  const missing = new Set<string>();
  let maxWidth = 0;

  lines.forEach((line, li) => {
    const baseline = ((lines.length - 1) / 2 - li) * step - p.capHeight / 2;
    const gl = font.stringToGlyphs(line);
    // largeur de la ligne
    const advances: number[] = [];
    let width = 0;
    for (let i = 0; i < gl.length; i++) {
      const kern = i + 1 < gl.length ? font.getKerningValue(gl[i], gl[i + 1]) : 0;
      const adv = ((gl[i].advanceWidth ?? 0) + kern) * scale + (i + 1 < gl.length ? p.letterSpacing : 0);
      advances.push(adv);
      width += adv;
    }
    maxWidth = Math.max(maxWidth, width);
    let x = p.align === 'left' ? 0 : p.align === 'right' ? -width : -width / 2;
    const chars = Array.from(line);
    for (let i = 0; i < gl.length; i++) {
      const g = gl[i];
      if (g.index === 0 && chars[i] && chars[i].trim()) missing.add(chars[i]);
      else {
        const polys = pathToPolygons(g.getPath(0, 0, fontSize), x, baseline, tol);
        if (polys.length) glyphs.push(polys);
      }
      x += advances[i];
    }
  });
  return { glyphs, missing: [...missing], width: maxWidth, height: p.capHeight + (lines.length - 1) * step };
}

/** Subdivise les arêtes longues (avant une déformation non linéaire). */
function densify(poly: Vec2[], maxLen: number): Vec2[] {
  const out: Vec2[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    out.push(a);
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.ceil(len / maxLen);
    for (let k = 1; k < n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  return out;
}

/**
 * Déformation polaire (texte sur un arc) : x devient un angle sur le cercle de rayon R,
 * y une distance radiale. R > 0 : arc bombé vers le haut ; R < 0 : arc creusé.
 */
export function warpOnArc(poly: Vec2[], radius: number, baselineOffset = 0): Vec2[] {
  return densify(poly, 0.4).map(([x, y]) => {
    const r = radius + y + baselineOffset;
    const a = x / radius;
    return [r * Math.sin(a), r * Math.cos(a) - radius];
  });
}

/** Section 2D du texte (avant extrusion). */
export function textCrossSection(wasm: ManifoldToplevel, layout: TextLayout, p: TextParams, arena: Arena): CrossSection | null {
  const { CrossSection } = wasm;
  if (!layout.glyphs.length) return null;
  const sections = layout.glyphs.map((polys) => {
    const warped = p.onArc ? polys.map((poly) => warpOnArc(poly, p.onArc!.radius, p.onArc!.baselineOffset)) : polys;
    return arena.track(new CrossSection(warped as MVec2[][], 'EvenOdd'));
  });
  let cs = sections.length === 1 ? sections[0] : arena.track(CrossSection.union(sections));
  // Épaissit (empattements fins imprimables) puis sépare les contours qui se touchent en un point.
  const grow = Math.max(0, p.thicken) + 0.015;
  cs = arena.track(cs.offset(grow, 'Miter', 2));
  cs = arena.track(cs.offset(-0.015, 'Miter', 2));
  cs = arena.track(cs.simplify(0.001));
  return cs.isEmpty() ? null : cs;
}

/** Construit le texte en relief (origine : centre du bloc, base à z = 0). */
export async function buildText(wasm: ManifoldToplevel, fonts: FontLibrary, p: TextParams, warnings: string[]): Promise<Manifold | null> {
  if (!p.text.trim()) return null;
  const font = await fonts.get(p.font);
  const layout = layoutText(font, p);
  if (layout.missing.length) warnings.push(`Caractère(s) absent(s) de la police : ${layout.missing.join(' ')}`);
  const arena = new Arena();
  try {
    const cs = textCrossSection(wasm, layout, p, arena);
    if (!cs) return null;
    return cs.extrude(p.depth);
  } finally {
    arena.dispose();
  }
}
