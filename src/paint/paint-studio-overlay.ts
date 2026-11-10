import { mixPigmentColors, PAINT_COLORS, quantizeLuminance } from './paint-core.js';
import { OilPaintEngine, type BrushShape } from './oil-paint-engine.js';
import { PalettePaintEngine } from './palette-paint-engine.js';

const COLORS = PAINT_COLORS;

export interface PaintOverlayState {
  selectedColor: number;
  brushSize: number;
  brushShape: number;
  paintLoad: number;
  wetness: number;
  paintColor: string;
  paletteMixCount: number;
  paletteContact: boolean;
  strokeCount: number;
  undoCount: number;
  hasReference: boolean;
  savedCount: number;
  status: string;
}

export interface PaintOverlayOptions {
  enterXr: () => void;
  xrEnabled: boolean;
  onTextureChange: () => void;
  onPaletteTextureChange: () => void;
  onStateChange: (state: PaintOverlayState) => void;
}

export class PaintStudioOverlay {
  readonly canvas: HTMLCanvasElement;
  readonly heightCanvas: HTMLCanvasElement;
  readonly paletteCanvas: HTMLCanvasElement;
  readonly paletteHeightCanvas: HTMLCanvasElement;
  private readonly root: HTMLDivElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly heightContext: CanvasRenderingContext2D;
  private readonly paintEngine: OilPaintEngine;
  private readonly paletteEngine: PalettePaintEngine;
  private readonly options: PaintOverlayOptions;
  private readonly undoStack: Array<{ color: ImageData; height: ImageData; paint: string; load: number }> = [];
  private selectedColor = 0;
  private previousColor = 1;
  private activePaint: string = COLORS[0];
  private brushSize = 18;
  private brushShape: BrushShape = 0;
  private paintLoad = 100;
  private wetness = 78;
  private strokeCount = 0;
  private savedCount = 0;
  private hasReference = false;
  private drawing = false;
  private paletteContact = false;
  private paletteMixCount = 0;
  private status = 'Blank canvas ready';

  constructor(options: PaintOverlayOptions) {
    this.options = options;
    this.root = document.createElement('div');
    this.root.className = 'paint-palette-app';
    this.root.innerHTML = `
      <header class="paint-topbar">
        <div><b>PAINT PALETTE</b><span>IMMERSIVE OIL STUDIO</span></div>
        <button type="button" data-enter-xr>${options.xrEnabled ? 'ENTER 3D STUDIO' : 'WEBXR UNAVAILABLE'}</button>
      </header>
      <main class="paint-workspace">
        <aside class="paint-toolbox paint-palette-box">
          <span class="paint-eyebrow">OIL COLOURS</span>
          <h2>Your palette</h2>
          <div class="paint-swatches">
            ${COLORS.map((color, index) => `<button type="button" class="paint-swatch" data-color="${index}" style="--swatch:${color}" aria-label="Select colour ${index + 1}"></button>`).join('')}
          </div>
          <button type="button" class="paint-secondary" data-mix>MIX WITH PREVIOUS</button>
          <div class="paint-current"><i data-current></i><span data-color-label>Crimson lake</span></div>
          <div class="paint-load"><span>BRUSH LOAD</span><b data-load-label>100%</b><i><em data-load-bar></em></i></div>
          <span class="paint-eyebrow">BRUSH SIZE + PROFILE</span>
          <input data-brush type="range" min="5" max="64" value="18" aria-label="Brush size" />
          <div class="paint-brush-presets">
            <button type="button" data-size="8">S</button><button type="button" data-size="18">M</button><button type="button" data-size="38">L</button>
          </div>
          <div class="paint-brush-shapes">
            <button type="button" data-shape="0">FLAT</button><button type="button" data-shape="1">FILBERT</button><button type="button" data-shape="2">FAN</button>
          </div>
          <span class="paint-eyebrow">CANVAS BLENDING</span>
          <input data-wetness type="range" min="0" max="100" value="78" aria-label="Wet paint blending" />
        </aside>
        <section class="paint-canvas-card">
          <div class="paint-canvas-head"><span data-status>Blank canvas ready</span><b data-strokes>0 strokes</b></div>
          <canvas data-paint-canvas width="900" height="675"></canvas>
          <div class="paint-canvas-foot">Pressure spreads the bristles. Light strokes leave raised impasto; firm strokes flatten the paint.</div>
        </section>
        <aside class="paint-toolbox paint-actions-box">
          <span class="paint-eyebrow">PAINT-BY-NUMBER</span>
          <h2>Paint your photo</h2>
          <p>Upload a portrait. It stays on your device and becomes a monochrome numbered mosaic.</p>
          <label class="paint-upload">UPLOAD IMAGE<input data-upload type="file" accept="image/*" /></label>
          <span class="paint-eyebrow">CANVAS HISTORY</span>
          <button type="button" class="paint-secondary" data-undo>UNDO LAST STROKE</button>
          <button type="button" class="paint-secondary" data-clear>NEW BLANK CANVAS</button>
          <button type="button" class="paint-save" data-save>SAVE ARTWORK</button>
          <small>Your last saved work is also kept locally in this browser.</small>
        </aside>
      </main>
    `;
    this.canvas = this.root.querySelector<HTMLCanvasElement>('[data-paint-canvas]') as HTMLCanvasElement;
    this.context = this.canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
    this.heightCanvas = document.createElement('canvas');
    this.heightCanvas.width = this.canvas.width;
    this.heightCanvas.height = this.canvas.height;
    this.heightContext = this.heightCanvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
    this.paintEngine = new OilPaintEngine(this.canvas, this.heightCanvas, this.options.onTextureChange);
    this.paletteEngine = new PalettePaintEngine(this.options.onPaletteTextureChange);
    this.paletteCanvas = this.paletteEngine.canvas;
    this.paletteHeightCanvas = this.paletteEngine.heightCanvas;
    this.paletteEngine.deposit(0, COLORS[0]);
    document.body.append(this.root);
    this.bindEvents();
    this.loadOrCreateCanvas();
    this.syncUi();
  }

