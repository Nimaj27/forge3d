/** Création d'objets et de scènes avec des valeurs par défaut sensées. */
import {
  newId,
  parseScene,
  sceneObjectSchema,
  type ObjectKind,
  type Scene,
  type SceneObject,
  type Vec3,
} from '../../shared/scene';

const DEFAULT_NAMES: Record<ObjectKind, string> = {
  box: 'Cube',
  cylinder: 'Cylindre',
  sphere: 'Sphère',
  cone: 'Cône',
  tube: 'Tube',
  text: 'Texte',
  sketch: 'Croquis',
  image: 'Image',
  svg: 'Dessin',
  loft: 'Coque',
  group: 'Groupe',
};

/** Paramètres par défaut d'une forme ajoutée depuis l'atelier. */
const STARTER_PARAMS: Partial<Record<ObjectKind, Record<string, unknown>>> = {
  box: { size: [20, 20, 20] },
  cylinder: { radius: 10, height: 20 },
  sphere: { radius: 10 },
  cone: { radiusBottom: 10, radiusTop: 0, height: 20 },
  tube: { outerRadius: 10, innerRadius: 7, height: 20 },
  text: { text: 'Texte', capHeight: 10, depth: 2 },
};

/** Crée un objet complet et validé (le nom est numéroté par l'appelant si besoin). */
export function createObject(
  kind: Exclude<ObjectKind, 'group'>,
  overrides: { name?: string; mode?: 'solid' | 'hole'; position?: Vec3; rotation?: Vec3; params?: Record<string, unknown> } = {},
): SceneObject {
  return sceneObjectSchema.parse({
    id: newId(),
    name: overrides.name ?? DEFAULT_NAMES[kind],
    kind,
    mode: overrides.mode ?? 'solid',
    transform: { position: overrides.position ?? [0, 0, 0], rotation: overrides.rotation ?? [0, 0, 0] },
    params: { ...STARTER_PARAMS[kind], ...overrides.params },
  });
}

export function createGroup(children: SceneObject[], name = 'Groupe', position: Vec3 = [0, 0, 0]): SceneObject {
  return sceneObjectSchema.parse({
    id: newId('g'),
    name,
    kind: 'group',
    mode: 'solid',
    transform: { position, rotation: [0, 0, 0] },
    params: {},
    children,
  });
}

/** Scène vide avec une pièce. */
export function emptyScene(printer: { id: string; bed: Vec3 }, name = 'Sans titre'): Scene {
  return parseScene({
    version: 1,
    name,
    printer,
    parts: [{ id: newId('p'), name: 'Pièce 1', objects: [] }],
  });
}

/** Scène de démonstration du jalon J1 : un cube percé par un cylindre « trou ». */
export function demoScene(printer: { id: string; bed: Vec3 }): Scene {
  return parseScene({
    version: 1,
    name: 'Cube percé',
    printer,
    parts: [
      {
        id: newId('p'),
        name: 'Cube percé',
        objects: [
          createObject('box', { name: 'Cube', params: { size: [40, 40, 20], edgeRadius: 0 } }),
          createObject('cylinder', {
            name: 'Perçage',
            mode: 'hole',
            position: [0, 0, -1],
            params: { radius: 8, height: 22 },
          }),
        ],
      },
    ],
  });
}

/** Nom libre numéroté : « Cube 2 » si « Cube » existe déjà. */
export function uniqueName(base: string, existing: Iterable<string>): string {
  const names = new Set(existing);
  if (!names.has(base)) return base;
  for (let i = 2; i < 1000; i++) if (!names.has(`${base} ${i}`)) return `${base} ${i}`;
  return base;
}

export function defaultName(kind: ObjectKind): string {
  return DEFAULT_NAMES[kind];
}
