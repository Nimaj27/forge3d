// Génère les icônes PWA (PNG) à partir du logo cube de Forge3D.
// Usage : npm run icons  (les PNG produits sont versionnés dans public/icons)
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const out = path.join(root, 'public', 'icons');

const BG = '#121316';
const FG = '#EDEEF0';
const ACCENT = '#F59E3D';

/** Logo sur fond sombre ; `inset` réduit le logo pour la zone de sécurité « maskable ». */
function svg(size, { inset = 0.16, radius = 0.18 } = {}) {
  const pad = size * inset;
  const scale = (size - 2 * pad) / 24;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${size * radius}" fill="${BG}"/>
  <g transform="translate(${pad} ${pad}) scale(${scale})" fill="none">
    <path d="M12 2.5l8 4.5v9.5l-8 4.5-8-4.5V7z" stroke="${FG}" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M12 11.5l8-4.5M12 11.5v9.5M12 11.5L4 7" stroke="${FG}" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M12 2.5l8 4.5-8 4.5L4 7z" fill="${ACCENT}"/>
  </g>
</svg>`;
}

const targets = [
  { file: 'icon-192.png', size: 192, opts: {} },
  { file: 'icon-512.png', size: 512, opts: {} },
  { file: 'maskable-512.png', size: 512, opts: { inset: 0.26, radius: 0 } },
  { file: 'apple-touch-icon-180.png', size: 180, opts: { inset: 0.18, radius: 0 } },
];

await mkdir(out, { recursive: true });
for (const t of targets) {
  await sharp(Buffer.from(svg(t.size, t.opts))).png().toFile(path.join(out, t.file));
  console.log(`${t.file} (${t.size}px)`);
}
