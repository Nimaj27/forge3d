/**
 * Modèle de données Forge3D : la Scène, source de vérité unique (brief §3).
 *
 * Partagé entre l'application (éditeur, atelier, modèles, worker géométrique)
 * et la Cloud Function d'IA (validation de la sortie de Claude).
 * Toutes les mesures sont en millimètres, les angles en degrés.
 */
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Briques de base
// ---------------------------------------------------------------------------

/** Borne de sécurité pour toute dimension (évite les valeurs absurdes). */
export const MAX_DIM = 2000;

const num = z.number().min(-MAX_DIM).max(MAX_DIM);
const pos = z.number().gt(0).max(MAX_DIM);
const nonNeg = z.number().min(0).max(MAX_DIM);

export const vec2Schema = z.tuple([num, num]);
export const vec3Schema = z.tuple([num, num, num]);
const angle3Schema = z.tuple([z.number().min(-3600).max(3600), z.number().min(-3600).max(3600), z.number().min(-3600).max(3600)]);
const scale3Schema = z.tuple([z.number().min(-100).max(100), z.number().min(-100).max(100), z.number().min(-100).max(100)]);
const size3Schema = z.tuple([pos, pos, pos]);
const segmentsSchema = z.int().min(3).max(256);

export type Vec2 = [number, number];
export type Vec3 = [number, number, number];

export const transformSchema = z.object({
  /** Position de l'origine de l'objet (centre de la base), en mm */
  position: vec3Schema.default([0, 0, 0]),
  /** Rotation en degrés, ordre X puis Y puis Z, autour de l'origine de l'objet */
  rotation: angle3Schema.default([0, 0, 0]),
  /** Échelle facultative (−1 sur un axe = miroir) */
  scale: scale3Schema.optional(),
});

// ---------------------------------------------------------------------------
// Paramètres par type d'objet
// ---------------------------------------------------------------------------

export const boxParamsSchema = z.object({
  /** Largeur (X) × profondeur (Y) × hauteur (Z) */
  size: size3Schema.default([20, 20, 20]),
  /** Arrondi des arêtes verticales */
  edgeRadius: nonNeg.default(0),
});

export const cylinderParamsSchema = z.object({
  radius: pos.default(10),
  height: pos.default(20),
  segments: segmentsSchema.default(64),
});

export const sphereParamsSchema = z.object({
  radius: pos.default(10),
  segments: segmentsSchema.default(48),
});

export const coneParamsSchema = z.object({
  radiusBottom: nonNeg.default(10),
  radiusTop: nonNeg.default(0),
  height: pos.default(20),
  segments: segmentsSchema.default(64),
});

export const tubeParamsSchema = z.object({
  outerRadius: pos.default(10),
  innerRadius: pos.default(7),
  height: pos.default(20),
  segments: segmentsSchema.default(64),
});

export const FONT_IDS = ['classique', 'moderne', 'sport', 'robuste'] as const;
export type FontId = (typeof FONT_IDS)[number];

/** Polices embarquées (public/fonts) : libellé affiché et fichier TTF. */
export const FONT_INFO: Record<FontId, { label: string; file: string }> = {
  classique: { label: 'Cinzel Black (classique)', file: 'Cinzel-Black.ttf' },
  moderne: { label: 'Inter Bold (moderne)', file: 'Inter-Bold.ttf' },
  sport: { label: 'Bebas Neue (sport)', file: 'BebasNeue-Regular.ttf' },
  robuste: { label: 'Roboto Slab Bold (robuste)', file: 'RobotoSlab-Bold.ttf' },
};

export const textParamsSchema = z.object({
  /** Texte ; « \n » sépare les lignes */
  text: z.string().max(300).default('Texte'),
  font: z.enum(FONT_IDS).default('moderne'),
  /** Hauteur des majuscules */
  capHeight: pos.default(8),
  /** Épaisseur du relief */
  depth: pos.default(1.5),
  align: z.enum(['left', 'center', 'right']).default('center'),
  /** Espacement supplémentaire entre les lettres */
  letterSpacing: num.default(0),
  /** Interligne, en multiple de la hauteur des majuscules */
  lineSpacing: z.number().min(0.5).max(5).default(1.5),
  /** Épaississement des contours (empattements fins imprimables) */
  thicken: z.number().min(0).max(1).default(0.06),
  /** Texte courbé le long d'un arc de cercle */
  onArc: z
    .object({
      /** Rayon de la ligne de base (positif : arc bombé vers le haut) */
      radius: z.number().min(-MAX_DIM).max(MAX_DIM).refine((r) => Math.abs(r) >= 5, 'Rayon trop petit'),
      baselineOffset: num.default(0),
    })
    .optional(),
});

