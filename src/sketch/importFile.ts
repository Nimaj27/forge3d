/**
 * Import SVG / DXF vers le croquis 2D : contours fermés en millimètres.
 */
import DxfParser from 'dxf-parser';
import { newId, type Vec2 } from '../../shared/scene';
import { parseSvg } from '../geometry/svgParse';
import { shapeBounds, type PathSeg, type SketchShape } from './model';

export interface ImportResult {
  shapes: SketchShape[];
  warnings: string[];
}

/** Simplification de Ramer-Douglas-Peucker (limite le nombre de points importés). */
export function simplifyPolygon(pts: Vec2[], eps: number): Vec2[] {
  if (pts.length < 4) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    let maxD = 0;
    let idx = -1;
    const [ax, ay] = pts[a];
    const [bx, by] = pts[b];
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / len;
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (maxD > eps && idx > 0) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

function polygonToPath(poly: Vec2[]): SketchShape {
  const pts = simplifyPolygon(poly, 0.02);
  return { id: newId('s'), kind: 'path', points: pts, segs: pts.map(() => ({ t: 'line' }) as PathSeg) };
}

export function importSvg(text: string): ImportResult {
  const shapes = parseSvg(text).flatMap((s) => s.polygons.filter((p) => p.length >= 3).map(polygonToPath));
  const warnings = shapes.length ? [] : ['Aucune forme remplie trouvée dans le SVG.'];
  return { shapes, warnings };
}

// ---------------------------------------------------------------------------
// DXF
// ---------------------------------------------------------------------------

interface Edge {
  a: Vec2;
  b: Vec2;
  seg: PathSeg;
}

const UNITS: Record<number, number> = { 1: 25.4, 2: 304.8, 4: 1, 5: 10, 6: 1000, 8: 0.0000254, 9: 0.0254, 10: 914.4 };

type DxfPoint = { x: number; y: number; bulge?: number };
type DxfEntity = Record<string, unknown> & { type: string };

function reverseEdge(e: Edge): Edge {
  const seg: PathSeg =
    e.seg.t === 'arc' ? { t: 'arc', bulge: -e.seg.bulge } : e.seg.t === 'bezier' ? { t: 'bezier', c1: e.seg.c2, c2: e.seg.c1 } : e.seg;
  return { a: e.b, b: e.a, seg };
}

function near(p: Vec2, q: Vec2, tol: number): boolean {
  return Math.abs(p[0] - q[0]) <= tol && Math.abs(p[1] - q[1]) <= tol;
}

/** Relie les segments isolés en contours fermés. */
export function chainEdges(edges: Edge[], tol = 0.01): { loops: Edge[][]; open: number } {
  const remaining = [...edges];
  const loops: Edge[][] = [];
  let open = 0;
  while (remaining.length) {
    const chain = [remaining.shift()!];
    let grown = true;
    while (grown && !near(chain[chain.length - 1].b, chain[0].a, tol)) {
      grown = false;
      const end = chain[chain.length - 1].b;
      for (let i = 0; i < remaining.length; i++) {
        const e = remaining[i];
        if (near(e.a, end, tol)) {
          chain.push(e);
        } else if (near(e.b, end, tol)) {
          chain.push(reverseEdge(e));
        } else continue;
        remaining.splice(i, 1);
        grown = true;
        break;
      }
    }
    if (near(chain[chain.length - 1].b, chain[0].a, tol) && chain.length >= 1) loops.push(chain);
    else open++;
  }
  return { loops, open };
}

/** Évaluation d'une B-spline (algorithme de de Boor). */
function bspline(ctrl: Vec2[], degree: number, knots: number[], samples: number): Vec2[] {
  const n = ctrl.length;
  if (!knots.length || knots.length !== n + degree + 1) {
    // nœuds uniformes bornés
    knots = [];
    for (let i = 0; i <= n + degree; i++) knots.push(Math.min(Math.max(i - degree, 0), n - degree));
  }
  const t0 = knots[degree];
  const t1 = knots[n];
  const out: Vec2[] = [];
  for (let s = 0; s <= samples; s++) {
    const t = Math.min(t1 - 1e-9, t0 + ((t1 - t0) * s) / samples);
    let k = degree;
    while (k < n - 1 && t >= knots[k + 1]) k++;
    const d: Vec2[] = [];
    for (let j = 0; j <= degree; j++) d.push([...ctrl[k - degree + j]] as Vec2);
    for (let r = 1; r <= degree; r++)
      for (let j = degree; j >= r; j--) {
        const i = k - degree + j;
        const den = knots[i + degree - r + 1] - knots[i];
        const alpha = den === 0 ? 0 : (t - knots[i]) / den;
        d[j] = [(1 - alpha) * d[j - 1][0] + alpha * d[j][0], (1 - alpha) * d[j - 1][1] + alpha * d[j][1]];
      }
    out.push(d[degree]);
  }
  return out;
}

export function importDxf(text: string): ImportResult {
  const warnings: string[] = [];
  const dxf = new DxfParser().parseSync(text);
  if (!dxf) return { shapes: [], warnings: ['Fichier DXF illisible.'] };
  const header = (dxf.header ?? {}) as Record<string, unknown>;
  const k = UNITS[Number(header.$INSUNITS)] ?? 1;
  const P = (p: { x: number; y: number }): Vec2 => [p.x * k, p.y * k];
  const shapes: SketchShape[] = [];
  const edges: Edge[] = [];
  let ignored = 0;

  for (const raw of (dxf.entities ?? []) as unknown as DxfEntity[]) {
    switch (raw.type) {
      case 'LINE': {
        const v = raw.vertices as DxfPoint[];
        if (v?.length >= 2) edges.push({ a: P(v[0]), b: P(v[1]), seg: { t: 'line' } });
        break;
      }
      case 'ARC': {
        const c = raw.center as DxfPoint;
        const r = (raw.radius as number) * k;
        const s = raw.startAngle as number;
        let e = raw.endAngle as number;
        while (e <= s) e += 2 * Math.PI;
        const sweep = e - s;
        const cx = c.x * k;
        const cy = c.y * k;
        edges.push({
          a: [cx + r * Math.cos(s), cy + r * Math.sin(s)],
          b: [cx + r * Math.cos(e), cy + r * Math.sin(e)],
          seg: { t: 'arc', bulge: Math.tan(sweep / 4) },
        });
        break;
      }
      case 'CIRCLE': {
        const c = raw.center as DxfPoint;
        shapes.push({ id: newId('s'), kind: 'circle', c: P(c), r: (raw.radius as number) * k });
        break;
      }
      case 'LWPOLYLINE':
      case 'POLYLINE': {
        const v = (raw.vertices as DxfPoint[]) ?? [];
        if (v.length < 2) break;
        const closed = !!raw.shape || near(P(v[0]), P(v[v.length - 1]), 1e-6);
        const pts = v.map(P);
        if (closed) {
          if (near(pts[0], pts[pts.length - 1], 1e-6)) pts.pop();
          shapes.push({
            id: newId('s'),
            kind: 'path',
            points: pts,
            segs: pts.map((_, i) => (v[i].bulge ? { t: 'arc', bulge: v[i].bulge! } : { t: 'line' })),
          });
        } else {
          for (let i = 0; i < pts.length - 1; i++)
            edges.push({ a: pts[i], b: pts[i + 1], seg: v[i].bulge ? { t: 'arc', bulge: v[i].bulge! } : { t: 'line' } });
        }
        break;
      }
      case 'ELLIPSE': {
        const c = raw.center as DxfPoint;
        const m = raw.majorAxisEndPoint as DxfPoint;
        const ratio = raw.axisRatio as number;
        const s = (raw.startAngle as number) ?? 0;
        let e = (raw.endAngle as number) ?? 2 * Math.PI;
        if (e <= s) e += 2 * Math.PI;
        const a = Math.hypot(m.x, m.y);
        const rot = Math.atan2(m.y, m.x);
        const n = 96;
        const pts: Vec2[] = [];
        for (let i = 0; i <= n; i++) {
          const t = s + ((e - s) * i) / n;
          const x = a * Math.cos(t);
          const y = a * ratio * Math.sin(t);
          pts.push([(c.x + x * Math.cos(rot) - y * Math.sin(rot)) * k, (c.y + x * Math.sin(rot) + y * Math.cos(rot)) * k]);
        }
        if (Math.abs(e - s - 2 * Math.PI) < 1e-6) shapes.push(polygonToPath(pts.slice(0, -1)));
        else for (let i = 0; i < pts.length - 1; i++) edges.push({ a: pts[i], b: pts[i + 1], seg: { t: 'line' } });
        break;
      }
      case 'SPLINE': {
        const fit = (raw.fitPoints as DxfPoint[] | undefined) ?? [];
        const ctrl = ((raw.controlPoints as DxfPoint[] | undefined) ?? []).map(P);
        const pts = fit.length >= 2 ? fit.map(P) : ctrl.length >= 2 ? bspline(ctrl, (raw.degreeOfSplineCurve as number) ?? 3, (raw.knotValues as number[]) ?? [], 96) : [];
        if (pts.length < 2) break;
        if (raw.closed || near(pts[0], pts[pts.length - 1], 1e-6)) shapes.push(polygonToPath(pts.slice(0, near(pts[0], pts[pts.length - 1], 1e-6) ? -1 : undefined)));
        else for (let i = 0; i < pts.length - 1; i++) edges.push({ a: pts[i], b: pts[i + 1], seg: { t: 'line' } });
        break;
      }
      default:
        ignored++;
    }
  }

  const { loops, open } = chainEdges(edges);
  for (const chain of loops) shapes.push({ id: newId('s'), kind: 'path', points: chain.map((e) => e.a), segs: chain.map((e) => e.seg) });
  if (open) warnings.push(`${open} tracé(s) ouvert(s) ignoré(s) : seuls les contours fermés sont importés.`);
  if (ignored) warnings.push(`${ignored} élément(s) non pris en charge ignoré(s) (texte, cotes…).`);
  if (!shapes.length) warnings.push('Aucun contour fermé trouvé dans le DXF.');
  return { shapes, warnings };
}

/** Lit un fichier choisi par l'utilisateur (SVG ou DXF). */
export async function importSketchFile(file: File): Promise<ImportResult> {
  const text = await file.text();
  const isDxf = /\.dxf$/i.test(file.name) || /^\s*0\s*\r?\n\s*SECTION/.test(text);
  const res = isDxf ? importDxf(text) : importSvg(text);
  // dessin très éloigné de l'origine : on le recentre
  const b = shapeBounds(res.shapes);
  if (b && (Math.abs(b.min[0]) > 300 || Math.abs(b.min[1]) > 300)) {
    const dx = -(b.min[0] + b.max[0]) / 2;
    const dy = -(b.min[1] + b.max[1]) / 2;
    res.shapes = res.shapes.map((s) => translateShape(s, dx, dy));
    res.warnings.push('Dessin recentré sur l’origine.');
  }
  return res;
}

export function translateShape(s: SketchShape, dx: number, dy: number): SketchShape {
  const t = (p: Vec2): Vec2 => [p[0] + dx, p[1] + dy];
  if (s.kind === 'path')
    return { ...s, points: s.points.map(t), segs: s.segs.map((g) => (g.t === 'bezier' ? { t: 'bezier', c1: t(g.c1), c2: t(g.c2) } : g)) };
  return { ...s, c: t(s.c) };
}
