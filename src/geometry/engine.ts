/**
 * Moteur géométrique Forge3D (manifold-3d). Indépendant de l'environnement :
 * utilisé par le Web Worker du navigateur et par les tests Node.
 */
import type { Manifold, ManifoldToplevel } from 'manifold-3d';
import type { Loop, Part, SceneObject, Vec3 } from '../../shared/scene';
import { shellLoops } from './sketchOps';
import { checkBed, checkFlat, checkManifold, checkOverhang, checkThin, findThinZ, measureOverhangs } from './analysis';
import { Arena, hashValue, LruCache } from './cache';
import { toTriangleSoup, validateTriangleSoup } from './meshCheck';
import { applyTransform, buildPrimitive, type LeafObject, type PrimitiveBuilders } from './primitives';
import { writeBinaryStl } from './stl';
import type { Bounds, ExportedFile, MeshData, ObjectEvaluation, PartEvaluation, PartReport } from './types';

/** Angle au-delà duquel une arête est rendue vive dans l'aperçu (degrés). */
const SHARP_ANGLE = 50;

interface PartEntry {
  /** Résultat en coordonnées de modélisation */
  manifold: Manifold;
  /** Résultat dans l'orientation d'impression */
  printManifold: Manifold;
  evaluation: Omit<PartEvaluation, 'mesh'>;
  mesh: MeshData;
  report?: PartReport;
  reportBedKey?: string;
}

export interface Engine {
  evaluatePart(part: Part): Promise<PartEvaluation>;
  evaluateObject(obj: SceneObject): Promise<ObjectEvaluation>;
  analyzePart(part: Part, bed: Vec3): Promise<PartReport>;
  exportPart(part: Part, fileName: string): Promise<ExportedFile>;
  /** Creuse un croquis en paroi d'épaisseur constante */
  shellSketch(loops: Loop[], thickness: number, mode: 'revolve' | 'extrude'): Loop[];
  clear(): void;
}

