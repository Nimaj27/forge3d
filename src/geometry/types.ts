import type { Vec3 } from '../../shared/scene';

/** Maillage triangulé transférable entre le worker et l'interface. */
export interface MeshData {
  /** x, y, z par sommet (mm) */
  positions: Float32Array;
  /** Normales par sommet (sommets dédoublés sur les arêtes vives) */
  normals: Float32Array;
  /** 3 indices par triangle */
  indices: Uint32Array;
}

export interface Bounds {
  min: Vec3;
  max: Vec3;
}

/** Résultat rapide de l'évaluation d'une pièce (pour l'aperçu 3D). */
export interface PartEvaluation {
  partId: string;
  hash: string;
  status: 'ok' | 'empty' | 'error';
  error?: string;
  /** Maillage en coordonnées de modélisation (assemblage) */
  mesh: MeshData | null;
  bounds: Bounds | null;
  /**
   * Matrice 4×4 (colonnes, convention three.js) qui passe des coordonnées
   * de modélisation à l'orientation d'impression (pièce posée sur le plateau).
   */
  printMatrix: number[];
  /** Boîte englobante dans l'orientation d'impression */
  printBounds: Bounds | null;
  volume: number;
  triangleCount: number;
  warnings: string[];
  durationMs: number;
}

/** Maillage d'un objet seul (atelier, surbrillance de sélection), sans transformation. */
export interface ObjectEvaluation {
  objectId: string;
  status: 'ok' | 'empty' | 'error';
  error?: string;
  mesh: MeshData | null;
  /** Boîte englobante locale (avant transformation) */
  bounds: Bounds | null;
}

export type CheckLevel = 'ok' | 'warn' | 'error' | 'pending';

export type CheckFix = 'layFlat' | 'rotate90' | 'dropToBed';

export interface CheckItem {
  id: 'bed' | 'manifold' | 'thin' | 'overhang' | 'flat';
  level: CheckLevel;
  message: string;
  detail?: string;
  fix?: CheckFix;
}

/** Vérifications « comme un slicer » d'un maillage exporté. */
export interface MeshValidation {
  vertexCount: number;
  triangleCount: number;
  /** Arêtes qui ne sont pas partagées par exactement 2 triangles d'orientation opposée */
  nonManifoldEdges: number;
  degenerateTriangles: number;
  /** Nombre de blocs (composantes connexes) */
  components: number;
}

/** Analyse complète d'une pièce (vérifications avant impression). */
export interface PartReport {
  partId: string;
  hash: string;
  checks: CheckItem[];
  validation: MeshValidation | null;
  printSize: Vec3 | null;
  overhangArea: number;
  thinZ: number[];
  durationMs: number;
}

export interface ExportedFile {
  partId: string;
  fileName: string;
  data: ArrayBuffer;
  validation: MeshValidation;
}

/** Volume d'impression transmis à l'analyse. */
export interface BedSpec {
  size: Vec3;
}
