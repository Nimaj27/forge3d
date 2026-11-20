/**
 * Plan de croquis 2D (SVG) : dessin de chemins (lignes, courbes, arcs), cercles, rectangles,
 * polygones ; poignées d'édition ; aimantation (grille 1 mm, points, axe) ; zoom et déplacement
 * à la souris ou au toucher (pincer). Coordonnées en mm, y vers le haut.
 */
import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from 'react';
import { newId, type Vec2 } from '../../shared/scene';
import { formatNumber } from '../lib/format';
import {
  bulgeFromHandle,
  distanceToPolygon,
  mirrorShape,
  pointInPolygon,
  polygonPoints,
  segmentHandle,
  segmentLength,
  shapeBounds,
  shapePolygon,
  type PathSeg,
  type SketchShape,
} from './model';
import { useSketchStore, type SketchTool } from './sketchStore';

export interface DraftInfo {
  tool: SketchTool;
  points: number;
  /** Dernier point posé */
  last: Vec2 | null;
  cursor: Vec2 | null;
  length: number | null;
  angle: number | null;
}

/** Commandes exposées au panneau « Précision ». */
export interface SketchCanvasHandle {
  /** Ajoute un point à une distance et un angle exacts du dernier point */
  addRelative: (length: number, angleDeg: number) => void;
  /** Ajoute un point à des coordonnées exactes */
  addAbsolute: (p: Vec2) => void;
  close: () => void;
  cancel: () => void;
  undoPoint: () => void;
  fit: () => void;
}

interface SketchCanvasProps {
  tool: SketchTool;
  snap: boolean;
  showDims: boolean;
  revolve: boolean;
  polygonSides: number;
  rectRadius: number;
  onDraft?: (info: DraftInfo | null) => void;
  onShapeCreated?: () => void;
  handleRef?: Ref<SketchCanvasHandle>;
  onGridStep?: (step: number) => void;
}

type Drag =
  | { kind: 'pan'; startClient: Vec2; startView: View; moved: boolean }
  | { kind: 'vertex'; shapeId: string; index: number; moved: boolean }
  | { kind: 'mid'; shapeId: string; index: number; moved: boolean }
  | { kind: 'move'; shapeId: string; startWorld: Vec2; orig: SketchShape; moved: boolean }
  | { kind: 'radius'; shapeId: string; moved: boolean }
  | { kind: 'corner'; shapeId: string; moved: boolean };

interface View {
  cx: number;
  cy: number;
  s: number;
}

const ACCENT = 'var(--accent)';
const HANDLE_PX = 10;

