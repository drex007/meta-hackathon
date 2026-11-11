export interface CanvasContactSample {
  x: number;
  y: number;
  pressure: number;
}

export interface CanvasContactBounds {
  halfWidth: number;
  halfHeight: number;
  backTolerance: number;
  frontDepth: number;
}

export const DEFAULT_CANVAS_CONTACT_BOUNDS: CanvasContactBounds = {
  halfWidth: 0.38,
  halfHeight: 0.28,
  backTolerance: 0.012,
  frontDepth: 0.052,
};

export function writeCanvasContact(
  localX: number,
  localY: number,
  localZ: number,
  textureWidth: number,
  textureHeight: number,
  output: CanvasContactSample,
  bounds: CanvasContactBounds = DEFAULT_CANVAS_CONTACT_BOUNDS,
): boolean {
  const inside = Math.abs(localX) <= bounds.halfWidth && Math.abs(localY) <= bounds.halfHeight;
  const touching = inside && localZ >= -bounds.backTolerance && localZ <= bounds.frontDepth;
  if (!touching) return false;

  output.x = (localX / (bounds.halfWidth * 2) + 0.5) * textureWidth;
  output.y = (0.5 - localY / (bounds.halfHeight * 2)) * textureHeight;
  output.pressure = Math.max(
    0.08,
    Math.min(1, (bounds.frontDepth - localZ) / (bounds.frontDepth + bounds.backTolerance)),
  );
  return true;
}
