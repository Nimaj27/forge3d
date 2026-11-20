/** Cache LRU et empreintes stables pour le moteur géométrique. */

export interface Disposable {
  delete(): void;
}

/** Cache LRU qui libère la mémoire WASM des entrées évincées. */
export class LruCache<V> {
  private map = new Map<string, V>();

  constructor(
    private readonly max: number,
    private readonly onEvict?: (value: V) => void,
  ) {}

  get(key: string): V | undefined {
    const v = this.map.get(key);
    if (v !== undefined) {
      this.map.delete(key);
      this.map.set(key, v);
    }
    return v;
  }

  set(key: string, value: V): void {
    const prev = this.map.get(key);
    if (prev !== undefined && prev !== value) this.onEvict?.(prev);
    this.map.delete(key);
    this.map.set(key, value);
    while (this.map.size > this.max) {
      const oldest = this.map.keys().next().value as string;
      const v = this.map.get(oldest);
      this.map.delete(oldest);
      if (v !== undefined) this.onEvict?.(v);
    }
  }

  clear(): void {
    if (this.onEvict) for (const v of this.map.values()) this.onEvict(v);
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }
}

/** Sérialisation JSON à clés triées (ordre des clés indifférent). */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

/** Empreinte 64 bits (deux FNV-1a 32 bits) d'une chaîne, en hexadécimal. */
export function hashString(s: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ c, 0x5bd1e995);
    h2 ^= h2 >>> 15;
  }
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
}

export function hashValue(value: unknown): string {
  return hashString(stableStringify(value));
}

/** Collecte les objets WASM intermédiaires pour les libérer en une fois. */
export class Arena {
  private items: Disposable[] = [];

  track<T extends Disposable>(item: T): T {
    this.items.push(item);
    return item;
  }

  /** Retire un objet de l'arène (il survivra à `dispose`). */
  release<T extends Disposable>(item: T): T {
    const i = this.items.lastIndexOf(item);
    if (i >= 0) this.items.splice(i, 1);
    return item;
  }

  dispose(): void {
    for (const it of this.items) {
      try {
        it.delete();
      } catch {
        /* déjà libéré */
      }
    }
    this.items = [];
  }
}
