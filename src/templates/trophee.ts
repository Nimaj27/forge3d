/**
 * Modèle « Trophée » (2 pièces) : socle gravé en coque loft d'octogones, inscription sur la face
 * avant inclinée, filet décoratif, mortaise ; bouclier imprimé à plat avec écu de Normandie
 * (2 léopards, bordure à rivets), banderole courbe à pans en queue d'aronde et tenon.
 * Cotes de référence pour une hauteur totale de 250 mm (brief §6).
 */
import { z } from 'zod';
import { FONT_IDS, type Loop, type Vec2 } from '../../shared/scene';
import { loopToPolygon } from '../geometry/curves';
import { shapeToLoop, type PathSeg } from '../sketch/model';
import { LEOPARD_SVG } from './leopard';
import { pointsAlong, polyLoop, shieldLoop } from './shapes';
import { obj, snapToLayer, templateScene, type TemplateDef } from './types';

const OR = '#D6A838';
const GRIS = '#9A9DA2';

export const schema = z.object({
  ligne1: z.string().max(60).default('PRÉSIDENT DU DÉPARTEMENT'),
  ligne2: z.string().max(60).default('DE L’EURE'),
  nom: z.string().max(60).default('ALEXANDRE RASSAËRT'),
  banderole: z.string().max(40).default('DÉFIS SPORTIFS'),
  police: z.enum(FONT_IDS).default('classique'),
  hauteurTotale: z.number().min(150).max(250).default(250),
  blason: z.enum(['normandie', 'aucun', 'image']).default('normandie'),
  image: z.string().default(''),
  hauteurNom: z.number().min(3).max(12).default(6.6),
  relief: z.number().min(0.6).max(2).default(1),
});
export type TropheeParams = z.output<typeof schema>;
export const defaults: TropheeParams = schema.parse({});

/** Constantes d'impression (indépendantes de l'échelle). */
const PLATE = 7.6; // épaisseur du bouclier sous les reliefs (pause à 7,8 mm)
const TOP = 9.8; // épaisseur totale du bouclier
const TENON_T = 6;
const JEU = 0.25;

/** Contour du bouclier (y = hauteur au-dessus du socle), hauteur maximale exacte `hMax`. */
function shieldOutline(k: number, hMax: number): Loop {
  const right: Vec2[] = [
    [28, 0],
    [14, 20],
    [38, 32],
    [74, 52],
    [88, 82],
    [88, 177],
    [44, 179],
    [0, 175],
  ];
  const pts: Vec2[] = [...right, ...right.slice(0, -1).reverse().map(([x, y]) => [-x, y] as Vec2)];
  // P0..P7 (droite + sommet), puis P8..P14 (gauche, du haut vers le pied)
  const points = pts.map(([x, y]) => [x * k, y * k] as Vec2);
  const segs: PathSeg[] = [
    { t: 'line' }, // P0 → P1 (pied)
    { t: 'curve' },
    { t: 'curve' },
    { t: 'curve' },
    { t: 'line' }, // flanc droit
    { t: 'curve' },
    { t: 'curve' },
    { t: 'curve' },
    { t: 'curve' },
    { t: 'line' }, // flanc gauche
    { t: 'curve' },
    { t: 'curve' },
    { t: 'curve' },
    { t: 'line' }, // vers le pied gauche
    { t: 'line' }, // fond du pied
  ];
  let loop = shapeToLoop({ id: 'b', kind: 'path', points, segs });
  // ajuste la hauteur maximale exactement (les courbes peuvent dépasser légèrement)
  const maxY = Math.max(...loopToPolygon(loop, 0.01).map((p) => p[1]));
  const f = hMax / maxY;
  loop = shapeToLoop({ id: 'b', kind: 'path', points: points.map(([x, y]) => [x, y * f]), segs });
  return loop;
}

