import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { NAV_ITEMS } from '../components/navItems';
import { SHORTCUTS } from '../editor/shortcuts';
import { TEMPLATE_CATALOG } from '../templates/catalog';
import { TEMPLATES } from '../templates/registry';
import { buildGuide, parseChangelog, slug, type GuideInput } from './buildGuide';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

function readInput(): GuideInput {
  const dir = join(root, 'docs/mode-emploi');
  const fragments = readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((name) => ({ name, content: readFileSync(join(dir, name), 'utf8') }));
  return {
    fragments,
    changelog: readFileSync(join(root, 'CHANGELOG.md'), 'utf8'),
    version: (JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { version: string }).version,
  };
}

describe('mode d’emploi (MODE_EMPLOI.md)', () => {
  const input = readInput();
  const guide = buildGuide(input);

  it('chaque écran du menu a sa section rédigée', () => {
    for (const item of NAV_ITEMS) {
      const documented = input.fragments.some((f) => f.content.includes(`<!-- ecran: ${item.to} -->`));
      expect(documented, `Ajoutez une section avec <!-- ecran: ${item.to} --> dans docs/mode-emploi/`).toBe(true);
    }
  });

  it('liste chaque modèle et chacun de ses réglages', () => {
    for (const info of TEMPLATE_CATALOG) {
      expect(guide).toContain(`### ${info.name}`);
      for (const field of TEMPLATES[info.id].fields) expect(guide).toContain(field.label);
    }
  });

  it('liste chaque raccourci clavier', () => {
    for (const s of SHORTCUTS) expect(guide).toContain(s.label);
  });

  it('la version courante figure dans le CHANGELOG et en tête du mode d’emploi', () => {
    expect(parseChangelog(input.changelog).map((r) => r.version)).toContain(input.version);
    expect(guide).toContain(`**Version ${input.version}**`);
  });

  it('tous les liens internes pointent vers un titre existant', () => {
    const anchors = new Set([...guide.matchAll(/^#{1,4} (.+)$/gm)].map((m) => slug(m[1])));
    for (const [, target] of guide.matchAll(/\]\(#([^)]+)\)/g)) expect(anchors, `lien #${target}`).toContain(target);
  });

  it('MODE_EMPLOI.md est à jour (sinon : npm run guide)', async () => {
    await expect(guide).toMatchFileSnapshot('../../MODE_EMPLOI.md');
  });
});
