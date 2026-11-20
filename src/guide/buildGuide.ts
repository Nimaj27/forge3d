/**
 * Mode d'emploi généré (MODE_EMPLOI.md).
 *
 * Le texte rédigé vit dans docs/mode-emploi/*.md ; les marqueurs `<!-- auto:nom -->` y sont remplacés par
 * des listes tirées du code (modèles et réglages, imprimantes, polices, formes, outils, raccourcis) et du
 * CHANGELOG (nouveautés). Ajouter un modèle, un réglage ou un raccourci met donc le mode d'emploi à jour :
 * `npm run guide` le régénère, et un test échoue s'il n'est plus à jour.
 */
import { FONT_INFO, type FontId } from '../../shared/scene';
import { GIZMO_TOOLS, SHAPES } from '../atelier/catalog';
import { NAV_ITEMS } from '../components/navItems';
import { SHORTCUTS } from '../editor/shortcuts';
import { dims, formatNumber, NBSP } from '../lib/format';
import { DEFAULT_PRINTER_ID, PRINTERS } from '../lib/printers';
import { DRAW_TOOLS } from '../sketch/tools';
import { TEMPLATE_CATALOG } from '../templates/catalog';
import { TEMPLATES } from '../templates/registry';
import type { TemplateField } from '../templates/types';

export const SITE_URL = 'https://forge3d.web.app';

export interface GuideFragment {
  /** Nom du fichier (l'ordre alphabétique donne l'ordre des sections) */
  name: string;
  content: string;
}

export interface GuideInput {
  fragments: GuideFragment[];
  /** Contenu de CHANGELOG.md */
  changelog: string;
  /** Version de package.json */
  version: string;
}

const AUTO = /<!--\s*auto:([a-z-]+)\s*-->/g;
const SCREEN = /<!--\s*ecran:\s*(\S+)\s*-->/;

/** Ancre GitHub d'un titre (même règle que l'affichage des fichiers .md sur GitHub). */
export function slug(heading: string): string {
  return heading
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-');
}

/** « a, b et c » */
function frenchList(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} et ${items[items.length - 1]}`;
}

function cell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\n/g, ' / ');
}

function table(head: string[], rows: string[][]): string {
  return [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.map(cell).join(' | ')} |`)].join('\n');
}

function withUnit(value: number, unit?: string): string {
  const n = formatNumber(value, 2);
  if (!unit) return n;
  return unit === '°' ? `${n}°` : `${n}${NBSP}${unit}`;
}

// ---------------------------------------------------------------------------------------------
// Versions et nouveautés (CHANGELOG au format Keep a Changelog)

interface Release {
  version: string;
  date: string;
  body: string;
}

export function parseChangelog(changelog: string): Release[] {
  const releases: Release[] = [];
  const re = /^## \[([^\]]+)\](?:\s*[—-]\s*(\d{4}-\d{2}-\d{2}))?\s*$/gm;
  const heads = [...changelog.matchAll(re)];
  heads.forEach((m, i) => {
    const end = i + 1 < heads.length ? heads[i + 1].index : changelog.length;
    const body = changelog.slice(m.index + m[0].length, end).trim();
    if (m[2]) releases.push({ version: m[1], date: m[2], body });
  });
  return releases;
}

function frenchDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${iso}T12:00:00Z`));
}

function versionLine({ changelog, version }: GuideInput): string {
  const release = parseChangelog(changelog).find((r) => r.version === version);
  const date = release ? ` · mis à jour le ${frenchDate(release.date)}` : '';
  return `**Version ${version}**${date} · ${SITE_URL}`;
}

function news({ changelog }: GuideInput): string {
  return parseChangelog(changelog)
    .slice(0, 3)
    .map((r) => {
      // les sous-titres du CHANGELOG (### Ajouté…) deviennent du gras pour ne pas encombrer le sommaire
      const body = r.body.replace(/^###\s+(.+)$/gm, '**$1**');
      return `### Version ${r.version} (${frenchDate(r.date)})\n\n${body}`;
    })
    .join('\n\n');
}

// ---------------------------------------------------------------------------------------------
// Listes tirées du code

