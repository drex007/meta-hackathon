import { describe, expect, it } from 'vitest';
import { PositionSpeedTracker } from './filters.js';
import { updatePinchState } from './pinch.js';
import {
  advanceTimeScale,
  DEFAULT_TIME_SCALE_PARAMETERS,
  speedToTargetScale,
} from './time-scale.js';

describe('time scale', () => {
  it('maps stillness to the near-freeze floor', () => {
    expect(speedToTargetScale(0, DEFAULT_TIME_SCALE_PARAMETERS)).toBeCloseTo(
      0.06,
    );
  });

  it('maps full wrist speed to normal time', () => {
    expect(speedToTargetScale(1, DEFAULT_TIME_SCALE_PARAMETERS)).toBe(1);
  });

  it('attacks faster than it releases', () => {
    const fast = advanceTimeScale(
      0.06,
      1,
      0.1,
      DEFAULT_TIME_SCALE_PARAMETERS,
    );
    const slow = advanceTimeScale(
      1,
      0,
      0.1,
      DEFAULT_TIME_SCALE_PARAMETERS,
    );
    expect(fast - 0.06).toBeGreaterThan(1 - slow);
  });

  it('does not spike on the first tracked position', () => {
    const tracker = new PositionSpeedTracker();
    expect(tracker.update(4, 2, -6, 1 / 72)).toBe(0);
  });
});

describe('pinch hysteresis', () => {
  it('starts below two centimetres and stays active through the middle band', () => {
    const start = updatePinchState(false, 0.019);
    const held = updatePinchState(start.pinching, 0.03);
    expect(start.started).toBe(true);
    expect(held.pinching).toBe(true);
  });

  it('releases above three and a half centimetres', () => {
    const result = updatePinchState(true, 0.036);
    expect(result.ended).toBe(true);
    expect(result.pinching).toBe(false);
  });
});

