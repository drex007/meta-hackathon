import { describe, expect, it } from 'vitest';

import {
  writeCirclePlaneHit,
  writeRectPlaneHit,
  type PlaneHit,
} from './desktop-brush-control';

describe('writeRectPlaneHit', () => {
  it('writes center and inclusive edge hits', () => {
    const hit: PlaneHit = { x: -1, y: -1, t: -1 };

    expect(writeRectPlaneHit(0, 0, 2, 0, 0, -1, 0, 2, 1, hit)).toBe(true);
    expect(hit).toEqual({ x: 0, y: 0, t: 2 });

    expect(writeRectPlaneHit(0, 0, 1, 2, 1, -1, 0, 2, 1, hit)).toBe(true);
    expect(hit).toEqual({ x: 2, y: 1, t: 1 });
  });

  it('rejects hits outside either bound without changing the output', () => {
    const hit: PlaneHit = { x: 7, y: 8, t: 9 };

    expect(writeRectPlaneHit(0, 0, 1, 2.01, 0, -1, 0, 2, 1, hit)).toBe(false);
    expect(writeRectPlaneHit(0, 0, 1, 0, -1.01, -1, 0, 2, 1, hit)).toBe(false);
    expect(hit).toEqual({ x: 7, y: 8, t: 9 });
  });

  it('rejects intersections behind the ray and parallel rays', () => {
    const hit: PlaneHit = { x: 7, y: 8, t: 9 };

    expect(writeRectPlaneHit(0, 0, -1, 0, 0, -1, 0, 2, 1, hit)).toBe(false);
    expect(writeRectPlaneHit(0, 0, 1, 0, 0, 0, 0, 2, 1, hit)).toBe(false);
    expect(writeRectPlaneHit(0, 0, 1, 0, 0, 1e-10, 0, 2, 1, hit)).toBe(false);
    expect(hit).toEqual({ x: 7, y: 8, t: 9 });
  });
});

describe('writeCirclePlaneHit', () => {
  it('uses ellipse-normalized local coordinates and includes the circular edge', () => {
    const hit: PlaneHit = { x: -1, y: -1, t: -1 };

    // A caller can map a 2-by-0.5 ellipse into unit-local coordinates first.
    // World (1.2, 0.4) then becomes local (0.6, 0.8), on this circle's edge.
    expect(writeCirclePlaneHit(0, 0, 1, 0.6, 0.8, -1, 0, 1, hit)).toBe(true);
    expect(hit).toEqual({ x: 0.6, y: 0.8, t: 1 });
  });

  it('rejects a local point inside the bounding square but outside the circle', () => {
    const hit: PlaneHit = { x: 7, y: 8, t: 9 };

    expect(writeCirclePlaneHit(0, 0, 1, 0.8, 0.8, -1, 0, 1, hit)).toBe(false);
    expect(hit).toEqual({ x: 7, y: 8, t: 9 });
  });
});
