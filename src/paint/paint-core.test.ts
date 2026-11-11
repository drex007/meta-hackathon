import { describe, expect, it } from 'vitest';
import { mixHexColors, mixPigmentColors } from './paint-core.js';

describe('paint colour tools', () => {
  it('mixes RGB channels evenly', () => {
    expect(mixHexColors('#ff0000', '#0000ff')).toBe('#800080');
    expect(mixHexColors('#ffffff', '#000000')).toBe('#808080');
  });

  it('mixes pigments using an artist-friendly RYB model', () => {
    const green = mixPigmentColors('#edb83d', '#316fca');
    const red = Number.parseInt(green.slice(1, 3), 16);
    const greenChannel = Number.parseInt(green.slice(3, 5), 16);
    const blue = Number.parseInt(green.slice(5, 7), 16);
    expect(greenChannel).toBeGreaterThan(red);
    expect(greenChannel).toBeGreaterThan(blue);
  });
});
