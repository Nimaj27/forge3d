import Module from 'manifold-3d';
import opentype from 'opentype.js';
import { describe, expect, it } from 'vitest';
import { FONT_IDS, FONT_INFO, parseScene, type Part, type Vec2 } from '../../shared/scene';
import { isPrintable } from './meshCheck';
import { getNodeEngine, loadFontFromDisk } from './nodeEngine';
import { layoutText } from './text';

function part(objects: unknown[]): Part {
  return parseScene({ version: 1, printer: { id: 'x', bed: [220, 220, 220] }, parts: [{ id: 'p', objects }] }).parts[0];
}

describe('texte 3D', () => {
  it('les polices n’ont plus de contours qui se chevauchent (indispensable en EvenOdd)', async () => {
    const wasm = await Module();
    wasm.setup();
    for (const id of FONT_IDS) {
      const font = opentype.parse(await loadFontFromDisk(FONT_INFO[id].file));
      const layout = layoutText(font, { text: 'ABDEHKMNQRWXYZaegkmw48&ÉËÇŒ', capHeight: 20, align: 'center', letterSpacing: 0, lineSpacing: 1.5 });
      for (const glyph of layout.glyphs) {
        const eo = new wasm.CrossSection(glyph as Vec2[][], 'EvenOdd');
        const nz = new wasm.CrossSection(glyph as Vec2[][], 'NonZero');
        expect(Math.abs(eo.area() - nz.area()), `${id}`).toBeLessThan(0.05);
        eo.delete();
        nz.delete();
      }
    }
  });

  // H, I, L : sommets plats (O, C dépassent volontairement ; E et T de Cinzel ont des empattements évasés)
  it('la hauteur des capitales correspond au réglage, texte centré', async () => {
    const font = opentype.parse(await loadFontFromDisk(FONT_INFO.classique.file));
    const layout = layoutText(font, { text: 'HIL', capHeight: 10, align: 'center', letterSpacing: 0, lineSpacing: 1.5 });
    const ys = layout.glyphs.flat(2).map((p) => p[1]);
    const xs = layout.glyphs.flat(2).map((p) => p[0]);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(10, 1);
    expect(Math.min(...xs) + Math.max(...xs)).toBeCloseTo(0, 0);
  });

  it.each(FONT_IDS)('police « %s » : relief étanche et imprimable', async (font) => {
    const engine = await getNodeEngine();
    const p = part([
      { id: 'plaque', kind: 'box', params: { size: [90, 30, 3] } },
      {
        id: 't',
        kind: 'text',
        params: { text: 'Forge 3D\nÉTÉ 2026', font, capHeight: 7, depth: 1.5 },
        transform: { position: [0, 0, 2.5] },
      },
    ]);
    const ev = await engine.evaluatePart(p);
    expect(ev.status).toBe('ok');
    expect(ev.warnings).toEqual([]);
    expect(ev.bounds!.max[2]).toBeCloseTo(4, 3);
    const file = await engine.exportPart(p, 't.stl');
    expect(isPrintable(file.validation)).toBe(true);
  });

  it('texte sur un arc (rayon 60 mm) : lettres courbées, maillage valide', async () => {
    const engine = await getNodeEngine();
    const straight = await engine.evaluatePart(part([{ id: 't', kind: 'text', params: { text: 'DÉFIS SPORTIFS', font: 'classique', capHeight: 7 } }]));
    const arc = await engine.evaluatePart(
      part([{ id: 't', kind: 'text', params: { text: 'DÉFIS SPORTIFS', font: 'classique', capHeight: 7, onArc: { radius: 60, baselineOffset: 0 } } }]),
    );
    expect(arc.status).toBe('ok');
    const hs = (e: typeof arc) => e.bounds!.max[1] - e.bounds!.min[1];
    // le texte courbé occupe plus de hauteur que le texte droit
    expect(hs(arc)).toBeGreaterThan(hs(straight) + 2);
    const file = await engine.exportPart(part([{ id: 't', kind: 'text', params: { text: 'DÉFIS', capHeight: 7, onArc: { radius: -40, baselineOffset: 0 } } }]), 'a.stl');
    expect(file.validation.nonManifoldEdges).toBe(0);
  });

  it('signale les caractères absents', async () => {
    const engine = await getNodeEngine();
    const ev = await engine.evaluatePart(part([{ id: 't', kind: 'text', params: { text: 'Ok 漢', capHeight: 7 } }]));
    expect(ev.status).toBe('ok');
    expect(ev.warnings.join(' ')).toContain('漢');
  });
});