export const lineSegmentSchema = z.object({ type: z.literal('line'), to: vec2Schema });
/** Arc défini par son « bulge » (tan(angle/4), convention DXF ; positif = sens trigonométrique). */
export const arcSegmentSchema = z.object({ type: z.literal('arc'), to: vec2Schema, bulge: z.number().min(-1e3).max(1e3) });
export const bezierSegmentSchema = z.object({
  type: z.literal('bezier'),
  c1: vec2Schema,
  c2: vec2Schema,
  to: vec2Schema,
});
export const segmentSchema = z.discriminatedUnion('type', [lineSegmentSchema, arcSegmentSchema, bezierSegmentSchema]);

/** Contour fermé : point de départ + segments (le dernier revient au départ). */
export const loopSchema = z.object({
  start: vec2Schema,
  segments: z.array(segmentSchema).min(1).max(5000),
});

export const sketchParamsSchema = z.object({
  loops: z.array(loopSchema).min(1).max(500),
  /** Extrusion verticale, ou révolution autour de l'axe Y du croquis (qui devient Z) */
  op: z.enum(['extrude', 'revolve']).default('extrude'),
  height: pos.default(10),
  angle: z.number().min(1).max(360).default(360),
  segments: segmentsSchema.default(96),
});

export const imageParamsSchema = z.object({
  /** Image en data URL (PNG, JPEG…) */
  src: z.string().max(8_000_000),
  /** Largeur finale en mm (la hauteur suit les proportions) */
  width: pos.default(60),
  /** « threshold » : logo en relief ; « heightmap » : photo en relief (lithophane) */
  mode: z.enum(['threshold', 'heightmap']).default('threshold'),
  threshold: z.number().min(0).max(255).default(128),
  invert: z.boolean().default(false),
  minHeight: nonNeg.default(0.6),
  maxHeight: pos.default(2),
});

export const svgParamsSchema = z.object({
  /** Contenu SVG (texte brut ou data URL) */
  src: z.string().max(4_000_000),
  width: pos.default(40),
  depth: pos.default(1.5),
});

export const groupParamsSchema = z.object({});

// ---------------------------------------------------------------------------
// Objets de scène
// ---------------------------------------------------------------------------

const baseObject = {
  id: z.string().min(1).max(64),
  name: z.string().max(120).default(''),
  mode: z.enum(['solid', 'hole']).default('solid'),
  transform: transformSchema.default({ position: [0, 0, 0], rotation: [0, 0, 0] }),
  locked: z.boolean().optional(),
  hidden: z.boolean().optional(),
};

export const OBJECT_KINDS = ['box', 'cylinder', 'sphere', 'cone', 'tube', 'text', 'sketch', 'image', 'svg', 'group'] as const;
export type ObjectKind = (typeof OBJECT_KINDS)[number];

const boxObject = z.object({ ...baseObject, kind: z.literal('box'), params: boxParamsSchema });
const cylinderObject = z.object({ ...baseObject, kind: z.literal('cylinder'), params: cylinderParamsSchema });
const sphereObject = z.object({ ...baseObject, kind: z.literal('sphere'), params: sphereParamsSchema });
const coneObject = z.object({ ...baseObject, kind: z.literal('cone'), params: coneParamsSchema });
const tubeObject = z.object({ ...baseObject, kind: z.literal('tube'), params: tubeParamsSchema });
const textObject = z.object({ ...baseObject, kind: z.literal('text'), params: textParamsSchema });
const sketchObject = z.object({ ...baseObject, kind: z.literal('sketch'), params: sketchParamsSchema });
const imageObject = z.object({ ...baseObject, kind: z.literal('image'), params: imageParamsSchema });
const svgObject = z.object({ ...baseObject, kind: z.literal('svg'), params: svgParamsSchema });

type LeafObject =
  | z.output<typeof boxObject>
  | z.output<typeof cylinderObject>
  | z.output<typeof sphereObject>
  | z.output<typeof coneObject>
  | z.output<typeof tubeObject>
  | z.output<typeof textObject>
  | z.output<typeof sketchObject>
  | z.output<typeof imageObject>
  | z.output<typeof svgObject>;

export interface GroupObject {
  id: string;
  name: string;
  kind: 'group';
  mode: 'solid' | 'hole';
  transform: Transform;
  params: Record<string, never>;
  children: SceneObject[];
  locked?: boolean;
  hidden?: boolean;
}

export type SceneObject = LeafObject | GroupObject;

