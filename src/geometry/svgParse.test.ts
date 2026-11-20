import { describe, expect, it } from 'vitest';
import { signedArea } from './curves';
import { parsePathData, parseSvg, svgSource } from './svgParse';

const area = (shape: { polygons: [number, number][][] }) => shape.polygons.reduce((s, p) => s + Math.abs(signedArea(p)), 0);

describe('analyse SVG', () => {
  it('convertit les unités en mm (viewBox + width en mm)', () => {
    const shapes = parseSvg('<svg xmlns="http://www.w3.org/2000/svg" width="40mm" height="20mm" viewBox="0 0 400 200"><rect x="0" y="0" width="400" height="200"/></svg>');
    expect(shapes).toHaveLength(1);
    expect(area(shapes[0])).toBeCloseTo(800, 3);
  });

  it('ignore les formes non remplies et les définitions', () => {
    const shapes = parseSvg(
      '<svg viewBox="0 0 10 10" width="10mm" height="10mm"><defs><rect width="10" height="10"/></defs><rect width="5" height="5" fill="none"/><circle cx="5" cy="5" r="2" style="fill:#000"/></svg>',
    );
    expect(shapes).toHaveLength(1);
    // polygone inscrit : à moins de 1 % de l'aire du cercle
    expect(Math.abs(area(shapes[0]) / (Math.PI * 4) - 1)).toBeLessThan(0.01);
  });

  it('applique les transformations des groupes', () => {
    const shapes = parseSvg('<svg viewBox="0 0 100 100" width="100mm" height="100mm"><g transform="translate(10 0) scale(2)"><rect width="5" height="5"/></g></svg>');
    const xs = shapes[0].polygons[0].map((p) => p[0]);
    expect(Math.min(...xs)).toBeCloseTo(10, 6);
    expect(Math.max(...xs)).toBeCloseTo(20, 6);
  });

  it('gère les commandes relatives, H/V, courbes et arcs (drapeaux collés)', () => {
    const polys = parsePathData('M0 0h10v10H0z m20 0 c0 5 5 5 5 0 s5-5 5 0 a5 5 0 105 5 q2 2 4 0 t4 0 z');
    expect(polys.length).toBe(2);
    expect(Math.abs(signedArea(polys[0]))).toBeCloseTo(100, 6);
  });

  it('respecte fill-rule="evenodd" (anneau)', () => {
    const shapes = parseSvg(
      '<svg viewBox="0 0 20 20" width="20mm" height="20mm"><path fill-rule="evenodd" d="M0 0H20V20H0Z M5 5H15V15H5Z"/></svg>',
    );
    expect(shapes[0].fillRule).toBe('EvenOdd');
    expect(shapes[0].polygons).toHaveLength(2);
  });

  it('décode une data URL', () => {
    const svg = '<svg viewBox="0 0 1 1"><rect width="1" height="1"/></svg>';
    expect(svgSource(`data:image/svg+xml;base64,${btoa(svg)}`)).toBe(svg);
    expect(svgSource(`data:image/svg+xml,${encodeURIComponent(svg)}`)).toBe(svg);
  });
});
