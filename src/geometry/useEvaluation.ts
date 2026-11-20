/**
 * Hooks React d'évaluation géométrique (recalcul avec anti-rebond à chaque modification).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Part, SceneObject, Vec3 } from '../../shared/scene';
import { geometry, LatestOnly } from './client';
import type { ObjectEvaluation, PartEvaluation, PartReport } from './types';

const EVAL_DEBOUNCE = 60;
const REPORT_DEBOUNCE = 450;

/** Évaluation rapide de toutes les pièces (aperçu). */
export function usePartEvaluations(parts: readonly Part[]): { evaluations: Record<string, PartEvaluation>; busy: boolean } {
  const [evaluations, setEvaluations] = useState<Record<string, PartEvaluation>>({});
  const [busy, setBusy] = useState(false);
  const runners = useRef(new Map<string, LatestOnly<Part, PartEvaluation>>());

  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    const timer = setTimeout(async () => {
      const results = await Promise.all(
        parts.map((p) => {
          let r = runners.current.get(p.id);
          if (!r) {
            r = new LatestOnly((part: Part) => geometry().evaluatePart(part));
            runners.current.set(p.id, r);
          }
          return r.run(p);
        }),
      );
      if (cancelled) return;
      setEvaluations((prev) => {
        const next: Record<string, PartEvaluation> = {};
        parts.forEach((p, i) => {
          const res = results[i];
          if (res) next[p.id] = res;
          else if (prev[p.id]) next[p.id] = prev[p.id];
        });
        return next;
      });
      setBusy(false);
    }, EVAL_DEBOUNCE);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [parts]);

  return { evaluations, busy };
}

/** Vérifications avant impression (plus lentes, anti-rebond plus long). */
export function usePartReports(parts: readonly Part[], bed: Vec3): { reports: Record<string, PartReport>; busy: boolean } {
  const [reports, setReports] = useState<Record<string, PartReport>>({});
  const [busy, setBusy] = useState(false);
  const runner = useMemo(
    () => new LatestOnly(async (input: { parts: readonly Part[]; bed: Vec3 }) => Promise.all(input.parts.map((p) => geometry().analyzePart(p, input.bed)))),
    [],
  );
  const bedKey = bed.join('x');

  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    const timer = setTimeout(async () => {
      const res = await runner.run({ parts, bed });
      if (cancelled || !res) return;
      setReports(Object.fromEntries(res.map((r) => [r.partId, r])));
      setBusy(false);
    }, REPORT_DEBOUNCE);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // bedKey suffit : `bed` est recréé à chaque rendu
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parts, bedKey, runner]);

  return { reports, busy };
}

/** Maillage d'un objet seul (surbrillance de la sélection, atelier). */
export function useObjectEvaluation(obj: SceneObject | null): ObjectEvaluation | null {
  const [result, setResult] = useState<ObjectEvaluation | null>(null);
  const runner = useMemo(() => new LatestOnly((o: SceneObject) => geometry().evaluateObject(o)), []);
  useEffect(() => {
    if (!obj) {
      setResult(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      const r = await runner.run(obj);
      if (!cancelled && r) setResult(r);
    }, EVAL_DEBOUNCE);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [obj, runner]);
  return result && obj && result.objectId === obj.id ? result : null;
}