const groupObject: z.ZodType<GroupObject> = z.object({
  ...baseObject,
  kind: z.literal('group'),
  params: groupParamsSchema.default({}),
  get children() {
    return z.array(sceneObjectSchema).max(500);
  },
}) as unknown as z.ZodType<GroupObject>;

export const sceneObjectSchema: z.ZodType<SceneObject> = z.lazy(() =>
  z.discriminatedUnion('kind', [
    boxObject,
    cylinderObject,
    sphereObject,
    coneObject,
    tubeObject,
    textObject,
    sketchObject,
    imageObject,
    svgObject,
    groupObject as unknown as typeof boxObject,
  ]),
) as unknown as z.ZodType<SceneObject>;

// ---------------------------------------------------------------------------
// Pièces et scène
// ---------------------------------------------------------------------------

export const partSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().max(120).default('Pièce'),
  objects: z.array(sceneObjectSchema).max(500).default([]),
  /** Hauteurs Z (mm) où la couleur change ; la pause se fait à la couche suivante */
  colorChanges: z.array(nonNeg).max(20).optional(),
  /** Couleurs des tranches (une de plus que de changements) ; sinon alternance des filaments */
  colors: z.array(z.string().regex(/^#[0-9a-fA-F]{6}$/)).max(21).optional(),
  printOrientation: z.enum(['asModeled', 'flatOnBack']).optional(),
});

export const sceneSchema = z.object({
  version: z.literal(1),
  name: z.string().max(120).default('Sans titre'),
  unit: z.literal('mm').default('mm'),
  printer: z.object({ id: z.string().max(64), bed: size3Schema }),
  layerHeight: z.number().min(0.04).max(1).default(0.2),
  firstLayerHeight: z.number().min(0.04).max(1).default(0.2),
  parts: z.array(partSchema).min(1).max(20),
  /** Modèle paramétrique d'origine (permet de rouvrir ses réglages) */
  template: z
    .object({
      id: z.string().max(64),
      params: z.record(z.string(), z.unknown()),
    })
    .optional(),
});

export type Transform = z.output<typeof transformSchema>;
export type BoxParams = z.output<typeof boxParamsSchema>;
export type CylinderParams = z.output<typeof cylinderParamsSchema>;
export type SphereParams = z.output<typeof sphereParamsSchema>;
export type ConeParams = z.output<typeof coneParamsSchema>;
export type TubeParams = z.output<typeof tubeParamsSchema>;
export type TextParams = z.output<typeof textParamsSchema>;
export type SketchParams = z.output<typeof sketchParamsSchema>;
export type ImageParams = z.output<typeof imageParamsSchema>;
export type SvgParams = z.output<typeof svgParamsSchema>;
export type Segment = z.output<typeof segmentSchema>;
export type Loop = z.output<typeof loopSchema>;
export type Part = z.output<typeof partSchema>;
export type Scene = z.output<typeof sceneSchema>;
export type ObjectOfKind<K extends ObjectKind> = Extract<SceneObject, { kind: K }>;

/** Schémas de paramètres par type (pour valider / compléter un objet partiel). */
export const PARAM_SCHEMAS = {
  box: boxParamsSchema,
  cylinder: cylinderParamsSchema,
  sphere: sphereParamsSchema,
  cone: coneParamsSchema,
  tube: tubeParamsSchema,
  text: textParamsSchema,
  sketch: sketchParamsSchema,
  image: imageParamsSchema,
  svg: svgParamsSchema,
  group: groupParamsSchema,
} as const;

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

/** Identifiant court, unique en pratique. */
export function newId(prefix = 'o'): string {
  const rnd =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 10)
      : Math.random().toString(36).slice(2, 12);
  return `${prefix}_${rnd}`;
}

/** Valide un document de scène ; renvoie la scène complétée par les valeurs par défaut. */
export function parseScene(input: unknown): Scene {
  return sceneSchema.parse(input);
}

export function safeParseScene(input: unknown) {
  return sceneSchema.safeParse(input);
}

/** Parcourt récursivement les objets (groupes inclus). */
export function walkObjects(objects: readonly SceneObject[], fn: (o: SceneObject, depth: number) => void, depth = 0): void {
  for (const o of objects) {
    fn(o, depth);
    if (o.kind === 'group') walkObjects(o.children, fn, depth + 1);
  }
}

/** Libellés français des types d'objets. */
export const KIND_LABELS: Record<ObjectKind, string> = {
  box: 'cube',
  cylinder: 'cylindre',
  sphere: 'sphère',
  cone: 'cône',
  tube: 'tube',
  text: 'texte',
  sketch: 'croquis',
  image: 'image',
  svg: 'dessin SVG',
  group: 'groupe',
};
