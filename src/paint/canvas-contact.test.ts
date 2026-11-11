import { describe, expect, it } from 'vitest';
import { writeCanvasContact, type CanvasContactSample } from './canvas-contact.js';

describe('canvas-local contact mapping', () => {
  const sample: CanvasContactSample = { x: 0, y: 0, pressure: 0 };

  it('maps the canvas center and edges to texture coordinates', () => {
    expect(writeCanvasContact(0, 0, 0.02, 900, 675, sample)).toBe(true);
    expect(sample.x).toBeCloseTo(450);
    expect(sample.y).toBeCloseTo(337.5);

    expect(writeCanvasContact(0.38, 0.28, 0.02, 900, 675, sample)).toBe(true);
    expect(sample.x).toBeCloseTo(900);
    expect(sample.y).toBeCloseTo(0);
  });

  it('rejects positions outside the canvas or contact depth', () => {
    expect(writeCanvasContact(0.381, 0, 0.02, 900, 675, sample)).toBe(false);
    expect(writeCanvasContact(0, 0, 0.053, 900, 675, sample)).toBe(false);
    expect(writeCanvasContact(0, 0, -0.013, 900, 675, sample)).toBe(false);
  });

  it('clamps the pressure approximation from penetration depth', () => {
    writeCanvasContact(0, 0, 0.052, 900, 675, sample);
    expect(sample.pressure).toBe(0.08);
    writeCanvasContact(0, 0, -0.012, 900, 675, sample);
    expect(sample.pressure).toBe(1);
  });
});
