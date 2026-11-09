export interface PinchTransition {
  pinching: boolean;
  started: boolean;
  ended: boolean;
}

export function updatePinchState(
  wasPinching: boolean,
  fingertipDistance: number,
  closeThreshold = 0.02,
  releaseThreshold = 0.035,
): PinchTransition {
  const pinching = wasPinching
    ? fingertipDistance < releaseThreshold
    : fingertipDistance <= closeThreshold;

  return {
    pinching,
    started: pinching && !wasPinching,
    ended: !pinching && wasPinching,
  };
}

