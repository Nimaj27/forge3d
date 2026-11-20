import { describe, expect, it } from 'vitest';
import { colorBands, pauseHeight, pauseHeights } from './layers';

describe('pauses de couleur', () => {
  const first = 0.2;
  const layer = 0.2;

  it('pause au plus petit sommet de couche strictement supérieur', () => {
    expect(pauseHeight(7.7, first, layer)).toBe(7.8);
    expect(pauseHeight(7.6, first, layer)).toBe(7.8); // 7,6 est un sommet : strictement supérieur
    expect(pauseHeight(8.0, first, layer)).toBe(8.2);
    expect(pauseHeight(58.0, first, layer)).toBe(58.2);
    expect(pauseHeight(3.0, first, layer)).toBe(3.2);
  });

  it('gère une première couche différente', () => {
    expect(pauseHeight(0.1, 0.3, 0.2)).toBe(0.3);
    expect(pauseHeight(0.3, 0.3, 0.2)).toBe(0.5);
    expect(pauseHeight(1.0, 0.3, 0.2)).toBe(1.1);
  });

  it('trie et dédoublonne', () => {
    expect(pauseHeights([58, 8, 8.05], first, layer)).toEqual([8.2, 58.2]);
    expect(pauseHeights(undefined, first, layer)).toEqual([]);
  });

  it('construit les tranches « Gris 0 → 7,6 / Or à partir de 7,8 »', () => {
    const bands = colorBands([7.8], layer, undefined, ['#9A9DA2', '#D6A838']);
    expect(bands).toHaveLength(2);
    expect(bands[0]).toMatchObject({ color: '#9A9DA2', from: 0, to: 7.6 });
    expect(bands[1]).toMatchObject({ color: '#D6A838', from: 7.6, pauseAt: 7.8 });
  });
});