/** Secteur d'anneau (bande de la banderole), de l'angle a0 à a1 (degrés depuis la verticale). */
function bandLoop(cy: number, r0: number, r1: number, a0: number, a1: number, steps = 48): Loop {
  const pts: Vec2[] = [];
  const P = (r: number, a: number): Vec2 => [r * Math.sin((a * Math.PI) / 180), cy + r * Math.cos((a * Math.PI) / 180)];
  for (let i = 0; i <= steps; i++) pts.push(P(r1, a1 - ((a1 - a0) * i) / steps));
  for (let i = 0; i <= steps; i++) pts.push(P(r0, a0 + ((a1 - a0) * i) / steps));
  return polyLoop(pts);
}

/** Pan de banderole en queue d'aronde (côté s = ±1). */
function tailLoop(cy: number, rMid: number, half: number, a0: number, a1: number, s: 1 | -1): Loop {
  const P = (r: number, a: number): Vec2 => [s * r * Math.sin((a * Math.PI) / 180), cy + r * Math.cos((a * Math.PI) / 180)];
  const pts: Vec2[] = [];
  const steps = 12;
  for (let i = 0; i <= steps; i++) pts.push(P(rMid + half, a0 + ((a1 - a0) * i) / steps));
  pts.push(P(rMid, a1 - 2.4)); // encoche
  for (let i = 0; i <= steps; i++) pts.push(P(rMid - half, a1 - ((a1 - a0) * i) / steps));
  return polyLoop(s === 1 ? pts : [...pts].reverse());
}

