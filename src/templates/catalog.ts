/** Métadonnées des modèles paramétriques affichées dans la galerie. */
export interface TemplateInfo {
  id: TemplateId;
  name: string;
  description: string;
  /** Mots-clés pour la recherche */
  keywords: string;
}

export type TemplateId = 'trophee' | 'plaque' | 'porte-cles' | 'boite' | 'support-telephone' | 'image-relief';

export const TEMPLATE_CATALOG: TemplateInfo[] = [
  {
    id: 'trophee',
    name: 'Trophée',
    description: 'Socle gravé + bouclier, blason, banderole',
    keywords: 'coupe récompense sport normandie léopard',
  },
  { id: 'plaque', name: 'Plaque gravée', description: 'Texte, logo, trous de fixation', keywords: 'porte nom plaque' },
  { id: 'porte-cles', name: 'Porte-clés', description: 'Prénom, forme, anneau', keywords: 'clé cle prénom' },
  { id: 'boite', name: 'Boîte à couvercle', description: 'Dimensions intérieures, jeu', keywords: 'rangement boite' },
  {
    id: 'support-telephone',
    name: 'Support téléphone',
    description: 'Angle, largeur, passe-câble',
    keywords: 'smartphone tablette stand',
  },
  { id: 'image-relief', name: 'Image en relief', description: 'Logo ou photo en 3D', keywords: 'lithophane photo logo' },
];
