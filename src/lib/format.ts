/** Formatage des nombres au format français (« 7,8 mm »). */

/** Espace insécable (typographie française). */
export const NBSP = String.fromCharCode(0xa0);
const MINUS = String.fromCharCode(0x2212);

const cache = new Map<string, Intl.NumberFormat>();

function formatter(min: number, max: number): Intl.NumberFormat {
  const key = `${min}-${max}`;
  let f = cache.get(key);
  if (!f) {
    f = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: min, maximumFractionDigits: max });
    cache.set(key, f);
  }
  return f;
}

/** Nombre au format français ; `-0` est affiché « 0 ». Le signe moins est typographique (U+2212). */
export function formatNumber(value: number, maxDecimals = 1, minDecimals = 0): string {
  if (!Number.isFinite(value)) return '—';
  const rounded = Number(value.toFixed(maxDecimals));
  const v = Object.is(rounded, -0) ? 0 : rounded;
  return formatter(minDecimals, maxDecimals).format(v).replace('-', MINUS);
}

/** « 7,8 mm » */
export function mm(value: number, maxDecimals = 1, minDecimals = 0): string {
  return `${formatNumber(value, maxDecimals, minDecimals)}${NBSP}mm`;
}

/** « 176 × 84 × 250 mm » */
export function dims(size: readonly number[], maxDecimals = 1): string {
  return `${size.map((v) => formatNumber(v, maxDecimals)).join(`${NBSP}×${NBSP}`)}${NBSP}mm`;
}

/** « −22° » */
export function degrees(value: number): string {
  return `${formatNumber(value, 1)}°`;
}

/** Volume en cm³ : « 12,4 cm³ » */
export function volumeCm3(mm3: number): string {
  return `${formatNumber(mm3 / 1000, 1)}${NBSP}cm³`;
}

/** Durée courte : « 120 ms » */
export function ms(value: number): string {
  return `${formatNumber(value, 0)}${NBSP}ms`;
}

/** Analyse une saisie française (« 7,8 ») ou anglaise (« 7.8 ») ; renvoie NaN si invalide. */
export function parseNumber(input: string): number {
  const cleaned = input.trim().replace(/\s/g, '').replace(MINUS, '-').replace(',', '.');
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return Number.NaN;
  return Number(cleaned);
}
