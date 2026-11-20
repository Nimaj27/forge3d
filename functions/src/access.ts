/**
 * Accès à l'IA : la clé Anthropic est celle du propriétaire du site, l'IA est donc réservée aux
 * adresses Google listées dans AI_ALLOWED_EMAILS (secret GitHub copié dans l'environnement de la
 * fonction au déploiement). Liste vide ou absente : l'IA est refusée à tout le monde.
 */

export const AI_RESERVED_MESSAGE =
  'L’IA de ce site est réservée à son propriétaire. Le reste de l’application est libre d’accès : partez d’un modèle ou de l’atelier.';

/** « a@x.fr, B@y.fr ; c@z.fr » → { a@x.fr, b@y.fr, c@z.fr } */
export function parseAllowedEmails(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? '')
      .split(/[,;\s]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => /^[^@\s]+@[^@\s]+$/.test(e)),
  );
}

/** Vrai si le compte connecté a une adresse vérifiée présente dans la liste. */
export function isAiAllowed(token: { email?: string; email_verified?: boolean } | undefined, allowed: ReadonlySet<string>): boolean {
  const email = token?.email?.trim().toLowerCase();
  return !!email && token?.email_verified === true && allowed.has(email);
}
