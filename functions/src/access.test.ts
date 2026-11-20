import { describe, expect, it } from 'vitest';
import { isAiAllowed, parseAllowedEmails } from './access';

describe('accès à l’IA (AI_ALLOWED_EMAILS)', () => {
  const allowed = parseAllowedEmails(' Proprio@Exemple.fr, ami@exemple.fr ; pas-une-adresse ');

  it('lit la liste (virgules, points-virgules, espaces, majuscules)', () => {
    expect([...allowed].sort()).toEqual(['ami@exemple.fr', 'proprio@exemple.fr']);
  });

  it('autorise une adresse vérifiée de la liste, quelle que soit la casse', () => {
    expect(isAiAllowed({ email: 'PROPRIO@exemple.fr', email_verified: true }, allowed)).toBe(true);
  });

  it('refuse les autres comptes et les adresses non vérifiées', () => {
    expect(isAiAllowed({ email: 'inconnu@exemple.fr', email_verified: true }, allowed)).toBe(false);
    expect(isAiAllowed({ email: 'proprio@exemple.fr', email_verified: false }, allowed)).toBe(false);
    expect(isAiAllowed({ email: 'proprio@exemple.fr' }, allowed)).toBe(false);
    expect(isAiAllowed(undefined, allowed)).toBe(false);
  });

  it('liste vide ou absente : l’IA est fermée à tout le monde', () => {
    expect(isAiAllowed({ email: 'proprio@exemple.fr', email_verified: true }, parseAllowedEmails(undefined))).toBe(false);
    expect(isAiAllowed({ email: 'proprio@exemple.fr', email_verified: true }, parseAllowedEmails(''))).toBe(false);
  });
});
