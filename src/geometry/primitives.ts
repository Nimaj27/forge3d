/**
 * Construction des primitives Manifold à partir des objets de la Scène.
 * Convention : l'origine de chaque objet est le centre de sa base (z = 0 en bas).
 */
import type { CrossSection, Manifold, ManifoldToplevel, Vec2 as MVec2 } from 'manifold-3d';
import type {
  BoxParams,
  ConeParams,
  CylinderParams,
  SceneObject,
  SketchParams,
  SphereParams,
  Transform,
  TubeParams,
} from '../../shared/scene';
import { Arena } from './cache';
import { loopToPolygon } from './curves';

export type LeafObject = Exclude<SceneObject, { kind: 'group' }>;

/** Fournisseurs asynchrones (polices, images) injectés par le worker ou les tests. */
export interface PrimitiveBuilders {
  text?: (wasm: ManifoldToplevel, obj: Extract<SceneObject, { kind: 'text' }>, warnings: string[]) => Promise<Manifold | null>;
  svg?: (wasm: ManifoldToplevel, obj: Extract<SceneObject, { kind: 'svg' }>, warnings: string[]) => Promise<Manifold | null>;
  image?: (wasm: ManifoldToplevel, obj: Extract<SceneObject, { kind: 'image' }>, warnings: string[]) => Promise<Manifold | null>;
}

const EPS = 1e-4;

/** Construit la primitive non transformée d'un objet simple. */
export async function buildPrimitive(
  wasm: ManifoldToplevel,
  obj: LeafObject,
  builders: PrimitiveBuilders,
  warnings: string[],
): Promise<Manifold | null> {
  switch (obj.kind) {
    case 'box':
      return buildBox(wasm, obj.params);
    case 'cylinder':
      return buildCylinder(wasm, obj.params);
    case 'sphere':
      return buildSphere(wasm, obj.params);
    case 'cone':
      return buildCone(wasm, obj.params);
    case 'tube':
      return buildTube(wasm, obj.params, warnings);
    case 'sketch':
      return buildSketch(wasm, obj.params, warnings);
    case 'text':
      if (builders.text) return builders.text(wasm, obj, warnings);
      break;
    case 'svg':
      if (builders.svg) return builders.svg(wasm, obj, warnings);
      break;
    case 'image':
      if (builders.image) return builders.image(wasm, obj, warnings);
      break;
  }
  warnings.push(`Objet « ${obj.name || obj.kind} » : type non pris en charge.`);
  return null;
}

export function buildBox(wasm: ManifoldToplevel, p: BoxParams): Manifold {
  const { Manifold } = wasm;
  const [w, d, h] = p.size;
  const r = Math.min(p.edgeRadius, w / 2 - EPS, d / 2 - EPS, h / 2 - EPS);
  if (r <= 0.01) {
    const cube = Manifold.cube([w, d, h], false);
    const out = cube.translate([-w / 2, -d / 2, 0]);
    cube.delete();
    return out;
  }
  // Arêtes arrondies : enveloppe convexe de 8 sphères placées aux coins.
  const arena = new Arena();
  const segs = Math.max(12, Math.min(32, Math.round(r * 8) * 4));
  const spheres: Manifold[] = [];
  for (const sx of [-1, 1])
    for (const sy of [-1, 1])
      for (const z of [r, h - r]) {
        const s = arena.track(Manifold.sphere(r, segs));
        spheres.push(arena.track(s.translate([sx * (w / 2 - r), sy * (d / 2 - r), z])));
      }
  const out = Manifold.hull(spheres);
  arena.dispose();
  return out;
}

export function buildCylinder(wasm: ManifoldToplevel, p: CylinderParams): Manifold {
  return wasm.Manifold.cylinder(p.height, p.radius, p.radius, p.segments, false);
}

export function buildSphere(wasm: ManifoldToplevel, p: SphereParams): Manifold {
  const s = wasm.Manifold.sphere(p.radius, p.segments);
  const out = s.translate([0, 0, p.radius]);
  s.delete();
  return out;
}

export function buildCone(wasm: ManifoldToplevel, p: ConeParams): Manifold {
  const rb = Math.max(p.radiusBottom, 0);
  const rt = Math.max(p.radiusTop, 0);
  if (rb <= EPS && rt <= EPS) return wasm.Manifold.cylinder(p.height, EPS * 10, EPS * 10, 3);
  return wasm.Manifold.cylinder(p.height, rb, rt, p.segments, false);
}

export function buildTube(wasm: ManifoldToplevel, p: TubeParams, warnings: string[]): Manifold {
  const { CrossSection } = wasm;
  const ro = p.outerRadius;
  let ri = p.innerRadius;
  if (ri >= ro - 0.05) {
    warnings.push('Tube : le rayon intérieur doit être plus petit que le rayon extérieur.');
    ri = Math.max(0, ro - 0.4);
  }
  const outer = CrossSection.circle(ro, p.segments);
  const ring = ri > EPS ? outer.subtract(CrossSection.circle(ri, p.segments)) : outer;
  const m = ring.extrude(p.height);
  if (ring !== outer) ring.delete();
  outer.delete();
  return m;
}

/** Croquis 2D : contours fermés → extrusion verticale ou révolution autour de l'axe Y du croquis. */
export function buildSketch(wasm: ManifoldToplevel, p: SketchParams, warnings: string[]): Manifold | null {
  const { CrossSection } = wasm;
  const polys = p.loops.map((l) => loopToPolygon(l)).filter((poly) => poly.length >= 3);
  if (!polys.length) {
    warnings.push('Croquis vide ou contours ouverts.');
    return null;
  }
  const arena = new Arena();
  try {
    let cs = arena.track(new CrossSection(polys as MVec2[][], 'EvenOdd'));
    // Sépare les contours qui se touchent en un point (pincements).
    cs = arena.track(cs.offset(-0.015, 'Miter', 2)).offset(0.015, 'Miter', 2);
    arena.track(cs);
    if (cs.isEmpty()) {
      warnings.push('Croquis : surface nulle.');
      return null;
    }
    if (p.op === 'revolve') {
      const half = arena.track(clipPositiveX(wasm, cs, arena));
      if (half.isEmpty()) {
        warnings.push('Révolution : le profil doit être du côté positif de l’axe.');
        return null;
      }
      return half.revolve(p.segments, Math.min(360, Math.max(1, p.angle)));
    }
    return cs.extrude(p.height);
  } finally {
    arena.dispose();
  }
}

function clipPositiveX(wasm: ManifoldToplevel, cs: CrossSection, arena: Arena): CrossSection {
  const b = cs.bounds();
  if (b.min[0] >= 0) return cs.translate([0, 0]);
  const w = Math.max(b.max[0], 1) + 1;
  const h = b.max[1] - b.min[1] + 2;
  const square = arena.track(wasm.CrossSection.square([w, h]));
  const clip = arena.track(square.translate([0, b.min[1] - 1]));
  return cs.intersect(clip);
}

/** Applique échelle, rotation (X puis Y puis Z, axes fixes) et translation. */
export function applyTransform(m: Manifold, t: Transform, arena: Arena): Manifold {
  let cur = m;
  const s = t.scale;
  if (s && (s[0] !== 1 || s[1] !== 1 || s[2] !== 1)) cur = arena.track(cur.scale(s));
  const r = t.rotation;
  if (r[0] !== 0 || r[1] !== 0 || r[2] !== 0) cur = arena.track(cur.rotate(r));
  const p = t.position;
  if (p[0] !== 0 || p[1] !== 0 || p[2] !== 0) cur = arena.track(cur.translate(p));
  return cur;
}
