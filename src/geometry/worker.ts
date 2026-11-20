/// <reference lib="webworker" />
/**
 * Web Worker géométrique : toute la géométrie (manifold-3d WASM) est calculée ici,
 * jamais sur le thread principal. Exposé via Comlink.
 */
import * as Comlink from 'comlink';
import Module from 'manifold-3d';
import wasmUrl from 'manifold-3d/manifold.wasm?url';
import type { Part, SceneObject, Vec3 } from '../../shared/scene';
import { createBuilders } from './builders';
import { createEngine } from './engine';
import type { MeshData } from './types';

const enginePromise = (async () => {
  const wasm = await Module({ locateFile: () => wasmUrl });
  wasm.setup();
  return createEngine(
    wasm,
    createBuilders({
      loadFont: async (file) => {
        const res = await fetch(`/fonts/${file}`);
        if (!res.ok) throw new Error(`Police introuvable : ${file}`);
        return res.arrayBuffer();
      },
    }),
  );
})();

function transferables(mesh: MeshData | null | undefined): Transferable[] {
  return mesh ? [mesh.positions.buffer, mesh.normals.buffer, mesh.indices.buffer] : [];
}

const api = {
  async ready(): Promise<boolean> {
    await enginePromise;
    return true;
  },
  async evaluatePart(part: Part) {
    const engine = await enginePromise;
    const r = await engine.evaluatePart(part);
    return Comlink.transfer(r, transferables(r.mesh));
  },
  async evaluateObject(obj: SceneObject) {
    const engine = await enginePromise;
    const r = await engine.evaluateObject(obj);
    return Comlink.transfer(r, transferables(r.mesh));
  },
  async analyzePart(part: Part, bed: Vec3) {
    const engine = await enginePromise;
    return engine.analyzePart(part, bed);
  },
  async exportPart(part: Part, fileName: string) {
    const engine = await enginePromise;
    const r = await engine.exportPart(part, fileName);
    return Comlink.transfer(r, [r.data]);
  },
  async clear() {
    (await enginePromise).clear();
  },
};

export type GeometryWorkerApi = typeof api;

Comlink.expose(api);
