import { describe, expect, it } from 'vitest';
import { degrees, dims, formatNumber, mm, parseNumber } from './format';

describe('format (fr-FR)', () => {
  it('utilise la virgule décimale', () => {
    expect(mm(7.8)).toBe('7,8 mm');
    expect(formatNumber(58.2)).toBe('58,2');
  });

  it('affiche les entiers sans décimales', () => {
    expect(mm(220)).toBe('220 mm');
  });

  it('formate les dimensions', () => {
    expect(dims([176, 84, 250])).toBe('176 × 84 × 250 mm');
  });

  it('utilise le signe moins typographique et évite « -0 »', () => {
    expect(degrees(-22)).toBe('−22°');
    expect(formatNumber(-0.01)).toBe('0');
  });

  it('accepte les saisies avec virgule ou point', () => {
    expect(parseNumber('7,8')).toBeCloseTo(7.8);
    expect(parseNumber(' 12.5 ')).toBeCloseTo(12.5);
    expect(parseNumber('−3')).toBe(-3);
    expect(parseNumber('abc')).toBeNaN();
    expect(parseNumber('')).toBeNaN();
  });
});
