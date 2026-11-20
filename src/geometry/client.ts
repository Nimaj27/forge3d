/**
 * Accès au worker géométrique depuis l'interface (thread principal).
 * Un seul worker partagé ; les requêtes sont exécutées dans l'ordre par le worker.
 */
import * as Comlink from 'comlink';
import type { GeometryWorkerApi } from './worker';

let remote: Comlink.Remote<GeometryWorkerApi> | null = null;

export function geometry(): Comlink.Remote<GeometryWorkerApi> {
  if (!remote) {
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module', name: 'geometrie' });
    remote = Comlink.wrap<GeometryWorkerApi>(worker);
  }
  return remote;
}

/**
 * Exécute une tâche en ne gardant que la dernière demande en attente :
 * pendant un glissement de curseur, les états intermédiaires sont ignorés.
 */
export class LatestOnly<I, O> {
  private running = false;
  private pending: { input: I; resolve: (o: O | null) => void } | null = null;

  constructor(private readonly task: (input: I) => Promise<O>) {}

  run(input: I): Promise<O | null> {
    return new Promise((resolve) => {
      if (this.pending) this.pending.resolve(null); // remplacée par une demande plus récente
      this.pending = { input, resolve };
      void this.pump();
    });
  }

  private async pump(): Promise<void> {
    if (this.running || !this.pending) return;
    const { input, resolve } = this.pending;
    this.pending = null;
    this.running = true;
    try {
      resolve(await this.task(input));
    } catch (err) {
      console.error(err);
      resolve(null);
    } finally {
      this.running = false;
      void this.pump();
    }
  }
}
