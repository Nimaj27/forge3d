/**
 * Moteur pour Node (tests Vitest, scripts) : charge manifold-3d et les polices depuis le disque.
 */
import Module from 'manifold-3d';
import { createEngine, type Engine } from './engine';
import { createBuilders } from './builders';

let enginePromise: Promise<Engine> | null = null;

export async function loadFontFromDisk(file: string): Promise<ArrayBuffer> {
  const { readFile } = await import('node:fs/promises');
  const { fileURLToPath } = await import('node:url');
  const url = new URL(`../../public/fonts/${file}`, import.meta.url);
  const buf = await readFile(fileURLToPath(url));
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

export function getNodeEngine(): Promise<Engine> {
  if (!enginePromise) {
    enginePromise = (async () => {
      const wasm = await Module();
      wasm.setup();
      return createEngine(wasm, createBuilders({ loadFont: loadFontFromDisk, decodeImage: decodeImageNode }));
    })();
  }
  return enginePromise;
}

export async function getNodeWasm() {
  const wasm = await Module();
  wasm.setup();
  return wasm;
}

/** Décodage d'image pour Node (tests) avec sharp. */
export async function decodeImageNode(src: string, maxSize: number): Promise<import('./image').GrayImage> {
  const sharp = (await import('sharp')).default;
  const m = /^data:[^;]+;base64,(.*)$/s.exec(src);
  if (!m) throw new Error('data URL attendue');
  const { data, info } = await sharp(Buffer.from(m[1], 'base64'))
    .flatten({ background: '#ffffff' })
    .resize(maxSize, maxSize, { fit: 'inside', withoutEnlargement: true })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data: new Uint8Array(data.buffer, data.byteOffset, data.length) };
}
