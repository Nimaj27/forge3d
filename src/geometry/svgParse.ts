/**
 * Analyse SVG autonome (sans DOM : utilisable dans le Web Worker).
 * Formes remplies → polygones en mm (y vers le haut), avec leur règle de remplissage.
 * Prend en charge : path (toutes commandes, arcs compris), rect (rx/ry), circle, ellipse,
 * polygon, polyline, groupes et transformations (matrix, translate, scale, rotate, skewX/Y).
 */
import type { Vec2 } from '../../shared/scene';
import { cleanPolygon, flattenCubic, flattenQuad } from './curves';

export interface SvgShape {
  polygons: Vec2[][];
  fillRule: 'EvenOdd' | 'NonZero';
}

type Mat = [number, number, number, number, number, number]; // a b c d e f
const IDENTITY: Mat = [1, 0, 0, 1, 0, 0];

function mul(m: Mat, n: Mat): Mat {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

function apply(m: Mat, [x, y]: Vec2): Vec2 {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

function parseTransform(s: string | undefined): Mat {
  if (!s) return IDENTITY;
  let m = IDENTITY;
  const re = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g;
  let t: RegExpExecArray | null;
  while ((t = re.exec(s))) {
    const v = numbers(t[2]);
    let n: Mat = IDENTITY;
    switch (t[1]) {
      case 'matrix':
        if (v.length === 6) n = v as Mat;
        break;
      case 'translate':
        n = [1, 0, 0, 1, v[0] ?? 0, v[1] ?? 0];
        break;
      case 'scale':
        n = [v[0] ?? 1, 0, 0, v[1] ?? v[0] ?? 1, 0, 0];
        break;
      case 'rotate': {
        const a = ((v[0] ?? 0) * Math.PI) / 180;
        const c = Math.cos(a);
        const s2 = Math.sin(a);
        n = [c, s2, -s2, c, 0, 0];
        if (v.length >= 3) n = mul(mul([1, 0, 0, 1, v[1], v[2]], n), [1, 0, 0, 1, -v[1], -v[2]]);
        break;
      }
      case 'skewX':
        n = [1, 0, Math.tan(((v[0] ?? 0) * Math.PI) / 180), 1, 0, 0];
        break;
      case 'skewY':
        n = [1, Math.tan(((v[0] ?? 0) * Math.PI) / 180), 0, 1, 0, 0];
        break;
    }
    m = mul(m, n);
  }
  return m;
}

function numbers(s: string): number[] {
  return (s.match(/[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g) ?? []).map(Number);
}

function parseAttributes(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) out[m[1]] = m[2] ?? m[3] ?? '';
  if (out.style) {
    for (const decl of out.style.split(';')) {
      const i = decl.indexOf(':');
      if (i > 0) out[decl.slice(0, i).trim()] = decl.slice(i + 1).trim();
    }
  }
  return out;
}

/** Longueur SVG (avec unité) en mm ; `null` si absente. */
function lengthToMm(v: string | undefined): number | null {
  if (!v) return null;
  const m = /^\s*([-+]?[\d.]+(?:e[-+]?\d+)?)\s*(mm|cm|in|pt|pc|px)?\s*$/i.exec(v);
  if (!m) return null;
  const n = Number(m[1]);
  switch ((m[2] ?? 'px').toLowerCase()) {
    case 'mm':
      return n;
    case 'cm':
      return n * 10;
    case 'in':
      return n * 25.4;
    case 'pt':
      return (n * 25.4) / 72;
    case 'pc':
      return (n * 25.4) / 6;
    default:
      return (n * 25.4) / 96;
  }
}

// ---------------------------------------------------------------------------
// Chemins
// ---------------------------------------------------------------------------

/** Analyse l'attribut `d` → contours (polylignes, en unités utilisateur). */
export function parsePathData(d: string, tol = 0.05): Vec2[][] {
  const tokens = d.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g) ?? [];
  const out: Vec2[][] = [];
  let i = 0;
  let cmd = '';
  let cur: Vec2 = [0, 0];
  let start: Vec2 = [0, 0];
  let path: Vec2[] = [];
  let lastCtrl: Vec2 | null = null;
  let lastCmd = '';
  const isCmd = (t: string | undefined) => !!t && /^[a-zA-Z]$/.test(t);
  const num = () => Number(tokens[i++]);
  const flag = () => {
    // les drapeaux d'arc peuvent être collés (« 105 » = 1, 0, 5)
    const t = tokens[i];
    if (t === '0' || t === '1') {
      i++;
      return Number(t);
    }
    if (t && /^[01]/.test(t)) {
      tokens[i] = t.slice(1);
      return Number(t[0]);
    }
    i++;
    return Number(t) ? 1 : 0;
  };
  const flush = () => {
    if (path.length > 2) out.push(path);
    path = [];
  };

  while (i < tokens.length) {
    if (isCmd(tokens[i])) cmd = tokens[i++];
    else if (!cmd) {
      i++;
      continue;
    }
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    const pt = (x: number, y: number): Vec2 => (rel ? [cur[0] + x, cur[1] + y] : [x, y]);
    switch (C) {
      case 'M': {
        flush();
        cur = pt(num(), num());
        start = cur;
        path = [cur];
        cmd = rel ? 'l' : 'L'; // coordonnées suivantes = lignes
        break;
      }
      case 'L':
        cur = pt(num(), num());
        path.push(cur);
        break;
      case 'H':
        cur = [rel ? cur[0] + num() : num(), cur[1]];
        path.push(cur);
        break;
      case 'V':
        cur = [cur[0], rel ? cur[1] + num() : num()];
        path.push(cur);
        break;
      case 'C': {
        const c1 = pt(num(), num());
        const c2 = pt(num(), num());
        const end = pt(num(), num());
        flattenCubic(cur, c1, c2, end, tol, path);
        lastCtrl = c2;
        cur = end;
        break;
      }
      case 'S': {
        const c1: Vec2 = lastCtrl && /[CS]/i.test(lastCmd) ? [2 * cur[0] - lastCtrl[0], 2 * cur[1] - lastCtrl[1]] : cur;
        const c2 = pt(num(), num());
        const end = pt(num(), num());
        flattenCubic(cur, c1, c2, end, tol, path);
        lastCtrl = c2;
        cur = end;
        break;
      }
      case 'Q': {
        const c = pt(num(), num());
        const end = pt(num(), num());
        flattenQuad(cur, c, end, tol, path);
        lastCtrl = c;
        cur = end;
        break;
      }
      case 'T': {
        const c: Vec2 = lastCtrl && /[QT]/i.test(lastCmd) ? [2 * cur[0] - lastCtrl[0], 2 * cur[1] - lastCtrl[1]] : cur;
        const end = pt(num(), num());
        flattenQuad(cur, c, end, tol, path);
        lastCtrl = c;
        cur = end;
        break;
      }
      case 'A': {
        const rx = Math.abs(num());
        const ry = Math.abs(num());
        const rot = num();
        const large = flag();
        const sweep = flag();
        const end = pt(num(), num());
        arcTo(cur, end, rx, ry, rot, large, sweep, tol, path);
        cur = end;
        break;
      }
      case 'Z':
        cur = start;
        flush();
        path = [cur];
        break;
      default:
        i++;
    }
    if (!/[CSQT]/.test(C)) lastCtrl = null;
    lastCmd = C;
    if (i < tokens.length && isCmd(tokens[i])) continue;
  }
  flush();
  return out.map((p) => cleanPolygon(p)).filter((p) => p.length >= 3);
}

/** Arc elliptique SVG (paramétrage par extrémités) → points. */
function arcTo(p0: Vec2, p1: Vec2, rx: number, ry: number, rotDeg: number, large: number, sweep: number, tol: number, out: Vec2[]) {
  if (rx < 1e-9 || ry < 1e-9 || (p0[0] === p1[0] && p0[1] === p1[1])) {
    out.push(p1);
    return;
  }
  const phi = (rotDeg * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const dx = (p0[0] - p1[0]) / 2;
  const dy = (p0[1] - p1[1]) / 2;
  const x1 = cos * dx + sin * dy;
  const y1 = -sin * dx + cos * dy;
  const lambda = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
  if (lambda > 1) {
    rx *= Math.sqrt(lambda);
    ry *= Math.sqrt(lambda);
  }
  const num = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1;
  const den = rx * rx * y1 * y1 + ry * ry * x1 * x1;
  let coef = Math.sqrt(Math.max(0, num / den));
  if (large === sweep) coef = -coef;
  const cx1 = (coef * rx * y1) / ry;
  const cy1 = (-coef * ry * x1) / rx;
  const cx = cos * cx1 - sin * cy1 + (p0[0] + p1[0]) / 2;
  const cy = sin * cx1 + cos * cy1 + (p0[1] + p1[1]) / 2;
  const ang = (ux: number, uy: number, vx: number, vy: number) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const t1 = ang(1, 0, (x1 - cx1) / rx, (y1 - cy1) / ry);
  let dt = ang((x1 - cx1) / rx, (y1 - cy1) / ry, (-x1 - cx1) / rx, (-y1 - cy1) / ry);
  if (!sweep && dt > 0) dt -= 2 * Math.PI;
  if (sweep && dt < 0) dt += 2 * Math.PI;
  const r = Math.max(rx, ry);
  const stepAngle = 2 * Math.acos(Math.max(-1, 1 - tol / r));
  const n = Math.min(256, Math.max(2, Math.ceil(Math.abs(dt) / Math.max(stepAngle, 1e-3))));
  for (let k = 1; k <= n; k++) {
    const t = t1 + (dt * k) / n;
    const ex = rx * Math.cos(t);
    const ey = ry * Math.sin(t);
    out.push(k === n ? p1 : [cos * ex - sin * ey + cx, sin * ex + cos * ey + cy]);
  }
}

function ellipsePolygon(cx: number, cy: number, rx: number, ry: number, tol: number): Vec2[] {
  const r = Math.max(rx, ry);
  const n = Math.min(256, Math.max(12, Math.ceil(Math.PI / Math.acos(Math.max(-1, 1 - tol / r)))));
  const out: Vec2[] = [];
  for (let k = 0; k < n; k++) {
    const a = (2 * Math.PI * k) / n;
    out.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
  }
  return out;
}

function rectPolygon(x: number, y: number, w: number, h: number, rx: number, ry: number, tol: number): Vec2[] {
  if (rx <= 0 && ry <= 0) return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  rx = Math.min(rx || ry, w / 2);
  ry = Math.min(ry || rx, h / 2);
  const corner = (cx: number, cy: number, a0: number): Vec2[] => {
    const pts: Vec2[] = [];
    const n = Math.max(3, Math.ceil(Math.PI / 2 / (2 * Math.acos(Math.max(-1, 1 - tol / Math.max(rx, ry))))));
    for (let k = 0; k <= n; k++) {
      const a = a0 + ((Math.PI / 2) * k) / n;
      pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
    }
    return pts;
  };
  return cleanPolygon([
    ...corner(x + w - rx, y + ry, -Math.PI / 2),
    ...corner(x + w - rx, y + h - ry, 0),
    ...corner(x + rx, y + h - ry, Math.PI / 2),
    ...corner(x + rx, y + ry, Math.PI),
  ]);
}

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------

const SKIP = new Set(['defs', 'clipPath', 'mask', 'style', 'title', 'desc', 'metadata', 'symbol', 'pattern', 'marker', 'linearGradient', 'radialGradient', 'script', 'text']);

/** Décode une data URL SVG ou renvoie le texte tel quel. */
export function svgSource(src: string): string {
  const m = /^data:image\/svg\+xml(;base64)?,(.*)$/s.exec(src);
  if (!m) return src;
  if (m[1]) {
    const bin = atob(m[2]);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }
  return decodeURIComponent(m[2]);
}

/** Analyse un SVG : formes remplies en mm, axe y vers le haut. */
export function parseSvg(source: string, tolMm = 0.01): SvgShape[] {
  const text = svgSource(source).replace(/<!--[\s\S]*?-->/g, '').replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '');
  const tagRe = /<(\/?)([a-zA-Z][\w:-]*)([^>]*?)(\/?)>/g;
  const stack: { tag: string; m: Mat; fill: string; rule: string; display: boolean }[] = [];
  const shapes: SvgShape[] = [];
  let root: Mat = IDENTITY;
  let tol = tolMm / (25.4 / 96);
  let skipDepth = 0;
  let m: RegExpExecArray | null;

  while ((m = tagRe.exec(text))) {
    const [, closing, rawTag, attrText, selfClose] = m;
    const tag = rawTag.replace(/^svg:/, '');
    if (closing) {
      if (skipDepth > 0) {
        skipDepth--;
        continue;
      }
      stack.pop();
      continue;
    }
    if (skipDepth > 0 || SKIP.has(tag)) {
      if (!selfClose) skipDepth++;
      continue;
    }
    const a = parseAttributes(attrText);
    const parent = stack[stack.length - 1];
    if (tag === 'svg' && !parent) {
      // unités : viewBox → mm selon width/height
      const vb = a.viewBox ? numbers(a.viewBox) : null;
      const wmm = lengthToMm(a.width);
      const hmm = lengthToMm(a.height);
      if (vb && vb.length === 4 && vb[2] > 0 && vb[3] > 0) {
        const sx = wmm ? wmm / vb[2] : hmm ? hmm / vb[3] : 25.4 / 96;
        const sy = hmm ? hmm / vb[3] : sx;
        root = [sx, 0, 0, sy, -vb[0] * sx, -vb[1] * sy];
      } else {
        root = [25.4 / 96, 0, 0, 25.4 / 96, 0, 0];
      }
      // tolérance d'aplatissement exprimée en mm, convertie en unités utilisateur
      tol = tolMm / Math.max(1e-9, Math.sqrt(Math.abs(root[0] * root[3])));
    }
    const base = parent?.m ?? root;
    const ctx = {
      tag,
      m: mul(base, parseTransform(a.transform)),
      fill: a.fill ?? parent?.fill ?? 'black',
      rule: a['fill-rule'] ?? parent?.rule ?? 'nonzero',
      display: (a.display ?? '') !== 'none' && (a.visibility ?? '') !== 'hidden' && (parent?.display ?? true),
    };
    if (!selfClose) stack.push(ctx);

    if (!ctx.display || ctx.fill === 'none' || ctx.fill === 'transparent') continue;
    const n = (k: string) => Number(a[k] ?? 0) || 0;
    let polys: Vec2[][] = [];
    switch (tag) {
      case 'path':
        polys = parsePathData(a.d ?? '', tol);
        break;
      case 'rect':
        if (n('width') > 0 && n('height') > 0) polys = [rectPolygon(n('x'), n('y'), n('width'), n('height'), n('rx'), n('ry'), tol)];
        break;
      case 'circle':
        if (n('r') > 0) polys = [ellipsePolygon(n('cx'), n('cy'), n('r'), n('r'), tol)];
        break;
      case 'ellipse':
        if (n('rx') > 0 && n('ry') > 0) polys = [ellipsePolygon(n('cx'), n('cy'), n('rx'), n('ry'), tol)];
        break;
      case 'polygon':
      case 'polyline': {
        const v = numbers(a.points ?? '');
        const pts: Vec2[] = [];
        for (let k = 0; k + 1 < v.length; k += 2) pts.push([v[k], v[k + 1]]);
        if (pts.length >= 3) polys = [pts];
        break;
      }
    }
    if (!polys.length) continue;
    // y du SVG vers le bas → y vers le haut
    const world = polys.map((poly) => poly.map((p) => apply(ctx.m, p)).map(([x, y]) => [x, -y] as Vec2));
    shapes.push({ polygons: world, fillRule: ctx.rule === 'evenodd' ? 'EvenOdd' : 'NonZero' });
  }
  return shapes;
}
