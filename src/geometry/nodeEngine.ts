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
      return createEngine(wasm, createBuilders({ loadFont: loadFontFromDisk }));
    })();
  }
  return enginePromise;
}

export async function getNodeWasm() {
  const wasm = await Module();
  wasm.setup();
  return wasm;
}