export const trophee: TemplateDef<TropheeParams> = {
  id: 'trophee',
  name: 'Trophée',
  defaults,
  schema,
  sections: [
    { id: 'socle', label: 'Socle : inscription', objects: ['socle', 'inscription', 'mortaise'] },
    { id: 'bouclier', label: 'Bouclier : banderole et blason', objects: ['bouclier', 'banderole', 'ecu', 'leopard', 'rivets', 'tenon', 'pan'] },
    { id: 'general', label: 'Dimensions' },
  ],
  fields: [
    { key: 'ligne1', label: 'Ligne 1', type: 'text', section: 'socle' },
    { key: 'ligne2', label: 'Ligne 2', type: 'text', section: 'socle' },
    { key: 'nom', label: 'Nom (ligne 3)', type: 'text', section: 'socle' },
    { key: 'police', label: 'Police', type: 'font', section: 'socle' },
    { key: 'hauteurNom', label: 'Hauteur des lettres du nom', type: 'slider', section: 'socle', min: 3, max: 10, step: 0.1, unit: 'mm' },
    { key: 'relief', label: 'Relief des textes', type: 'slider', section: 'socle', min: 0.6, max: 2, step: 0.1, unit: 'mm' },
    { key: 'banderole', label: 'Texte de la banderole (vide : aucune)', type: 'text', section: 'bouclier' },
    {
      key: 'blason',
      label: 'Blason',
      type: 'select',
      section: 'bouclier',
      options: [
        { value: 'normandie', label: 'Normandie (2 léopards)' },
        { value: 'aucun', label: 'Aucun' },
        { value: 'image', label: 'Image importée' },
      ],
    },
    { key: 'image', label: 'Image du blason', type: 'image', section: 'bouclier', showIf: (p) => p.blason === 'image' },
    { key: 'hauteurTotale', label: 'Hauteur totale', type: 'slider', section: 'general', min: 150, max: 250, step: 1, unit: 'mm' },
  ],
  extraChecks: (p) => {
    const k = p.hauteurTotale / 250;
    // estimation grossière de la largeur des lignes (Cinzel est une police large)
    const width = (s: string, cap: number) => s.length * cap * 0.82;
    const face = 146 * k;
    const capL = Math.min(5.2, p.hauteurNom * 0.8) * k;
    const tooLong = [width(p.ligne1, capL), width(p.ligne2, capL), width(p.nom, p.hauteurNom * k)].some((w) => w > face);
    return [
      { level: 'ok', message: `Tenon / mortaise : jeu ${String(JEU).replace('.', ',')} mm` },
      ...(tooLong ? [{ level: 'warn' as const, message: 'Une ligne du socle est probablement trop longue pour la face avant' }] : []),
    ];
  },
  build(p, printer) {
    const k = p.hauteurTotale / 250;
    const S = (v: number) => v * k;
    const relief = p.relief;

    // ------------------------------------------------------------------ socle
    const H = S(70);
    const sec = (z: number, w: number, d: number, c: number) => ({ z: S(z), width: S(w), depth: S(d), chamfer: S(c) });
    const sections = [
      sec(0, 170, 84, 6),
      sec(6.5, 170, 84, 6),
      sec(8, 167, 81, 5), // chanfrein supérieur de la plinthe
      sec(8, 158, 72, 4), // retrait : début du corps
      sec(56, 148, 62, 4), // corps incliné vers l'arrière
      sec(62.5, 160, 74, 5), // dessous de corniche à ~43° (sans support)
      sec(68.5, 160, 74, 5),
      sec(70, 157, 71, 4),
    ];
    // face avant du corps : y(z) = −depth(z)/2 ; inclinaison θ
    const d0 = S(72);
    const d1 = S(62);
    const z0 = S(8);
    const z1 = S(56);
    const theta = Math.atan((d0 - d1) / 2 / (z1 - z0));
    const zc = S(31.5);
    const yFace = -(d0 - ((zc - z0) / (z1 - z0)) * (d0 - d1)) / 2;
    const inward = 0.5;
    const groupPos: [number, number, number] = [0, yFace + inward * Math.cos(theta), zc - inward * Math.sin(theta)];
    const capL = Math.min(5.2, p.hauteurNom * 0.8) * k;
    const depth = relief + 0.5;
    const text = (id: string, name: string, value: string, cap: number, y: number) =>
      obj(id, name, 'text', { text: value, font: p.police, capHeight: cap, depth, thicken: 0.06 }, { position: [0, y, 0] });
    const inscription: Record<string, unknown>[] = [];
    if (p.ligne1.trim()) inscription.push(text('inscription-ligne1', 'Ligne 1', p.ligne1, capL, S(13.5)));
    if (p.ligne2.trim()) inscription.push(text('inscription-ligne2', 'Ligne 2', p.ligne2, capL, S(6)));
    inscription.push(
      obj('inscription-filet-g', 'Filet gauche', 'box', { size: [S(34), 1.2, depth] }, { position: [-S(23), S(-0.5), 0] }),
      obj('inscription-filet-d', 'Filet droit', 'box', { size: [S(34), 1.2, depth] }, { position: [S(23), S(-0.5), 0] }),
      obj('inscription-losange', 'Losange', 'box', { size: [3.2, 3.2, depth] }, { position: [0, S(-0.5), 0], rotation: [0, 0, 45] }),
    );
    if (p.nom.trim()) inscription.push(text('inscription-nom', 'Nom', p.nom, p.hauteurNom * k, S(-9)));

    const mortiseD = S(20) + JEU * 2;
    const socle = [
      obj('socle', 'Plinthe, corps, corniche', 'loft', { sections }),
      obj('inscription', 'Inscription', 'group', {}, { position: groupPos, rotation: [90 - (theta * 180) / Math.PI, 0, 0] }, 'solid', inscription),
      obj('mortaise', 'Mortaise (emboîtement)', 'box', { size: [S(46) + 2 * JEU, TENON_T + 2 * JEU, mortiseD + 1] }, { position: [0, 0, H - mortiseD] }, 'hole'),
    ];

    // --------------------------------------------------------------- bouclier
    const hShield = S(180);
    const children: Record<string, unknown>[] = [
      obj('bouclier-plaque', 'Plaque et bordure', 'sketch', { loops: [shieldOutline(k, hShield)], op: 'extrude', height: PLATE }),
      obj('tenon', 'Tenon', 'box', { size: [S(46), S(20) + 0.5, TENON_T] }, { position: [0, (-S(20) + 0.5) / 2, 0] }),
    ];
    const zr = PLATE - 0.5;
    const hr = TOP - zr;
    if (p.blason !== 'aucun') {
      const ecuTop: Vec2 = [0, S(168)];
      const ecuW = S(104);
      const ecuH = S(96);
      const frame = S(5);
      children.push(
        obj('ecu', 'Écu : bordure', 'sketch', { loops: [shieldLoop(ecuW, ecuH, 0, ecuTop), shieldLoop(ecuW, ecuH, frame, ecuTop)], op: 'extrude', height: hr }, { position: [0, 0, zr] }),
      );
      const rivetPath = loopToPolygon(shieldLoop(ecuW, ecuH, frame / 2, ecuTop), 0.2);
      const rivets = pointsAlong(rivetPath, S(7.5)).map(([x, y], i) =>
        obj(`rivet-${i + 1}`, `Rivet ${i + 1}`, 'cylinder', { radius: 0.8, height: 1.2, segments: 16 }, { position: [x, y, 0] }),
      );
      children.push(obj('rivets', 'Rivets', 'group', {}, { position: [0, 0, TOP - 0.6] }, 'hole', rivets));
      if (p.blason === 'normandie') {
        const w = S(64);
        children.push(
          obj('leopard-1', 'Léopard du haut', 'svg', { src: LEOPARD_SVG, width: w, depth: hr }, { position: [0, S(143), zr] }),
          obj('leopard-2', 'Léopard du bas', 'svg', { src: LEOPARD_SVG, width: w, depth: hr }, { position: [0, S(107), zr] }),
        );
      } else if (p.image) {
        children.push(obj('leopard-image', 'Image du blason', 'image', { src: p.image, width: S(70), mode: 'threshold', maxHeight: hr }, { position: [0, S(122), zr] }));
      }
    }
    if (p.banderole.trim()) {
      const rMid = S(252);
      const cy = S(74) - rMid;
      const half = S(8);
      const span = 16;
      children.push(
        obj('pan-gauche', 'Pan gauche', 'sketch', { loops: [tailLoop(cy, rMid, half + S(1), span - 3, 24.2, -1)], op: 'extrude', height: PLATE }),
        obj('pan-droit', 'Pan droit', 'sketch', { loops: [tailLoop(cy, rMid, half + S(1), span - 3, 24.2, 1)], op: 'extrude', height: PLATE }),
        obj(
          'banderole',
          'Banderole : cadre',
          'sketch',
          { loops: [bandLoop(cy, rMid - half, rMid + half, -span, span), bandLoop(cy, rMid - half + 1.6, rMid + half - 1.6, -span + 0.5, span - 0.5)], op: 'extrude', height: hr },
          { position: [0, 0, zr] },
        ),
        obj(
          'banderole-texte',
          `Banderole « ${p.banderole} »`,
          'text',
          { text: p.banderole, font: p.police, capHeight: S(7), depth: hr, onArc: { radius: rMid, baselineOffset: 0 } },
          { position: [0, S(74), zr] },
        ),
      );
    }
    const bouclier = [obj('bouclier', 'Bouclier', 'group', {}, { position: [0, TENON_T / 2, H], rotation: [90, 0, 0] }, 'solid', children)];

    return templateScene(
      'trophee',
      'Trophée',
      printer,
      [
        { id: 'bouclier', name: 'Bouclier', objects: bouclier, printOrientation: 'flatOnBack', colorChanges: [PLATE], colors: [GRIS, OR] },
        { id: 'socle', name: 'Socle', objects: socle, colorChanges: [snapToLayer(S(8)), snapToLayer(S(58))], colors: [OR, GRIS, OR] },
      ],
      p,
    );
  },
};