  selectColor(index: number): void {
    const next = Math.max(0, Math.min(COLORS.length - 1, index));
    if (next !== this.selectedColor) this.previousColor = this.selectedColor;
    this.selectedColor = next;
    this.activePaint = COLORS[next];
    this.paintLoad = 100;
    this.paletteEngine.deposit(next, COLORS[next]);
    this.options.onPaletteTextureChange();
    this.status = 'Fresh pigment placed on the physical palette';
    this.syncUi();
  }

  setBrushPreset(preset: number): void {
    const sizes = [8, 18, 38];
    this.brushSize = sizes[Math.max(0, Math.min(2, preset))];
    const slider = this.root.querySelector<HTMLInputElement>('[data-brush]');
    if (slider != null) slider.value = this.brushSize.toString();
    this.status = `Brush set to ${['fine', 'medium', 'broad'][Math.max(0, Math.min(2, preset))]}`;
    this.syncUi();
  }

  setBrushShape(shape: number): void {
    this.brushShape = Math.max(0, Math.min(2, shape)) as BrushShape;
    this.status = `${['Flat', 'Filbert', 'Fan'][this.brushShape]} brush selected`;
    this.syncUi();
  }

  cycleWetness(): void {
    this.wetness = this.wetness < 45 ? 72 : this.wetness < 90 ? 100 : 28;
    const slider = this.root.querySelector<HTMLInputElement>('[data-wetness]');
    if (slider != null) slider.value = this.wetness.toString();
    this.status = `Canvas blending ${this.wetness}%`;
    this.syncUi();
  }

  mixWithPrevious(): void {
    this.activePaint = mixPigmentColors(this.activePaint, COLORS[this.previousColor]);
    this.paintLoad = 100;
    this.status = `Pigments ${this.previousColor + 1} + ${this.selectedColor + 1} mixed on the palette`;
    this.syncUi();
  }