export function createEngine(wasm: ManifoldToplevel, builders: PrimitiveBuilders = {}): Engine {
  const primitives = new LruCache<Manifold>(150, (m) => m.delete());
  const objects = new LruCache<{ manifold: Manifold; mesh: MeshData; bounds: Bounds }>(80, (e) => e.manifold.delete());
  const parts = new LruCache<PartEntry>(12, (e) => {
    if (e.printManifold !== e.manifold) e.printManifold.delete();
    e.manifold.delete();
  });

  async function primitive(obj: LeafObject, warnings: string[]): Promise<Manifold | null> {
    const key = `${obj.kind}:${hashValue(obj.params)}`;
    const cached = primitives.get(key);
    if (cached) return cached;
    const m = await buildPrimitive(wasm, obj, builders, warnings);
    if (!m) return null;
    const status = m.status();
    if (status !== 'NoError') {
      warnings.push(`Objet « ${obj.name || obj.kind} » : géométrie invalide (${status}).`);
      m.delete();
      return null;
    }
    primitives.set(key, m);
    return m;
  }

  /** Union des solides puis soustraction des trous (récursif pour les groupes). */
  async function evalObjects(list: readonly SceneObject[], arena: Arena, warnings: string[]): Promise<Manifold | null> {
    const solids: Manifold[] = [];
    const holes: Manifold[] = [];
    for (const o of list) {
      if (o.hidden) continue;
      const m = await evalObject(o, arena, warnings);
      if (!m || m.isEmpty()) continue;
      (o.mode === 'hole' ? holes : solids).push(m);
    }
    if (!solids.length) return null;
    let result = solids.length === 1 ? solids[0] : arena.track(wasm.Manifold.union(solids));
    if (holes.length) {
      const holeUnion = holes.length === 1 ? holes[0] : arena.track(wasm.Manifold.union(holes));
      result = arena.track(result.subtract(holeUnion));
    }
    return result;
  }

  async function evalObject(o: SceneObject, arena: Arena, warnings: string[]): Promise<Manifold | null> {
    const base = o.kind === 'group' ? await evalObjects(o.children, arena, warnings) : await primitive(o, warnings);
    if (!base) return null;
    return applyTransform(base, o.transform, arena);
  }

  async function partEntry(part: Part): Promise<{ entry: PartEntry | null; evaluation: PartEvaluation }> {
    const hash = hashValue({ o: part.objects, p: part.printOrientation ?? 'asModeled' });
    const cached = parts.get(hash);
    if (cached) return { entry: cached, evaluation: { ...cached.evaluation, partId: part.id, mesh: cloneMesh(cached.mesh) } };

    const t0 = now();
    const arena = new Arena();
    const warnings: string[] = [];
    const empty = (status: 'empty' | 'error', error?: string): PartEvaluation => ({
      partId: part.id,
      hash,
      status,
      error,
      mesh: null,
      bounds: null,
      printMatrix: identity(),
      printBounds: null,
      volume: 0,
      triangleCount: 0,
      warnings,
      durationMs: now() - t0,
    });
    try {
      const result = await evalObjects(part.objects, arena, warnings);
      if (!result || result.isEmpty()) return { entry: null, evaluation: empty('empty') };
      const status = result.status();
      if (status !== 'NoError') return { entry: null, evaluation: empty('error', `Géométrie invalide (${status})`) };

      // Copie possédée par le cache (le résultat peut être une primitive en cache).
      const manifold = result.translate([0, 0, 0]);
      const bounds = toBounds(manifold.boundingBox());
      const { printManifold, printMatrix } = toPrintOrientation(manifold, part.printOrientation, arena);
      const printBounds = toBounds(printManifold.boundingBox());
      const mesh = extractMesh(manifold, arena);
      const evaluation: Omit<PartEvaluation, 'mesh'> = {
        partId: part.id,
        hash,
        status: 'ok',
        bounds,
        printMatrix,
        printBounds,
        volume: manifold.volume(),
        triangleCount: mesh.indices.length / 3,
        warnings,
        durationMs: now() - t0,
      };
      const entry: PartEntry = { manifold, printManifold, evaluation, mesh };
      parts.set(hash, entry);
      return { entry, evaluation: { ...evaluation, mesh: cloneMesh(mesh) } };
    } catch (err) {
      return { entry: null, evaluation: empty('error', errorMessage(err)) };
    } finally {
      arena.dispose();
    }
  }

  function toPrintOrientation(m: Manifold, orientation: Part['printOrientation'], arena: Arena) {
    if (orientation !== 'flatOnBack') return { printManifold: m, printMatrix: identity() };
    // Couchée sur le dos : rotation de −90° autour de X (le dos, côté +Y, va sur le plateau),
    // puis centrage en XY et pose sur z = 0.
    const rotated = arena.track(m.rotate([-90, 0, 0]));
    const b = rotated.boundingBox();
    const t: Vec3 = [-(b.min[0] + b.max[0]) / 2, -(b.min[1] + b.max[1]) / 2, -b.min[2]];
    const printManifold = rotated.translate(t);
    // Matrice colonne-major : T × Rx(−90°) ; (x, y, z) → (x + tx, z + ty, −y + tz)
    const printMatrix = [1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, t[0], t[1], t[2], 1];
    return { printManifold, printMatrix };
  }

  return {
    async evaluatePart(part) {
      return (await partEntry(part)).evaluation;
    },

    async evaluateObject(obj) {
      const key = hashValue({ ...obj, transform: undefined, mode: undefined, name: undefined, locked: undefined });
      const cached = objects.get(key);
      if (cached) return { objectId: obj.id, status: 'ok', mesh: cloneMesh(cached.mesh), bounds: cached.bounds };
      const arena = new Arena();
      const warnings: string[] = [];
      try {
        const base =
          obj.kind === 'group' ? await evalObjects(obj.children, arena, warnings) : await primitive(obj, warnings);
        if (!base || base.isEmpty())
          return { objectId: obj.id, status: 'empty', error: warnings[0], mesh: null, bounds: null };
        const manifold = base.translate([0, 0, 0]);
        const mesh = extractMesh(manifold, arena);
        const bounds = toBounds(manifold.boundingBox());
        objects.set(key, { manifold, mesh, bounds });
        return { objectId: obj.id, status: 'ok', mesh: cloneMesh(mesh), bounds };
      } catch (err) {
        return { objectId: obj.id, status: 'error', error: errorMessage(err), mesh: null, bounds: null };
      } finally {
        arena.dispose();
      }
    },

    async analyzePart(part, bed) {
      const t0 = now();
      const { entry, evaluation } = await partEntry(part);
      const bedKey = bed.join('x');
      if (entry?.report && entry.reportBedKey === bedKey) return { ...entry.report, partId: part.id };
      if (!entry || !evaluation.printBounds) {
        const report: PartReport = {
          partId: part.id,
          hash: evaluation.hash,
          checks: [checkManifold(null)],
          validation: null,
          printSize: null,
          overhangArea: 0,
          thinZ: [],
          durationMs: now() - t0,
        };
        return report;
      }
      const arena = new Arena();
      try {
        const pb = evaluation.printBounds;
        const size: Vec3 = [pb.max[0] - pb.min[0], pb.max[1] - pb.min[1], pb.max[2] - pb.min[2]];
        const raw = entry.printManifold.getMesh();
        const positions = raw.vertProperties;
        const indices = raw.triVerts;
        const validation = validateTriangleSoup(toTriangleSoup(positions, indices, raw.numProp));
        const overhang = measureOverhangs(entry.printManifold, stridePositions(positions, raw.numProp), indices);
        const thinZ = findThinZ(entry.printManifold, pb);
        const report: PartReport = {
          partId: part.id,
          hash: evaluation.hash,
          checks: [
            checkBed(size, bed),
            checkManifold(validation),
            checkThin(thinZ, size),
            checkOverhang(overhang.area, overhang.maxZ),
            checkFlat(pb),
          ],
          validation,
          printSize: size,
          overhangArea: overhang.area,
          thinZ,
          durationMs: now() - t0,
        };
        entry.report = report;
        entry.reportBedKey = bedKey;
        return report;
      } finally {
        arena.dispose();
      }
    },

    async exportPart(part, fileName) {
      const { entry } = await partEntry(part);
      if (!entry) throw new Error(`La pièce « ${part.name} » est vide.`);
      const raw = entry.printManifold.getMesh();
      const soup = toTriangleSoup(raw.vertProperties, raw.triVerts, raw.numProp);
      const validation = validateTriangleSoup(soup);
      return { partId: part.id, fileName, data: writeBinaryStl(soup), validation };
    },

    shellSketch(loops, thickness, mode) {
      return shellLoops(wasm, loops, thickness, mode);
    },

    clear() {
      parts.clear();
      objects.clear();
      primitives.clear();
    },
  };

  /** Maillage pour l'aperçu, avec normales lissées sauf sur les arêtes vives. */
  function extractMesh(m: Manifold, arena: Arena): MeshData {
    const withNormals = arena.track(m.calculateNormals(0, SHARP_ANGLE));
    const mesh = withNormals.getMesh(0);
    const n = mesh.numProp;
    const vertCount = mesh.vertProperties.length / n;
    const positions = new Float32Array(vertCount * 3);
    const normals = new Float32Array(vertCount * 3);
    for (let i = 0; i < vertCount; i++) {
      positions[i * 3] = mesh.vertProperties[i * n];
      positions[i * 3 + 1] = mesh.vertProperties[i * n + 1];
      positions[i * 3 + 2] = mesh.vertProperties[i * n + 2];
      normals[i * 3] = mesh.vertProperties[i * n + 3];
      normals[i * 3 + 1] = mesh.vertProperties[i * n + 4];
      normals[i * 3 + 2] = mesh.vertProperties[i * n + 5];
    }
    return { positions, normals, indices: new Uint32Array(mesh.triVerts) };
  }
}

function stridePositions(props: Float32Array, stride: number): Float32Array {
  if (stride === 3) return props;
  const n = props.length / stride;
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    out[i * 3] = props[i * stride];
    out[i * 3 + 1] = props[i * stride + 1];
    out[i * 3 + 2] = props[i * stride + 2];
  }
  return out;
}

function cloneMesh(m: MeshData): MeshData {
  return { positions: m.positions.slice(), normals: m.normals.slice(), indices: m.indices.slice() };
}

function toBounds(b: { min: number[]; max: number[] }): Bounds {
  return { min: [b.min[0], b.min[1], b.min[2]], max: [b.max[0], b.max[1], b.max[2]] };
}

function identity(): number[] {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