export function SketchCanvas(props: SketchCanvasProps) {
  const { tool, snap, showDims, revolve, polygonSides, rectRadius, onDraft, onShapeCreated, handleRef, onGridStep } = props;
  const shapes = useSketchStore((s) => s.shapes);
  const selectedShape = useSketchStore((s) => s.selectedShape);
  const selectedVertex = useSketchStore((s) => s.selectedVertex);
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 600, h: 500 });
  const [view, setView] = useState<View>({ cx: 20, cy: 40, s: 5 });
  const [cursor, setCursor] = useState<Vec2 | null>(null);
  const [draft, setDraft] = useState<{ points: Vec2[]; kinds: PathSeg['t'][] } | null>(null);
  const [anchor, setAnchor] = useState<Vec2 | null>(null); // cercle / rectangle / polygone
  const drag = useRef<Drag | null>(null);
  const pointers = useRef(new Map<number, Vec2>());
  const pinch = useRef<{ dist: number; mid: Vec2; view: View } | null>(null);

  // Taille du conteneur
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: Math.max(100, e.contentRect.width), h: Math.max(100, e.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const toScreen = useCallback(([x, y]: Vec2): Vec2 => [size.w / 2 + (x - view.cx) * view.s, size.h / 2 - (y - view.cy) * view.s], [size, view]);
  const toWorld = useCallback((sx: number, sy: number): Vec2 => [view.cx + (sx - size.w / 2) / view.s, view.cy - (sy - size.h / 2) / view.s], [size, view]);

  const fit = useCallback(() => {
    const b = shapeBounds(useSketchStore.getState().shapes);
    const min: Vec2 = b ? [Math.min(b.min[0], revolve ? -b.max[0] : b.min[0]), b.min[1]] : [-40, -10];
    const max: Vec2 = b ? [Math.max(b.max[0], 1), b.max[1]] : [60, 90];
    const w = Math.max(10, max[0] - min[0]);
    const h = Math.max(10, max[1] - min[1]);
    const s = Math.min(60, Math.max(0.5, Math.min(size.w / (w * 1.35), size.h / (h * 1.35))));
    setView({ cx: (min[0] + max[0]) / 2, cy: (min[1] + max[1]) / 2, s });
  }, [size, revolve]);

  // Cadrage initial quand la taille est connue
  const fitted = useRef(false);
  useEffect(() => {
    if (!fitted.current && size.w > 100) {
      fitted.current = true;
      fit();
    }
  }, [size, fit]);

  // Pas de grille adapté au zoom
  const gridStep = useMemo(() => [1, 2, 5, 10, 20, 50, 100].find((g) => g * view.s >= 12) ?? 100, [view.s]);
  useEffect(() => onGridStep?.(gridStep), [gridStep, onGridStep]);

  // ---------------------------------------------------------------------------
  // Aimantation
  // ---------------------------------------------------------------------------
  const snapPoint = useCallback(
    (p: Vec2, exclude?: { shapeId: string; index: number }): Vec2 => {
      const tolWorld = 8 / view.s;
      // points existants
      let best: Vec2 | null = null;
      let bestD = tolWorld;
      const consider = (q: Vec2) => {
        const d = Math.hypot(q[0] - p[0], q[1] - p[1]);
        if (d < bestD) {
          bestD = d;
          best = q;
        }
      };
      for (const s of useSketchStore.getState().shapes) {
        if (s.kind === 'path') s.points.forEach((q, i) => (exclude && exclude.shapeId === s.id && exclude.index === i ? null : consider(q)));
        else consider(s.c);
      }
      draft?.points.forEach(consider);
      if (best) return [...(best as Vec2)] as Vec2;
      let [x, y] = p;
      if (snap) {
        x = Math.round(x);
        y = Math.round(y);
      }
      if (revolve && Math.abs(p[0]) < 6 / view.s) x = 0;
      return [x, y];
    },
    [snap, revolve, view.s, draft],
  );

  // ---------------------------------------------------------------------------
  // Création de formes
  // ---------------------------------------------------------------------------
  const finishPath = useCallback(
    (points: Vec2[], kinds: PathSeg['t'][], closingKind: PathSeg['t']) => {
      if (points.length < 3 && !(points.length === 2 && (kinds[0] === 'arc' || closingKind === 'arc'))) return false;
      const allKinds = [...kinds, closingKind];
      const segs: PathSeg[] = allKinds.map((k) => (k === 'arc' ? { t: 'arc', bulge: Math.tan(Math.PI / 8) } : k === 'curve' ? { t: 'curve' } : { t: 'line' }));
      useSketchStore.getState().addShapes([{ id: newId('s'), kind: 'path', points, segs }]);
      setDraft(null);
      onShapeCreated?.();
      return true;
    },
    [onShapeCreated],
  );

  const segKindFor = (t: SketchTool): PathSeg['t'] => (t === 'curve' ? 'curve' : t === 'arc' ? 'arc' : 'line');

  const addDraftPoint = useCallback(
    (p: Vec2) => {
      setDraft((d) => {
        if (!d) return { points: [p], kinds: [] };
        const last = d.points[d.points.length - 1];
        if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 1e-6) return d;
        return { points: [...d.points, p], kinds: [...d.kinds, segKindFor(tool)] };
      });
    },
    [tool],
  );

  const createPrimitive = useCallback(
    (a: Vec2, b: Vec2) => {
      let shape: SketchShape | null = null;
      if (tool === 'circle') {
        const r = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (r > 0.05) shape = { id: newId('s'), kind: 'circle', c: a, r };
      } else if (tool === 'rect') {
        const w = Math.abs(b[0] - a[0]);
        const h = Math.abs(b[1] - a[1]);
        if (w > 0.05 && h > 0.05) shape = { id: newId('s'), kind: 'rect', c: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], w, h, r: rectRadius };
      } else if (tool === 'polygon') {
        const r = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (r > 0.05) shape = { id: newId('s'), kind: 'polygon', c: a, r, n: polygonSides, rot: 0 };
      }
      if (shape) {
        useSketchStore.getState().addShapes([shape]);
        onShapeCreated?.();
      }
      setAnchor(null);
    },
    [tool, rectRadius, polygonSides, onShapeCreated],
  );

  // Changement d'outil : on abandonne le brouillon en cours de formes primitives
  useEffect(() => {
    setAnchor(null);
    if (tool === 'select' || tool === 'circle' || tool === 'rect' || tool === 'polygon') setDraft(null);
  }, [tool]);

  // Informations pour le panneau de précision
  useEffect(() => {
    if (!onDraft) return;
    const last = draft?.points[draft.points.length - 1] ?? anchor ?? null;
    if (!draft && !anchor) {
      onDraft(null);
      return;
    }
    const len = last && cursor ? Math.hypot(cursor[0] - last[0], cursor[1] - last[1]) : null;
    const ang = last && cursor ? (Math.atan2(cursor[1] - last[1], cursor[0] - last[0]) * 180) / Math.PI : null;
    onDraft({ tool, points: draft?.points.length ?? (anchor ? 1 : 0), last, cursor, length: len, angle: ang });
  }, [draft, anchor, cursor, tool, onDraft]);

  useImperativeHandle(
    handleRef,
    () => ({
      addRelative: (length, angleDeg) => {
        const last = draft?.points[draft.points.length - 1] ?? anchor;
        if (!last) return;
        const a = (angleDeg * Math.PI) / 180;
        const p: Vec2 = [Math.round((last[0] + length * Math.cos(a)) * 1e4) / 1e4, Math.round((last[1] + length * Math.sin(a)) * 1e4) / 1e4];
        if (anchor && (tool === 'circle' || tool === 'rect' || tool === 'polygon')) createPrimitive(anchor, p);
        else addDraftPoint(p);
      },
      addAbsolute: (p) => {
        if (tool === 'circle' || tool === 'rect' || tool === 'polygon') {
          if (anchor) createPrimitive(anchor, p);
          else setAnchor(p);
        } else addDraftPoint(p);
      },
      close: () => {
        if (draft) finishPath(draft.points, draft.kinds, segKindFor(tool));
      },
      cancel: () => {
        setDraft(null);
        setAnchor(null);
      },
      undoPoint: () =>
        setDraft((d) => (d && d.points.length > 1 ? { points: d.points.slice(0, -1), kinds: d.kinds.slice(0, -1) } : null)),
      fit,
    }),
    [draft, anchor, tool, addDraftPoint, createPrimitive, finishPath, fit],
  );

  // ---------------------------------------------------------------------------
  // Pointeur
  // ---------------------------------------------------------------------------
  const localPoint = (e: React.PointerEvent | PointerEvent | WheelEvent): Vec2 => {
    const r = svgRef.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };

  const selected = shapes.find((s) => s.id === selectedShape) ?? null;

  /** Poignées de la forme sélectionnée, en coordonnées monde. */
  const handles = useMemo(() => {
    const out: { kind: 'vertex' | 'mid' | 'radius' | 'corner'; index: number; p: Vec2 }[] = [];
    if (!selected) return out;
    if (selected.kind === 'path') {
      selected.points.forEach((p, i) => out.push({ kind: 'vertex', index: i, p }));
      // chemins très détaillés (import, paroi) : pas de poignées de milieu, pour rester lisible
      if (selected.points.length <= 24) selected.segs.forEach((seg, i) => {
        if (seg.t === 'line' || seg.t === 'arc') {
          const a = selected.points[i];
          const b = selected.points[(i + 1) % selected.points.length];
          out.push({ kind: 'mid', index: i, p: segmentHandle(a, b, seg.t === 'arc' ? seg.bulge : 0) });
        }
      });
    } else if (selected.kind === 'circle') {
      out.push({ kind: 'radius', index: 0, p: [selected.c[0] + selected.r, selected.c[1]] });
    } else if (selected.kind === 'rect') {
      out.push({ kind: 'corner', index: 0, p: [selected.c[0] + selected.w / 2, selected.c[1] + selected.h / 2] });
    } else {
      out.push({ kind: 'radius', index: 0, p: polygonPoints(selected)[0] });
    }
    return out;
  }, [selected]);

  const hitShape = (p: Vec2): SketchShape | null => {
    const tol = 6 / view.s;
    for (let i = shapes.length - 1; i >= 0; i--) {
      const poly = shapePolygon(shapes[i], 0.05);
      if (pointInPolygon(p, poly) || distanceToPolygon(p, poly) < tol) return shapes[i];
    }
    return null;
  };

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    svgRef.current?.setPointerCapture(e.pointerId);
    const sp = localPoint(e);
    pointers.current.set(e.pointerId, sp);
    if (pointers.current.size === 2) {
      // début du pincement : on annule le geste en cours
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(a[0] - b[0], a[1] - b[1]), mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], view };
      drag.current = null;
      return;
    }
    if (e.button === 1 || e.button === 2) {
      drag.current = { kind: 'pan', startClient: sp, startView: view, moved: false };
      return;
    }
    const w = toWorld(sp[0], sp[1]);
    if (tool === 'select') {
      // poignées
      const tolPx = HANDLE_PX;
      for (const h of handles) {
        const hs = toScreen(h.p);
        if (Math.abs(hs[0] - sp[0]) <= tolPx && Math.abs(hs[1] - sp[1]) <= tolPx) {
          if (h.kind === 'vertex') {
            useSketchStore.getState().select(selected!.id, h.index);
            drag.current = { kind: 'vertex', shapeId: selected!.id, index: h.index, moved: false };
          } else if (h.kind === 'mid') drag.current = { kind: 'mid', shapeId: selected!.id, index: h.index, moved: false };
          else if (h.kind === 'radius') drag.current = { kind: 'radius', shapeId: selected!.id, moved: false };
          else drag.current = { kind: 'corner', shapeId: selected!.id, moved: false };
          return;
        }
      }
      const hit = hitShape(w);
      if (hit) {
        useSketchStore.getState().select(hit.id, null);
        drag.current = { kind: 'move', shapeId: hit.id, startWorld: w, orig: hit, moved: false };
      } else {
        drag.current = { kind: 'pan', startClient: sp, startView: view, moved: false };
      }
      return;
    }
    // outils de dessin : le point est posé au relâchement (pour permettre le pincement)
    drag.current = { kind: 'pan', startClient: sp, startView: view, moved: false };
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const sp = localPoint(e);
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, sp);
    if (pinch.current && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a[0] - b[0], a[1] - b[1]);
      const mid: Vec2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const pv = pinch.current.view;
      const s = Math.min(80, Math.max(0.3, pv.s * (dist / pinch.current.dist)));
      // le point monde sous le milieu initial reste sous le milieu courant
      const wx = pv.cx + (pinch.current.mid[0] - size.w / 2) / pv.s;
      const wy = pv.cy - (pinch.current.mid[1] - size.h / 2) / pv.s;
      setView({ s, cx: wx - (mid[0] - size.w / 2) / s, cy: wy + (mid[1] - size.h / 2) / s });
      return;
    }
    const w = toWorld(sp[0], sp[1]);
    const d = drag.current;
    if (d) {
      const movedPx = d.kind === 'pan' ? Math.hypot(sp[0] - d.startClient[0], sp[1] - d.startClient[1]) : 99;
      if (d.kind === 'pan') {
        // au-delà de 4 px, le geste déplace la vue (souris ou doigt) au lieu de poser un point
        if (movedPx > 4 || d.moved) {
          d.moved = true;
          setView({ ...d.startView, cx: d.startView.cx - (sp[0] - d.startClient[0]) / view.s, cy: d.startView.cy + (sp[1] - d.startClient[1]) / view.s });
        }
      } else {
        d.moved = true;
        const st = useSketchStore.getState();
        if (d.kind === 'vertex') {
          const p = snapPoint(w, { shapeId: d.shapeId, index: d.index });
          st.updateShape(d.shapeId, (s) => (s.kind === 'path' ? { ...s, points: s.points.map((q, i) => (i === d.index ? p : q)) } : s));
        } else if (d.kind === 'mid') {
          st.updateShape(d.shapeId, (s) => {
            if (s.kind !== 'path') return s;
            const a = s.points[d.index];
            const b = s.points[(d.index + 1) % s.points.length];
            const bulge = bulgeFromHandle(a, b, w);
            const segs = s.segs.map((g, i) => (i === d.index ? (Math.abs(bulge) < 0.02 ? ({ t: 'line' } as PathSeg) : ({ t: 'arc', bulge } as PathSeg)) : g));
            return { ...s, segs };
          });
        } else if (d.kind === 'radius') {
          const p = snapPoint(w);
          st.updateShape(d.shapeId, (s) => (s.kind === 'circle' || s.kind === 'polygon' ? { ...s, r: Math.max(0.1, Math.hypot(p[0] - s.c[0], p[1] - s.c[1])) } : s));
        } else if (d.kind === 'corner') {
          const p = snapPoint(w);
          st.updateShape(d.shapeId, (s) =>
            s.kind === 'rect' ? { ...s, w: Math.max(0.2, 2 * Math.abs(p[0] - s.c[0])), h: Math.max(0.2, 2 * Math.abs(p[1] - s.c[1])) } : s,
          );
        } else if (d.kind === 'move') {
          let dx = w[0] - d.startWorld[0];
          let dy = w[1] - d.startWorld[1];
          if (snap) {
            dx = Math.round(dx);
            dy = Math.round(dy);
          }
          st.updateShape(d.shapeId, () => translate(d.orig, dx, dy));
        }
      }
    }
    if (tool !== 'select') setCursor(snapPoint(w));
    else setCursor(null);
  };

  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    const sp = localPoint(e);
    pointers.current.delete(e.pointerId);
    if (pinch.current) {
      if (pointers.current.size < 2) pinch.current = null;
      drag.current = null;
      return;
    }
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.kind === 'pan' && !d.moved) {
      const w = snapPoint(toWorld(sp[0], sp[1]));
      if (tool === 'select') {
        useSketchStore.getState().select(null);
      } else if (tool === 'circle' || tool === 'rect' || tool === 'polygon') {
        if (!anchor) setAnchor(w);
        else createPrimitive(anchor, w);
      } else {
        // fermeture : clic sur le premier point
        if (draft && draft.points.length >= 2) {
          const first = toScreen(draft.points[0]);
          if (Math.hypot(first[0] - sp[0], first[1] - sp[1]) <= 12) {
            finishPath(draft.points, draft.kinds, segKindFor(tool));
            return;
          }
        }
        addDraftPoint(w);
      }
    }
  };

  // Zoom à la molette (écouteur non passif pour bloquer le défilement de la page)
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const [sx, sy] = localPoint(e);
      setView((v) => {
        const s = Math.min(80, Math.max(0.3, v.s * Math.pow(1.0015, -e.deltaY)));
        const wx = v.cx + (sx - size.w / 2) / v.s;
        const wy = v.cy - (sy - size.h / 2) / v.s;
        return { s, cx: wx - (sx - size.w / 2) / s, cy: wy + (sy - size.h / 2) / s };
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [size]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && draft) {
      e.preventDefault();
      finishPath(draft.points, draft.kinds, segKindFor(tool));
    } else if (e.key === 'Escape') {
      setDraft(null);
      setAnchor(null);
    } else if (e.key === 'Backspace' && draft) {
      e.preventDefault();
      setDraft((d) => (d && d.points.length > 1 ? { points: d.points.slice(0, -1), kinds: d.kinds.slice(0, -1) } : null));
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && selected) {
      e.preventDefault();
      const st = useSketchStore.getState();
      if (selected.kind === 'path' && st.selectedVertex !== null && selected.points.length > 3) {
        const i = st.selectedVertex;
        st.updateShape(selected.id, (s) => (s.kind === 'path' ? { ...s, points: s.points.filter((_, k) => k !== i), segs: s.segs.filter((_, k) => k !== i) } : s));
        st.select(selected.id, null);
      } else st.removeShape(selected.id);
    }
  };

  // ---------------------------------------------------------------------------
  // Rendu
  // ---------------------------------------------------------------------------
  const grid = useMemo(() => {
    const lines: { x1: number; y1: number; x2: number; y2: number; major: boolean }[] = [];
    const tl = toWorld(0, 0);
    const br = toWorld(size.w, size.h);
    const major = gridStep * 5;
    for (let x = Math.floor(tl[0] / gridStep) * gridStep; x <= br[0]; x += gridStep) {
      const [sx] = toScreen([x, 0]);
      lines.push({ x1: sx, y1: 0, x2: sx, y2: size.h, major: Math.abs(x / major - Math.round(x / major)) < 1e-6 });
    }
    for (let y = Math.floor(br[1] / gridStep) * gridStep; y <= tl[1]; y += gridStep) {
      const [, sy] = toScreen([0, y]);
      lines.push({ x1: 0, y1: sy, x2: size.w, y2: sy, major: Math.abs(y / major - Math.round(y / major)) < 1e-6 });
    }
    return lines;
  }, [toWorld, toScreen, size, gridStep]);

  const pathD = (poly: Vec2[]) => (poly.length ? `M${poly.map((p) => toScreen(p).map((v) => v.toFixed(1)).join(' ')).join('L')}Z` : '');
  const allD = (list: SketchShape[]) => list.map((s) => pathD(shapePolygon(s, 0.5 / view.s))).join(' ');

  const axisX = toScreen([0, 0])[0];
  const originY = toScreen([0, 0])[1];
  const draftPreview = useMemo(() => {
    if (!draft) return null;
    const pts = cursor ? [...draft.points, cursor] : draft.points;
    const kinds = cursor ? [...draft.kinds, segKindFor(tool)] : draft.kinds;
    if (pts.length < 2) return { d: '', pts };
    // aperçu ouvert : on aplatit le chemin sans la fermeture
    const tmp: SketchShape = { id: 'draft', kind: 'path', points: pts, segs: [...kinds.map((k) => (k === 'arc' ? { t: 'arc', bulge: Math.tan(Math.PI / 8) } : { t: k === 'curve' ? 'curve' : 'line' }) as PathSeg), { t: 'line' }] };
    const poly = shapePolygon(tmp, 0.5 / view.s);
    // retire l'arête de fermeture
    return { d: `M${poly.map((p) => toScreen(p).map((v) => v.toFixed(1)).join(' ')).join('L')}`, pts };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, cursor, tool, view, size]);

  const primitivePreview = useMemo(() => {
    if (!anchor || !cursor) return null;
    if (tool === 'circle') return shapePolygon({ id: 'p', kind: 'circle', c: anchor, r: Math.max(0.05, Math.hypot(cursor[0] - anchor[0], cursor[1] - anchor[1])) });
    if (tool === 'rect')
      return shapePolygon({ id: 'p', kind: 'rect', c: [(anchor[0] + cursor[0]) / 2, (anchor[1] + cursor[1]) / 2], w: Math.max(0.05, Math.abs(cursor[0] - anchor[0])), h: Math.max(0.05, Math.abs(cursor[1] - anchor[1])), r: rectRadius });
    if (tool === 'polygon') return shapePolygon({ id: 'p', kind: 'polygon', c: anchor, r: Math.max(0.05, Math.hypot(cursor[0] - anchor[0], cursor[1] - anchor[1])), n: polygonSides, rot: 0 });
    return null;
  }, [anchor, cursor, tool, rectRadius, polygonSides]);

  const dims = useMemo(() => (showDims ? dimensionLines(shapes, selected, revolve) : []), [showDims, shapes, selected, revolve]);

  return (
    <div ref={wrapRef} className="sketch-canvas">
      <svg
        ref={svgRef}
        width={size.w}
        height={size.h}
        tabIndex={0}
        role="application"
        aria-label="Plan de croquis 2D. Cliquez pour poser des points ; Entrée ferme le contour, Échap annule."
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={(e) => {
          pointers.current.delete(e.pointerId);
          pinch.current = null;
          drag.current = null;
        }}
        onPointerLeave={() => setCursor(null)}
        onDoubleClick={() => draft && finishPath(draft.points, draft.kinds, segKindFor(tool))}
        onContextMenu={(e) => e.preventDefault()}
        onKeyDown={onKeyDown}
        style={{ cursor: tool === 'select' ? 'default' : 'crosshair' }}
      >
        <rect width={size.w} height={size.h} fill="#101114" />
        {grid.map((l, i) => (
          <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={l.major ? '#2A2E35' : '#1B1E23'} strokeWidth={1} />
        ))}
        {/* axes */}
        <line x1={0} y1={originY} x2={size.w} y2={originY} stroke="#3A3E46" strokeWidth={1} />
        {revolve ? (
          <>
            <line x1={axisX} y1={0} x2={axisX} y2={size.h} stroke="#7FB8F0" strokeWidth={1.5} strokeDasharray="8 6" />
            <text x={axisX + 6} y={18} fill="#7FB8F0" fontSize={12}>
              axe de révolution
            </text>
            <path d={allD(shapes.map(mirrorShape))} fill="none" stroke="#5A606A" strokeWidth={1.2} strokeDasharray="4 4" fillRule="evenodd" />
          </>
        ) : (
          <line x1={axisX} y1={0} x2={axisX} y2={size.h} stroke="#3A3E46" strokeWidth={1} />
        )}

        {/* formes */}
        <path d={allD(shapes)} fill="#F59E3D26" stroke="none" fillRule="evenodd" />
        {shapes.map((s) => (
          <path key={s.id} d={pathD(shapePolygon(s, 0.5 / view.s))} fill="none" stroke={s.id === selectedShape ? ACCENT : '#C9CDD3'} strokeWidth={s.id === selectedShape ? 2.4 : 1.6} strokeLinejoin="round" />
        ))}

        {/* cotes */}
        {dims.map((d, i) => {
          const a = toScreen(d.a);
          const b = toScreen(d.b);
          const off = d.offset;
          const [ox, oy] = d.vertical ? [off, 0] : [0, off];
          const mx = (a[0] + b[0]) / 2 + ox;
          const my = (a[1] + b[1]) / 2 + oy;
          return (
            <g key={i} className="sketch-dim">
              <line x1={a[0] + ox} y1={a[1] + oy} x2={b[0] + ox} y2={b[1] + oy} stroke="#C9CDD3" strokeWidth={1.1} />
              <line x1={a[0] + ox - (d.vertical ? 6 : 0)} y1={a[1] + oy - (d.vertical ? 0 : 6)} x2={a[0] + ox + (d.vertical ? 6 : 0)} y2={a[1] + oy + (d.vertical ? 0 : 6)} stroke="#C9CDD3" />
              <line x1={b[0] + ox - (d.vertical ? 6 : 0)} y1={b[1] + oy - (d.vertical ? 0 : 6)} x2={b[0] + ox + (d.vertical ? 6 : 0)} y2={b[1] + oy + (d.vertical ? 0 : 6)} stroke="#C9CDD3" />
              <rect x={mx - d.label.length * 3.6 - 6} y={my - 11} width={d.label.length * 7.2 + 12} height={22} rx={5} fill="#121316" />
              <text x={mx} y={my + 4.5} fill="#EDEEF0" fontSize={13} fontWeight={600} textAnchor="middle">
                {d.label}
              </text>
            </g>
          );
        })}
        {showDims &&
          selected?.kind === 'path' &&
          selected.points.length <= 24 &&
          selected.segs.map((_, i) => {
            const a = selected.points[i];
            const b = selected.points[(i + 1) % selected.points.length];
            const [hx, hy] = toScreen(segmentHandle(a, b, selected.segs[i].t === 'arc' ? (selected.segs[i] as { bulge: number }).bulge : 0));
            return (
              <text key={`len-${i}`} x={hx + 8} y={hy - 8} fill="#A3A9B2" fontSize={11}>
                {formatNumber(segmentLength(selected, i), 1)}
              </text>
            );
          })}

        {/* poignées */}
        {handles.map((h) => {
          const [x, y] = toScreen(h.p);
          const active = h.kind === 'vertex' && h.index === selectedVertex;
          const dense = selected?.kind === 'path' && selected.points.length > 24;
          if (dense && !active) return <circle key={`${h.kind}${h.index}`} cx={x} cy={y} r={2.2} fill={ACCENT} />;
          if (h.kind === 'mid') return <circle key={`m${h.index}`} cx={x} cy={y} r={4.5} fill="#121316" stroke={ACCENT} strokeWidth={1.5} />;
          return <rect key={`${h.kind}${h.index}`} x={x - (active ? 6 : 4)} y={y - (active ? 6 : 4)} width={active ? 12 : 8} height={active ? 12 : 8} fill={active ? ACCENT : '#121316'} stroke={active ? '#FFFFFF' : ACCENT} strokeWidth={2} />;
        })}

        {/* brouillon */}
        {draftPreview && (
          <>
            <path d={draftPreview.d} fill="none" stroke={ACCENT} strokeWidth={2} strokeDasharray="6 4" />
            {draftPreview.pts.slice(0, draft!.points.length).map((p, i) => {
              const [x, y] = toScreen(p);
              const closable = i === 0 && draft!.points.length >= 2;
              return <rect key={i} x={x - 4} y={y - 4} width={8} height={8} fill={closable ? ACCENT : '#121316'} stroke={ACCENT} strokeWidth={2} />;
            })}
          </>
        )}
        {primitivePreview && <path d={pathD(primitivePreview)} fill="#F59E3D1A" stroke={ACCENT} strokeWidth={2} strokeDasharray="6 4" />}
        {cursor && tool !== 'select' && (
          <g pointerEvents="none">
            <circle cx={toScreen(cursor)[0]} cy={toScreen(cursor)[1]} r={3} fill={ACCENT} />
            <text x={toScreen(cursor)[0] + 10} y={toScreen(cursor)[1] - 10} fill="#EDEEF0" fontSize={12}>
              {formatNumber(cursor[0], 1)} ; {formatNumber(cursor[1], 1)}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}

function translate(s: SketchShape, dx: number, dy: number): SketchShape {
  const t = (p: Vec2): Vec2 => [p[0] + dx, p[1] + dy];
  if (s.kind === 'path') return { ...s, points: s.points.map(t), segs: s.segs.map((g) => (g.t === 'bezier' ? { t: 'bezier', c1: t(g.c1), c2: t(g.c2) } : g)) };
  return { ...s, c: t(s.c) };
}

interface DimLine {
  a: Vec2;
  b: Vec2;
  vertical: boolean;
  /** Décalage en pixels écran */
  offset: number;
  label: string;
}

/** Cotes globales (hauteur, largeur ; diamètre en révolution). */
function dimensionLines(shapes: SketchShape[], selected: SketchShape | null, revolve: boolean): DimLine[] {
  const target = selected ? [selected] : shapes;
  const b = shapeBounds(target);
  if (!b) return [];
  const out: DimLine[] = [];
  out.push({ a: [b.max[0], b.min[1]], b: [b.max[0], b.max[1]], vertical: true, offset: 34, label: formatNumber(b.max[1] - b.min[1], 1) });
  if (revolve) {
    const r = Math.max(Math.abs(b.min[0]), Math.abs(b.max[0]));
    out.push({ a: [-r, b.min[1]], b: [r, b.min[1]], vertical: false, offset: 30, label: `Ø ${formatNumber(2 * r, 1)}` });
  } else {
    out.push({ a: [b.min[0], b.min[1]], b: [b.max[0], b.min[1]], vertical: false, offset: 30, label: formatNumber(b.max[0] - b.min[0], 1) });
  }
  return out;
}