  undo(): void {
    const previous = this.undoStack.pop();
    if (previous == null) {
      this.status = 'Nothing left to undo';
      this.syncUi();
      return;
    }
    this.context.putImageData(previous.color, 0, 0);
    this.heightContext.putImageData(previous.height, 0, 0);
    this.activePaint = previous.paint;
    this.paintLoad = previous.load;
    this.strokeCount = Math.max(0, this.strokeCount - 1);
    this.status = 'Last painting step undone';
    this.changed();
  }

  clear(): void {
    this.pushUndo();
    this.context.fillStyle = '#f4ecd9';
    this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.addCanvasGrain();
    this.paintEngine.resetHeight();
    this.hasReference = false;
    this.strokeCount = 0;
    this.status = 'Fresh linen canvas ready';
    this.changed();
  }

  save(): void {
    const dataUrl = this.canvas.toDataURL('image/png');
    localStorage.setItem('paint-palette-last-work', dataUrl);
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `paint-palette-${new Date().toISOString().slice(0, 10)}.png`;
    link.click();
    this.savedCount += 1;
    this.status = 'Artwork saved as PNG';
    this.syncUi();
  }

  beginSpatialStroke(x: number, y: number, pressure: number): void {
    if (this.drawing) return;
    this.pushUndo();
    this.drawing = true;
    this.paintLoad = this.paintEngine.begin(x, y, pressure, this.activePaint, this.brushSize, this.brushShape, this.wetness, this.paintLoad);
    this.status = 'Brush touching wet canvas';
  }

  continueSpatialStroke(x: number, y: number, pressure: number): void {
    if (!this.drawing) return;
    this.paintLoad = this.paintEngine.continue(x, y, pressure);
  }

  endSpatialStroke(): void {
    if (!this.drawing) return;
    this.drawing = false;
    this.paintEngine.end();
    this.strokeCount += 1;
    this.status = this.paintLoad < 8 ? 'Brush nearly dry — load more pigment' : 'Wet oil stroke added';
    this.changed();
  }

  beginPaletteContact(x: number, y: number, pressure: number): void {
    if (this.paletteContact) return;
    this.paletteContact = true;
    this.paletteEngine.begin(x, y, pressure, this.activePaint, this.paintLoad);
    this.applyPaletteResult();
    this.status = 'Brush touching the mixing palette';
    this.syncUi();
  }

  continuePaletteContact(x: number, y: number, pressure: number): void {
    if (!this.paletteContact) return;
    this.paletteEngine.continue(x, y, pressure);
    if (this.paletteEngine.eventCode > 0) this.applyPaletteResult();
  }

  endPaletteContact(): void {
    if (!this.paletteContact) return;
    this.paletteContact = false;
    this.paletteEngine.end();
    this.paintLoad = this.paletteEngine.paintLoad;
    this.status = 'Pigment ready — move the brush to the canvas';
    this.syncUi();
  }

  setImmersiveMode(active: boolean): void {
    this.root.classList.toggle('paint-palette-app--xr-hidden', active);
  }

  dispose(): void {
    window.removeEventListener('pointerup', this.endStroke);
    this.root.remove();
  }

  private applyPaletteResult(): void {
    this.activePaint = this.paletteEngine.paintColor;
    this.paintLoad = this.paletteEngine.paintLoad;
    this.paletteMixCount = this.paletteEngine.mixCount;
    if (this.paletteEngine.eventCode === 2) this.status = 'Pigments mixed physically on the palette';
    else if (this.paletteEngine.eventCode === 1) this.status = 'Pigment loaded from the palette';
    this.syncUi();
  }

