export type BrushShape = 0 | 1 | 2;

export class OilPaintEngine {
  private readonly color: CanvasRenderingContext2D;
  private readonly height: CanvasRenderingContext2D;
  private readonly onChange: () => void;
  private active = false;
  private lastX = 0;
  private lastY = 0;
  private pressure = 0.5;
  private brushSize = 18;
  private brushShape: BrushShape = 0;
  private wetness = 1;
  private paintLoad = 100;
  private paint = '#d83b3b';

  constructor(colorCanvas: HTMLCanvasElement, heightCanvas: HTMLCanvasElement, onChange: () => void) {
    this.color = colorCanvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
    this.height = heightCanvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
    this.onChange = onChange;
    this.resetHeight();
  }

  begin(x: number, y: number, pressure: number, paint: string, brushSize: number, brushShape: BrushShape, wetness: number, paintLoad: number): number {
    this.active = true;
    this.lastX = x;
    this.lastY = y;
    this.pressure = this.normalizePressure(pressure);
    this.paint = paint;
    this.brushSize = brushSize;
    this.brushShape = brushShape;
    this.wetness = Math.max(0, Math.min(1, wetness / 100));
    this.paintLoad = paintLoad;
    this.renderSegment(x + 0.35, y + 0.35, this.pressure);
    return this.paintLoad;
  }

  continue(x: number, y: number, pressure: number): number {
    if (!this.active) return this.paintLoad;
    this.renderSegment(x, y, this.normalizePressure(pressure));
    return this.paintLoad;
  }

  end(): void {
    this.active = false;
  }

  resetHeight(): void {
    this.height.save();
    this.height.globalCompositeOperation = 'source-over';
    this.height.fillStyle = '#080808';
    this.height.fillRect(0, 0, this.height.canvas.width, this.height.canvas.height);
    this.height.restore();
    this.onChange();
  }

  private renderSegment(x: number, y: number, pressure: number): void {
    const dx = x - this.lastX;
    const dy = y - this.lastY;
    const distance = Math.hypot(dx, dy);

    // A held brush should not keep depositing paint while perfectly still.
    // The small threshold also filters the sub-pixel hand jitter produced by XR.
    if (distance < 0.12) return;
    const nx = -dy / distance;
    const ny = dx / distance;
    const load = Math.max(0.05, this.paintLoad / 100);
    const contactWidth = this.brushSize * (0.52 + pressure * 0.92);
    const deposit = (0.22 + this.wetness * 0.2) * load;
    const relief = (0.92 - pressure * 0.58) * load;

    this.strokeLine(this.color, this.lastX + nx, this.lastY + ny, x + nx, y + ny, contactWidth + 2, '#23120d', 0.09 * load);
    this.strokeLine(this.color, this.lastX, this.lastY, x, y, contactWidth, this.paint, deposit);
    this.strokeLine(this.color, this.lastX - nx * 0.9, this.lastY - ny * 0.9, x - nx * 0.9, y - ny * 0.9, Math.max(0.7, contactWidth * 0.08), '#fff5dd', 0.16 * relief);

    const bristles = this.brushShape === 2 ? 19 : this.brushShape === 1 ? 15 : 13;
    for (let index = 0; index < bristles; index += 1) {
      const normalized = index / (bristles - 1) - 0.5;
      const edge = Math.abs(normalized) * 2;
      const shapeWidth = this.brushShape === 1 ? Math.sqrt(Math.max(0, 1 - edge * edge)) : 1;
      const fanSpread = this.brushShape === 2 ? 1.28 : 1;
      const offset = normalized * contactWidth * fanSpread;
      const jitter = Math.sin(index * 19.71 + this.lastX * 0.017 + this.lastY * 0.011) * 0.62;
      const bristleOpacity = (0.2 + (index % 4) * 0.045) * load * (0.55 + shapeWidth * 0.45);
      const bristleWidth = Math.max(0.65, contactWidth / bristles * (this.brushShape === 2 ? 0.38 : 0.64));
      this.strokeLine(
        this.color,
        this.lastX + nx * (offset + jitter),
        this.lastY + ny * (offset + jitter),
        x + nx * (offset - jitter * 0.35),
        y + ny * (offset - jitter * 0.35),
        bristleWidth,
        this.paint,
        bristleOpacity,
      );
    }

    this.strokeLine(this.height, this.lastX, this.lastY, x, y, contactWidth * 0.92, '#ffffff', 0.28 * relief);
    for (let index = 0; index < 7; index += 1) {
      const offset = (index / 6 - 0.5) * contactWidth;
      this.strokeLine(
        this.height,
        this.lastX + nx * offset,
        this.lastY + ny * offset,
        x + nx * offset,
        y + ny * offset,
        Math.max(0.7, contactWidth * 0.035),
        '#ffffff',
        0.18 * relief,
      );
    }

    this.color.globalAlpha = 1;
    this.height.globalAlpha = 1;

    this.paintLoad = Math.max(0, this.paintLoad - (distance * contactWidth) / 900 * (0.35 + pressure * 0.65));
    this.lastX = x;
    this.lastY = y;
    this.pressure = pressure;
    this.onChange();
  }

  private strokeLine(context: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, width: number, style: string, alpha: number): void {
    context.lineCap = this.brushShape === 0 ? 'butt' : 'round';
    context.lineJoin = 'round';
    context.strokeStyle = style;
    context.globalAlpha = alpha;
    context.lineWidth = width;
    context.beginPath();
    context.moveTo(x1, y1);
    context.lineTo(x2, y2);
    context.stroke();
  }

  private normalizePressure(pressure: number): number {
    return pressure > 0 ? Math.max(0.08, Math.min(1, pressure)) : 0.5;
  }
}
