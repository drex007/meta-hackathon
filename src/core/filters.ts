export class ScalarEmaFilter {
  private initialized = false;
  private filtered = 0;

  constructor(private readonly alpha = 0.3) {}

  update(value: number): number {
    if (!this.initialized) {
      this.initialized = true;
      this.filtered = value;
      return value;
    }

    this.filtered += (value - this.filtered) * this.alpha;
    return this.filtered;
  }

  reset(value = 0): void {
    this.initialized = false;
    this.filtered = value;
  }
}

export class PositionSpeedTracker {
  private initialized = false;
  private filteredX = 0;
  private filteredY = 0;
  private filteredZ = 0;
  private previousX = 0;
  private previousY = 0;
  private previousZ = 0;
  private speed = 0;

  constructor(private readonly alpha = 0.3) {}

  update(x: number, y: number, z: number, deltaReal: number): number {
    if (!this.initialized) {
      this.initialized = true;
      this.filteredX = this.previousX = x;
      this.filteredY = this.previousY = y;
      this.filteredZ = this.previousZ = z;
      this.speed = 0;
      return 0;
    }

    this.filteredX += (x - this.filteredX) * this.alpha;
    this.filteredY += (y - this.filteredY) * this.alpha;
    this.filteredZ += (z - this.filteredZ) * this.alpha;

    const dx = this.filteredX - this.previousX;
    const dy = this.filteredY - this.previousY;
    const dz = this.filteredZ - this.previousZ;
    const safeDelta = Math.max(0.0001, deltaReal);
    this.speed = Math.sqrt(dx * dx + dy * dy + dz * dz) / safeDelta;

    this.previousX = this.filteredX;
    this.previousY = this.filteredY;
    this.previousZ = this.filteredZ;
    return this.speed;
  }

  hold(deltaReal: number): number {
    this.speed *= Math.exp(-Math.max(0, deltaReal) / 0.25);
    return this.speed;
  }

  reset(): void {
    this.initialized = false;
    this.speed = 0;
  }
}

