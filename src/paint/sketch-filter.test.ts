import { describe, expect, it } from 'vitest';
import { createPencilSketchPixels } from './sketch-filter.js';

function createRgbaPixels(
  width: number,
  height: number,
  sample: (x: number, y: number) => readonly [number, number, number, number],
): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      pixels.set(sample(x, y), offset);
    }
  }
  return pixels;
}

function channelAt(pixels: Uint8ClampedArray, width: number, x: number, y: number): number {
  return pixels[(y * width + x) * 4];
}

describe('pencil sketch filter', () => {
  it('keeps a uniform image bright without inventing edge contours', () => {
    const width = 7;
    const height = 5;
    const source = createRgbaPixels(width, height, () => [180, 180, 180, 255]);

    const result = createPencilSketchPixels(source, width, height);
    const firstValue = channelAt(result, width, 0, 0);

    expect(firstValue).toBeGreaterThan(220);
    for (let offset = 0; offset < result.length; offset += 4) {
      expect(result[offset]).toBe(firstValue);
      expect(result[offset + 1]).toBe(firstValue);
      expect(result[offset + 2]).toBe(firstValue);
    }
  });

  it('turns a sharp light-to-dark boundary into a dark contour', () => {
    const width = 11;
    const height = 7;
    const source = createRgbaPixels(width, height, (x) =>
      x < 5 ? [20, 20, 20, 255] : [245, 245, 245, 255],
    );

    const result = createPencilSketchPixels(source, width, height, {
      edgeThreshold: 0,
      edgeGain: 1,
      shadingStrength: 0,
    });
    const quietRegion = channelAt(result, width, 1, 3);
    const contour = Math.min(
      channelAt(result, width, 4, 3),
      channelAt(result, width, 5, 3),
    );

    expect(quietRegion).toBeGreaterThan(235);
    expect(contour).toBeLessThan(80);
    expect(contour).toBeLessThan(quietRegion - 140);
  });

  it('rejects pixel data that does not match valid RGBA dimensions', () => {
    expect(() => createPencilSketchPixels(new Uint8ClampedArray(15), 2, 2)).toThrow(
      'Sketch source dimensions do not match its pixel data',
    );
    expect(() => createPencilSketchPixels(new Uint8ClampedArray(), 0, 1)).toThrow(
      'Sketch source dimensions do not match its pixel data',
    );
  });

  it('returns neutral grayscale pixels with full opacity', () => {
    const width = 4;
    const height = 3;
    const source = createRgbaPixels(width, height, (x, y) => [
      x * 55,
      y * 70,
      255 - x * 40,
      (x + y) % 2 === 0 ? 0 : 96,
    ]);

    const result = createPencilSketchPixels(source, width, height);

    expect(result).toHaveLength(source.length);
    for (let offset = 0; offset < result.length; offset += 4) {
      expect(result[offset + 1]).toBe(result[offset]);
      expect(result[offset + 2]).toBe(result[offset]);
      expect(result[offset + 3]).toBe(255);
    }
  });
});
