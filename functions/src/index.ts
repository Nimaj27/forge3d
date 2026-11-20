/**
 * Cloud Functions de Forge3D (2ᵉ génération, europe-west1).
 * `generateScene` : la clé Anthropic reste dans Secret Manager, jamais dans le navigateur.
 */
import Anthropic from '@anthropic-ai/sdk';
import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { defineSecret } from 'firebase-functions/params';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { DEFAULT_MODEL, GenerationError, generateScene, inputSchema } from './generate';

initializeApp();

const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');

/** Nombre de générations par jour et par utilisateur. */
export const DAILY_LIMIT = Number(process.env.DAILY_LIMIT ?? 30);

/** Jour courant (heure de Paris) : « 20261120 ». */
export function dayKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}${get('month')}${get('day')}`;
}

/** Réserve une génération dans le quota du jour (écrit uniquement côté serveur). */
async function reserveQuota(uid: string): Promise<() => Promise<void>> {
  const ref = getFirestore().doc(`usage/${uid}/days/${dayKey()}`);
  await getFirestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const count = (snap.get('count') as number | undefined) ?? 0;
    if (count >= DAILY_LIMIT) {
      throw new HttpsError('resource-exhausted', `Limite de ${DAILY_LIMIT} créations par jour atteinte. Revenez demain !`);
    }
    tx.set(ref, { count: count + 1, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });
  // en cas d'échec, la génération est rendue
  return async () => {
    await ref.set({ count: FieldValue.increment(-1), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  };
}

export const generateScene_ = onCall(
  {
    region: 'europe-west1',
    secrets: [ANTHROPIC_API_KEY],
    timeoutSeconds: 300,
    memory: '512MiB',
    maxInstances: 10,
    cors: true,
  },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Connectez-vous avec Google pour utiliser l’IA.');
    const key = ANTHROPIC_API_KEY.value();
    if (!key) throw new HttpsError('failed-precondition', 'Mode IA non configuré.');
    const parsed = inputSchema.safeParse(request.data);
    if (!parsed.success) throw new HttpsError('invalid-argument', 'Demande invalide (description trop longue ou image trop lourde).');
    const input = parsed.data;
    const bed = input.printer?.bed ?? [220, 220, 220];
    const refund = await reserveQuota(request.auth.uid);
    try {
      const client = new Anthropic({ apiKey: key, timeout: 240_000, maxRetries: 1 });
      return await generateScene(client, input, { model: process.env.CLAUDE_MODEL || DEFAULT_MODEL, bed, printerId: input.printer?.id ?? 'ff-5m-pro' });
    } catch (err) {
      await refund().catch(() => undefined);
      if (err instanceof GenerationError) throw new HttpsError(err.code === 'refusal' ? 'permission-denied' : 'aborted', err.message);
      if (err instanceof Anthropic.RateLimitError) throw new HttpsError('resource-exhausted', 'Le service IA est très sollicité, réessayez dans une minute.');
      if (err instanceof Anthropic.AuthenticationError) throw new HttpsError('failed-precondition', 'Mode IA non configuré (clé invalide).');
      if (err instanceof Anthropic.APIError) throw new HttpsError('unavailable', 'Le service IA ne répond pas, réessayez.');
      if (err instanceof HttpsError) throw err;
      console.error(err);
      throw new HttpsError('internal', 'Erreur inattendue pendant la génération.');
    }
  },
);

// Nom public de la fonction appelée par l'application
export { generateScene_ as generateScene };
