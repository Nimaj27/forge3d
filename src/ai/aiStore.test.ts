import { describe, expect, it } from 'vitest';
import { aiErrorMessage } from './aiStore';

describe('messages d’erreur de l’IA', () => {
  it('reconnaît l’IA réservée au propriétaire du site', () => {
    const err = { code: 'functions/permission-denied', message: 'L’IA de ce site est réservée à son propriétaire.', details: { reason: 'ai-reserved' } };
    expect(aiErrorMessage(err)).toEqual({ text: err.message, notConfigured: false, reserved: true });
  });

  it('un refus de contenu n’est pas confondu avec l’IA réservée', () => {
    const err = { code: 'functions/permission-denied', message: 'Demande refusée.' };
    expect(aiErrorMessage(err).reserved).toBeUndefined();
  });

  it('fonction absente : mode IA non configuré', () => {
    expect(aiErrorMessage({ code: 'functions/not-found', message: '' }).notConfigured).toBe(true);
    expect(aiErrorMessage({ code: 'functions/internal', message: 'CORS error' }).notConfigured).toBe(true);
  });
});
