export interface PlaneHit {
  x: number;
  y: number;
  t: number;
}

const PARALLEL_EPSILON = 1e-8;

export function writeRectPlaneHit(
  originX: number,
  originY: number,
  originZ: number,
  directionX: number,
  directionY: number,
  directionZ: number,
  planeZ: number,
  halfWidth: number,
  halfHeight: number,
  out: PlaneHit,
): boolean {
  if (
    !Number.isFinite(originX) ||
    !Number.isFinite(originY) ||
    !Number.isFinite(originZ) ||
    !Number.isFinite(directionX) ||
    !Number.isFinite(directionY) ||
    !Number.isFinite(directionZ) ||
    !Number.isFinite(planeZ) ||
    !Number.isFinite(halfWidth) ||
    !Number.isFinite(halfHeight) ||
    halfWidth < 0 ||
    halfHeight < 0 ||
    Math.abs(directionZ) <= PARALLEL_EPSILON
  ) {
    return false;
  }

  const t = (planeZ - originZ) / directionZ;
  if (t < 0) {
    return false;
  }

  const x = originX + directionX * t;
  const y = originY + directionY * t;
  if (Math.abs(x) > halfWidth || Math.abs(y) > halfHeight) {
    return false;
  }

  out.x = x;
  out.y = y;
  out.t = t;
  return true;
}

export function writeCirclePlaneHit(
  originX: number,
  originY: number,
  originZ: number,
  directionX: number,
  directionY: number,
  directionZ: number,
  planeZ: number,
  radius: number,
  out: PlaneHit,
): boolean {
  if (
    !Number.isFinite(originX) ||
    !Number.isFinite(originY) ||
    !Number.isFinite(originZ) ||
    !Number.isFinite(directionX) ||
    !Number.isFinite(directionY) ||
    !Number.isFinite(directionZ) ||
    !Number.isFinite(planeZ) ||
    !Number.isFinite(radius) ||
    radius < 0 ||
    Math.abs(directionZ) <= PARALLEL_EPSILON
  ) {
    return false;
  }

  const t = (planeZ - originZ) / directionZ;
  if (t < 0) {
    return false;
  }

  const x = originX + directionX * t;
  const y = originY + directionY * t;
  if (x * x + y * y > radius * radius) {
    return false;
  }

  out.x = x;
  out.y = y;
  out.t = t;
  return true;
}