function screens(fragments: GuideFragment[]): string {
  const rows = NAV_ITEMS.map((item) => {
    const fragment = fragments.find((f) => f.content.match(SCREEN)?.[1] === item.to);
    const heading = fragment?.content.match(/^## (.+)$/m)?.[1];
    return [heading ? `[${item.label}](#${slug(heading)})` : item.label, `${SITE_URL.replace('https://', '')}${item.to}`];
  });
  return table(['Écran', 'Adresse directe'], rows);
}

function templatesTable(): string {
  const rows = TEMPLATE_CATALOG.map((info) => {
    const def = TEMPLATES[info.id];
    return [`[${info.name}](#${slug(info.name)})`, info.description, def.sections.map((s) => s.label).join(' · ')];
  });
  return table(['Modèle', 'Pour faire', 'Sections de réglages'], rows);
}

function printersTable(): string {
  const rows = PRINTERS.map((p) => [p.id === DEFAULT_PRINTER_ID ? `${p.name} (par défaut)` : p.name, dims(p.bed, 0)]);
  rows.push(['Personnalisée', 'volume que vous saisissez']);
  return table(['Imprimante', 'Volume d’impression (X × Y × Z)'], rows);
}

function fontsList(): string {
  return (Object.keys(FONT_INFO) as FontId[]).map((id) => `- ${FONT_INFO[id].label}`).join('\n');
}

function shortcutsTable(): string {
  return table(
    ['Touches', 'Action', 'Disponible dans'],
    SHORTCUTS.map((s) => [s.keys.split(' ou ').map((k) => `\`${k}\``).join(' ou '), s.label, s.where]),
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fieldDefault(field: TemplateField<any>, value: unknown): string {
  switch (field.type) {
    case 'number':
    case 'slider':
      return typeof value === 'number' ? withUnit(value, field.unit) : '—';
    case 'toggle':
      return value ? 'Oui' : 'Non';
    case 'select':
      return field.options?.find((o) => o.value === value)?.label ?? String(value ?? '—');
    case 'font':
      return FONT_INFO[value as FontId]?.label ?? String(value ?? '—');
    case 'image':
      return value ? 'image d’exemple' : 'aucune';
    case 'text':
    case 'textarea':
      return typeof value === 'string' && value.trim() ? `« ${value} »` : '(vide)';
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fieldRange(field: TemplateField<any>): string {
  if ((field.type === 'number' || field.type === 'slider') && field.min !== undefined && field.max !== undefined) {
    return `${withUnit(field.min, field.unit)} à ${withUnit(field.max, field.unit)}`;
  }
  if (field.type === 'select') return field.options?.map((o) => o.label).join(' / ') ?? '—';
  if (field.type === 'font') return `${Object.keys(FONT_INFO).length} polices`;
  if (field.type === 'image') return 'image à importer';
  if (field.type === 'toggle') return 'Oui / Non';
  return 'texte libre';
}

function templateSettings(): string {
  return TEMPLATE_CATALOG.map((info) => {
    const def = TEMPLATES[info.id];
    const known = new Set(def.sections.map((s) => s.id));
    const groups = [
      ...def.sections.map((s) => ({ label: s.label, fields: def.fields.filter((f) => f.section === s.id) })),
      { label: 'Autres réglages', fields: def.fields.filter((f) => !known.has(f.section)) },
    ].filter((g) => g.fields.length);
    const blocks = groups.map((g) => {
      const rows = g.fields.map((f) => {
        const label = f.help ? `${f.label} — *${f.help}*` : f.label;
        return [label, fieldDefault(f, (def.defaults as Record<string, unknown>)[f.key]), fieldRange(f)];
      });
      return `**${g.label}**\n\n${table(['Réglage', 'Par défaut', 'Valeurs possibles'], rows)}`;
    });
    return `### ${info.name}\n\n${info.description}.\n\n${blocks.join('\n\n')}`;
  }).join('\n\n');
}

// ---------------------------------------------------------------------------------------------

type Generator = (input: GuideInput) => string;

const GENERATORS: Record<string, Generator> = {
  version: versionLine,
  ecrans: ({ fragments }) => screens(fragments),
  imprimantes: printersTable,
  modeles: templatesTable,
  polices: fontsList,
  formes: () => frenchList(SHAPES.map((s) => `**${s.label}**`)),
  'outils-atelier': () => frenchList(GIZMO_TOOLS.map((t) => `**${t.label}**`)),
  'outils-croquis': () => frenchList(DRAW_TOOLS.map((t) => `**${t.label}**`)),
  raccourcis: shortcutsTable,
  nouveautes: news,
  'reglages-modeles': templateSettings,
};

/** Construit MODE_EMPLOI.md. Lève une erreur sur un marqueur inconnu. */
export function buildGuide(input: GuideInput): string {
  const fragments = [...input.fragments].sort((a, b) => a.name.localeCompare(b.name));
  let doc = fragments
    .map((f) => f.content.replace(SCREEN, '').trim())
    .join('\n\n');
  doc = doc.replace(AUTO, (_, name: string) => {
    if (name === 'sommaire') return '<!-- auto:sommaire -->';
    const gen = GENERATORS[name];
    if (!gen) throw new Error(`Marqueur inconnu dans le mode d’emploi : auto:${name}`);
    return gen(input);
  });
  // sommaire : titres de niveau 2 du document final
  const headings = [...doc.matchAll(/^## (.+)$/gm)].map((m) => m[1]).filter((h) => h !== 'Sommaire');
  doc = doc.replace('<!-- auto:sommaire -->', headings.map((h) => `- [${h}](#${slug(h)})`).join('\n'));
  const header =
    '<!-- Fichier généré : ne pas le modifier à la main. Le texte se rédige dans docs/mode-emploi/, ' +
    'les listes viennent du code. Régénérer avec « npm run guide ». -->';
  return `${header}\n\n${doc.replace(/\n{3,}/g, '\n\n').trim()}\n`;
}