  private bindEvents(): void {
    this.root.querySelector<HTMLButtonElement>('[data-enter-xr]')?.addEventListener('click', this.options.enterXr);
    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-color]')) {
      button.addEventListener('click', () => this.selectColor(Number(button.dataset.color)));
    }
    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-size]')) {
      button.addEventListener('click', () => {
        const size = Number(button.dataset.size);
        this.brushSize = size;
        const slider = this.root.querySelector<HTMLInputElement>('[data-brush]');
        if (slider != null) slider.value = size.toString();
        this.status = `Brush size ${size}px`;
        this.syncUi();
      });
    }
    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-shape]')) {
      button.addEventListener('click', () => this.setBrushShape(Number(button.dataset.shape)));
    }
    this.root.querySelector<HTMLInputElement>('[data-brush]')?.addEventListener('input', (event) => {
      this.brushSize = Number((event.currentTarget as HTMLInputElement).value);
      this.status = `Brush size ${this.brushSize}px`;
      this.syncUi();
    });
    this.root.querySelector<HTMLInputElement>('[data-wetness]')?.addEventListener('input', (event) => {
      this.wetness = Number((event.currentTarget as HTMLInputElement).value);
      this.status = `Canvas blending ${this.wetness}%`;
      this.syncUi();
    });
    this.root.querySelector<HTMLButtonElement>('[data-mix]')?.addEventListener('click', () => this.mixWithPrevious());
    this.root.querySelector<HTMLButtonElement>('[data-undo]')?.addEventListener('click', () => this.undo());
    this.root.querySelector<HTMLButtonElement>('[data-clear]')?.addEventListener('click', () => this.clear());
    this.root.querySelector<HTMLButtonElement>('[data-save]')?.addEventListener('click', () => this.save());
    this.root.querySelector<HTMLInputElement>('[data-upload]')?.addEventListener('change', (event) => this.loadReference(event));
    this.canvas.addEventListener('pointerdown', (event) => this.beginStroke(event));
    this.canvas.addEventListener('pointermove', (event) => this.continueStroke(event));
    window.addEventListener('pointerup', this.endStroke);
  }

  private beginStroke(event: PointerEvent): void {
    this.pushUndo();
    this.drawing = true;
    this.canvas.setPointerCapture(event.pointerId);
    const point = this.canvasPoint(event);
    this.paintLoad = this.paintEngine.begin(point.x, point.y, event.pressure, this.activePaint, this.brushSize, this.brushShape, this.wetness, this.paintLoad);
    this.changed(false);
  }

  private continueStroke(event: PointerEvent): void {
    if (!this.drawing) return;
    const point = this.canvasPoint(event);
    this.paintLoad = this.paintEngine.continue(point.x, point.y, event.pressure);
    this.changed(false);
  }

  private readonly endStroke = (): void => {
    if (!this.drawing) return;
    this.drawing = false;
    this.paintEngine.end();
    this.strokeCount += 1;
    this.status = this.paintLoad < 8 ? 'Brush nearly dry — reload a colour' : 'Wet oil stroke added';
    this.changed();
  };

  private loadReference(event: Event): void {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (file == null) return;
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      const image = new Image();
      image.addEventListener('load', () => this.renderPaintByNumber(image));
      image.src = String(reader.result);
    });
    reader.readAsDataURL(file);
  }

  private renderPaintByNumber(image: HTMLImageElement): void {
    this.pushUndo();
    const sample = document.createElement('canvas');
    sample.width = 30;
    sample.height = 22;
    const sampleContext = sample.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
    const scale = Math.max(sample.width / image.width, sample.height / image.height);
    const width = image.width * scale;
    const height = image.height * scale;
    sampleContext.drawImage(image, (sample.width - width) / 2, (sample.height - height) / 2, width, height);
    const pixels = sampleContext.getImageData(0, 0, sample.width, sample.height).data;
    const cellWidth = this.canvas.width / sample.width;
    const cellHeight = this.canvas.height / sample.height;
    this.context.textAlign = 'center';
    this.context.textBaseline = 'middle';
    this.context.font = `600 ${Math.floor(cellHeight * 0.34)}px sans-serif`;
    for (let y = 0; y < sample.height; y += 1) for (let x = 0; x < sample.width; x += 1) {
      const offset = (y * sample.width + x) * 4;
      const level = quantizeLuminance(pixels[offset], pixels[offset + 1], pixels[offset + 2]);
      const gray = 242 - level * 31;
      this.context.fillStyle = `rgb(${gray},${gray},${gray})`;
      this.context.fillRect(x * cellWidth, y * cellHeight, cellWidth + 0.5, cellHeight + 0.5);
      this.context.fillStyle = gray < 150 ? 'rgba(255,255,255,.58)' : 'rgba(25,20,25,.48)';
      this.context.fillText(String(6 - level), (x + 0.5) * cellWidth, (y + 0.5) * cellHeight);
    }
    this.hasReference = true;
    this.strokeCount = 0;
    this.paintEngine.resetHeight();
    this.status = 'Portrait converted to a 6-tone paint-by-number mosaic';
    this.changed();
  }

  private loadOrCreateCanvas(): void {
    const saved = localStorage.getItem('paint-palette-last-work');
    if (saved == null) {
      this.clear();
      this.undoStack.length = 0;
      return;
    }
    const image = new Image();
    image.addEventListener('load', () => {
      this.context.drawImage(image, 0, 0, this.canvas.width, this.canvas.height);
      this.paintEngine.resetHeight();
      this.status = 'Last saved artwork restored';
      this.changed();
    });
    image.src = saved;
  }

  private addCanvasGrain(): void {
    this.context.strokeStyle = 'rgba(110,83,55,.055)';
    this.context.lineWidth = 1;
    for (let y = 3; y < this.canvas.height; y += 7) {
      this.context.beginPath();
      this.context.moveTo(0, y);
      this.context.lineTo(this.canvas.width, y + ((y % 5) - 2));
      this.context.stroke();
    }
  }

  private pushUndo(): void {
    this.undoStack.push({
      color: this.context.getImageData(0, 0, this.canvas.width, this.canvas.height),
      height: this.heightContext.getImageData(0, 0, this.heightCanvas.width, this.heightCanvas.height),
      paint: this.activePaint,
      load: this.paintLoad,
    });
    if (this.undoStack.length > 12) this.undoStack.shift();
  }

  private canvasPoint(event: PointerEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (this.canvas.width / rect.width),
      y: (event.clientY - rect.top) * (this.canvas.height / rect.height),
    };
  }

  private changed(sync = true): void {
    this.options.onTextureChange();
    if (sync) this.syncUi();
  }

  private syncUi(): void {
    const names = ['Crimson lake', 'Cadmium yellow', 'Ultramarine', 'Titanium white', 'Ivory black', 'Sap green'];
    for (const swatch of this.root.querySelectorAll<HTMLButtonElement>('[data-color]')) {
      swatch.classList.toggle('selected', Number(swatch.dataset.color) === this.selectedColor);
    }
    for (const shape of this.root.querySelectorAll<HTMLButtonElement>('[data-shape]')) {
      shape.classList.toggle('selected', Number(shape.dataset.shape) === this.brushShape);
    }
    const current = this.root.querySelector<HTMLElement>('[data-current]');
    if (current != null) current.style.background = this.activePaint;
    const label = this.root.querySelector<HTMLElement>('[data-color-label]');
    if (label != null) label.textContent = names[this.selectedColor];
    const status = this.root.querySelector<HTMLElement>('[data-status]');
    if (status != null) status.textContent = this.status;
    const strokes = this.root.querySelector<HTMLElement>('[data-strokes]');
    if (strokes != null) strokes.textContent = `${this.strokeCount} stroke${this.strokeCount === 1 ? '' : 's'}`;
    const loadLabel = this.root.querySelector<HTMLElement>('[data-load-label]');
    if (loadLabel != null) loadLabel.textContent = `${Math.round(this.paintLoad)}%`;
    const loadBar = this.root.querySelector<HTMLElement>('[data-load-bar]');
    if (loadBar != null) loadBar.style.width = `${Math.round(this.paintLoad)}%`;
    this.options.onStateChange({
      selectedColor: this.selectedColor,
      brushSize: this.brushSize <= 10 ? 1 : this.brushSize <= 28 ? 2 : 3,
      brushShape: this.brushShape,
      paintLoad: Math.round(this.paintLoad),
      wetness: this.wetness,
      paintColor: this.activePaint,
      paletteMixCount: this.paletteMixCount,
      paletteContact: this.paletteContact,
      strokeCount: this.strokeCount,
      undoCount: this.undoStack.length,
      hasReference: this.hasReference,
      savedCount: this.savedCount,
      status: this.status,
    });
  }
}
