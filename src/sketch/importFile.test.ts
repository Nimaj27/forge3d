import { describe, expect, it } from 'vitest';
import { signedArea } from '../geometry/curves';
import { importDxf, importSvg } from './importFile';
import { shapePolygon } from './model';

/** Petit générateur de DXF ASCII pour les tests. */
function dxf(entities: string[], insunits = 4): string {
  const g = (code: number, value: string | number) => `${code}\n${value}\n`;
  return (
    g(0, 'SECTION') + g(2, 'HEADER') + g(9, '$INSUNITS') + g(70, insunits) + g(0, 'ENDSEC') +
    g(0, 'SECTION') + g(2, 'ENTITIES') + entities.join('') + g(0, 'ENDSEC') + g(0, 'EOF')
  );
}
const line = (x1: number, y1: number, x2: number, y2: number) => `0\nLINE\n8\n0\n10\n${x1}\n20\n${y1}\n30\n0\n11\n${x2}\n21\n${y2}\n31\n0\n`;
const arc = (cx: number, cy: number, r: number, a0: number, a1: number) => `0\nARC\n8\n0\n10\n${cx}\n20\n${cy}\n30\n0\n40\n${r}\n50\n${a0}\n51\n${a1}\n`;
const circle = (cx: number, cy: number, r: number) => `0\nCIRCLE\n8\n0\n10\n${cx}\n20\n${cy}\n30\n0\n40\n${r}\n`;
const lwpoly = (pts: [number, number, number?][], closed: boolean) =>
  `0\nLWPOLYLINE\n8\n0\n90\n${pts.length}\n70\n${closed ? 1 : 0}\n` + pts.map(([x, y, b]) => `10\n${x}\n20\n${y}\n${b ? `42\n${b}\n` : ''}`).join('');

const area = (s: Parameters<typeof shapePolygon>[0]) => Math.abs(signedArea(shapePolygon(s, 0.005)));

describe('import DXF / SVG', () => {
  it('relie lignes et arcs (dans le désordre) en un contour fermé', () => {
    // rectangle 40 × 20 dont le côté droit est remplacé par un demi-cercle
    const res = importDxf(dxf([line(0, 0, 40, 0), line(0, 20, 0, 0), arc(40, 10, 10, -90, 90), line(40, 20, 0, 20)]));
    expect(res.warnings).toEqual([]);
    expect(res.shapes).toHaveLength(1);
    expect(area(res.shapes[0])).toBeCloseTo(800 + (Math.PI * 100) / 2, 0);
  });

  it('polyligne fermée avec arrondis (bulge) et cercle', () => {
    const res = importDxf(dxf([lwpoly([[0, 0], [20, 0, 1], [20, 20], [0, 20]], true), circle(50, 10, 5)]));
    expect(res.shapes).toHaveLength(2);
    const [poly, circ] = res.shapes;
    // carré 20 × 20 + demi-disque de rayon 10 sur le côté droit (bulge 1)
    expect(area(poly)).toBeCloseTo(400 + (Math.PI * 100) / 2, 0);
    expect(circ.kind).toBe('circle');
  });

  it('convertit les pouces en millimètres', () => {
    const res = importDxf(dxf([circle(0, 0, 1)], 1));
    expect(res.shapes[0].kind === 'circle' && res.shapes[0].r).toBeCloseTo(25.4, 6);
  });

  it('signale les tracés ouverts', () => {
    const res = importDxf(dxf([line(0, 0, 10, 0), line(10, 0, 10, 10)]));
    expect(res.shapes).toHaveLength(0);
    expect(res.warnings.join(' ')).toContain('ouvert');
  });

  it('importe un SVG en chemins', () => {
    const res = importSvg('<svg viewBox="0 0 30 30" width="30mm" height="30mm"><rect x="5" y="5" width="20" height="10"/></svg>');
    expect(res.shapes).toHaveLength(1);
    expect(area(res.shapes[0])).toBeCloseTo(200, 3);
  });
});
