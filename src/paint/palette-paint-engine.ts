import { mixPigmentColors, PAINT_COLORS } from './paint-core.js';
import { OilPaintEngine } from './oil-paint-engine.js';

const DAB_X = [118, 256, 394, 118, 256, 394] as const;
const DAB_Y = [104, 74, 104, 408, 438, 408] as const;
const DAB_RADIUS = 42;
const MIX_X = 256;
const MIX_Y = 256;
const MIX_RADIUS = 124;

export class PalettePaintEngine {
  readonly canvas: HTMLCanvasElement;
  readonly heightCanvas: HTMLCanvasElement;
  eventCode = 0;
  mixCount = 0;
  paintColor: string = PAINT_COLORS[0];
  paintLoad = 100;

  private readonly context: CanvasRenderingContext2D;
  private readonly heightContext: CanvasRenderingContext2D;
  private readonly engine: OilPaintEngine;
  private readonly onChange: () => void;
  private readonly deposited = new Uint8Array(PAINT_COLORS.length);
  private active = false;
  private currentRegion = -1;
  private centerColor = '';

  constructor(onChange: () => void) {
    this.onChange = onChange;
    this.canvas = document.createElement('canvas');
    this.canvas.width = 512;
    this.canvas.height = 512;
    this.heightCanvas = document.createElement('canvas');
    this.heightCanvas.width = 512;
    this.heightCanvas.height = 512;
    this.context = this.canvas.getContext('2d') as CanvasRenderingContext2D;
    this.heightContext = this.heightCanvas.getContext('2d') as CanvasRenderingContext2D;
    this.paintWoodSurface();
    this.engine = new OilPaintEngine(this.canvas, this.heightCanvas, onChange);
  }

  resetMixingArea(): void {
    this.engine.end();
    this.centerColor = '';
    this.context.save();
    this.context.fillStyle = '#c69a6d';
    this.context.beginPath();
    this.context.arc(MIX_X, MIX_Y, MIX_RADIUS + 2, 0, Math.PI * 2);
    this.context.fill();
    this.context.strokeStyle = 'rgba(73,39,22,.12)';
    this.context.lineWidth = 2;
    for (let y = MIX_Y - MIX_RADIUS; y <= MIX_Y + MIX_RADIUS; y += 14) {
      const halfChord = Math.sqrt(Math.max(0, MIX_RADIUS * MIX_RADIUS - (y - MIX_Y) * (y - MIX_Y)));
      this.context.beginPath();
      this.context.moveTo(MIX_X - halfChord, y);
      this.context.lineTo(MIX_X + halfChord, y + Math.sin(y * 0.08) * 3);
      this.context.stroke();
    }
    this.context.restore();
    this.heightContext.save();
    this.heightContext.fillStyle = '#080808';
    this.heightContext.beginPath();
    this.heightContext.arc(MIX_X, MIX_Y, MIX_RADIUS + 2, 0, Math.PI * 2);
    this.heightContext.fill();
    this.heightContext.restore();
    this.onChange();
  }

  deposit(index: number, color: string): void {
    const safeIndex = Math.max(0, Math.min(PAINT_COLORS.length - 1, index));
    this.deposited[safeIndex] = 1;
    const x = DAB_X[safeIndex];
    const y = DAB_Y[safeIndex];
    const gradient = this.context.createRadialGradient(x - 11, y - 12, 3, x, y, DAB_RADIUS);
    gradient.addColorStop(0, '#fff4dc');
    gradient.addColorStop(0.18, color);
    gradient.addColorStop(1, color);
    this.context.save();
    this.context.fillStyle = gradient;
    this.context.beginPath();
    this.context.ellipse(x, y, DAB_RADIUS, DAB_RADIUS * 0.72, -0.18, 0, Math.PI * 2);
    this.context.fill();
    this.context.restore();
    this.heightContext.save();
    this.heightContext.fillStyle = '#f2f2f2';
    this.heightContext.globalAlpha = 0.72;
    this.heightContext.beginPath();
    this.heightContext.ellipse(x, y, DAB_RADIUS, DAB_RADIUS * 0.72, -0.18, 0, Math.PI * 2);
    this.heightContext.fill();
    this.heightContext.restore();
    this.engine.end();
  }

  begin(x: number, y: number, pressure: number, brushColor: string, load: number): void {
    this.active = true;
    this.currentRegion = -1;
    this.paintColor = brushColor;
    this.paintLoad = load;
    this.eventCode = this.enterRegion(x, y);
    this.paintLoad = this.engine.begin(x, y, pressure, this.paintColor, 30, 1, 100, this.paintLoad);
  }

  continue(x: number, y: number, pressure: number): void {
    if (!this.active) return;
    this.eventCode = this.enterRegion(x, y);
    if (this.eventCode > 0) {
      this.engine.end();
      this.paintLoad = this.engine.begin(x, y, pressure, this.paintColor, 30, 1, 100, this.paintLoad);
    } else {
      this.paintLoad = this.engine.continue(x, y, pressure);
    }
  }

  end(): void {
    this.active = false;
    this.currentRegion = -1;
    this.eventCode = 0;
    this.engine.end();
  }

  private enterRegion(x: number, y: number): number {
    const region = this.regionAt(x, y);
    if (region === this.currentRegion) return 0;
    this.currentRegion = region;
    if (region < 0) return 0;
    if (region < PAINT_COLORS.length) {
      const pigment = PAINT_COLORS[region];
      if (this.paintLoad < 12 || this.paintColor === pigment) {
        this.paintColor = pigment;
        this.paintLoad = 100;
        return 1;
      }
      this.paintColor = mixPigmentColors(this.paintColor, pigment);
      this.paintLoad = 100;
      this.mixCount += 1;
      return 2;
    }
    if (this.centerColor === '') {
      this.centerColor = this.paintColor;
      return 1;
    }
    if (this.centerColor !== this.paintColor) {
      this.centerColor = mixPigmentColors(this.centerColor, this.paintColor);
      this.paintColor = this.centerColor;
      this.paintLoad = 100;
      this.mixCount += 1;
      return 2;
    }
    return 0;
  }

  private regionAt(x: number, y: number): number {
    for (let index = 0; index < PAINT_COLORS.length; index += 1) {
      if (this.deposited[index] === 0) continue;
      const dx = x - DAB_X[index];
      const dy = y - DAB_Y[index];
      if (dx * dx + dy * dy <= DAB_RADIUS * DAB_RADIUS) return index;
    }
    const centerX = x - MIX_X;
    const centerY = y - MIX_Y;
    return centerX * centerX + centerY * centerY <= MIX_RADIUS * MIX_RADIUS ? PAINT_COLORS.length : -1;
  }

  private paintWoodSurface(): void {
    this.context.fillStyle = '#bd8a59';
    this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.context.lineWidth = 2;
    for (let y = 12; y < this.canvas.height; y += 13) {
      this.context.strokeStyle = y % 26 === 0 ? 'rgba(73,39,22,.16)' : 'rgba(255,226,179,.12)';
      this.context.beginPath();
      this.context.moveTo(0, y);
      for (let x = 0; x <= this.canvas.width; x += 32) this.context.lineTo(x, y + Math.sin(x * 0.025 + y) * 4);
      this.context.stroke();
    }
    this.context.fillStyle = 'rgba(255,244,218,.2)';
    this.context.beginPath();
    this.context.arc(MIX_X, MIX_Y, MIX_RADIUS, 0, Math.PI * 2);
    this.context.fill();
  }
}
