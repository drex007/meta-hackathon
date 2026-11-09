export interface TimeScaleParameters {
  minScale: number;
  deadZone: number;
  fullSpeed: number;
  headWeight: number;
  attack: number;
  release: number;
}

export const DEFAULT_TIME_SCALE_PARAMETERS: TimeScaleParameters = {
  minScale: 0.06,
  deadZone: 0.04,
  fullSpeed: 1,
  headWeight: 0.8,
  attack: 0.08,
  release: 0.25,
};

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function easeOutQuad(value: number): number {
  const t = clamp(value, 0, 1);
  return 1 - (1 - t) * (1 - t);
}

export function speedToTargetScale(
  speed: number,
  parameters: TimeScaleParameters,
): number {
  const range = Math.max(0.0001, parameters.fullSpeed - parameters.deadZone);
  const normalized = clamp((speed - parameters.deadZone) / range, 0, 1);
  return (
    parameters.minScale +
    (1 - parameters.minScale) * easeOutQuad(normalized)
  );
}

export function advanceTimeScale(
  current: number,
  speed: number,
  deltaReal: number,
  parameters: TimeScaleParameters,
): number {
  if (!Number.isFinite(deltaReal) || deltaReal <= 0) {
    return clamp(current, parameters.minScale, 1);
  }

  const target = speedToTargetScale(speed, parameters);
  const response = target > current ? parameters.attack : parameters.release;
  const blend = 1 - Math.exp(-deltaReal / Math.max(0.0001, response));
  return clamp(current + (target - current) * blend, parameters.minScale, 1);
}

