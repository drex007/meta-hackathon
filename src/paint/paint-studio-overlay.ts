import { mixPigmentColors, PAINT_COLORS } from './paint-core.js';
import { BoundedHistory } from './paint-history.js';
import { OilPaintEngine, type BrushShape } from './oil-paint-engine.js';
import { PalettePaintEngine } from './palette-paint-engine.js';
import { createPencilSketchPixels } from './sketch-filter.js';
import {
  PAINT_PROJECT_VERSION,
  PaintProjectStore,
  type PaintProjectRecord,
} from './paint-project-store.js';

const COLORS = PAINT_COLORS;
const AUTOSAVE_DELAY_MS = 900;
const HISTORY_LIMIT = 8;

interface PaintSnapshot {
  color: ImageData;
  height: ImageData;
  paint: string;
  load: number;
  strokeCount: number;
  referenceOpacity: number;
}

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
  redoCount: number;
  hasReference: boolean;
  referenceOpacity: number;
  savedCount: number;
  galleryCount: number;
  storageReady: boolean;
  autosavePending: boolean;
  dirty: boolean;
  stabilization: number;
  dryBrush: boolean;
  guidedStep: number;
  status: string;
}

export interface PaintOverlayOptions {
  enterXr: () => void;
  xrEnabled: boolean;
  cycleEaselHeight: () => string;
  cycleEaselDistance: () => string;
  toggleHandedness: () => string;
  onDesktopStudioChange: (active: boolean) => void;
  onTextureChange: () => void;
  onPaletteTextureChange: () => void;
  onStateChange: (state: PaintOverlayState) => void;
}

export class PaintStudioOverlay {
  readonly canvas: HTMLCanvasElement;
  readonly displayCanvas: HTMLCanvasElement;
  readonly heightCanvas: HTMLCanvasElement;
  readonly paletteCanvas: HTMLCanvasElement;
  readonly paletteHeightCanvas: HTMLCanvasElement;

  private readonly root: HTMLDivElement;
  private readonly studioHud: HTMLDivElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly displayContext: CanvasRenderingContext2D;
  private readonly heightContext: CanvasRenderingContext2D;
  private readonly paintEngine: OilPaintEngine;
  private readonly paletteEngine: PalettePaintEngine;
  private readonly history = new BoundedHistory<PaintSnapshot>(HISTORY_LIMIT);
  private readonly projectStore = new PaintProjectStore();
  private readonly options: PaintOverlayOptions;
  private readonly galleryUrls: string[] = [];

  private selectedColor = 0;
  private previousColor = 1;
  private activePaint: string = COLORS[0];
  private brushSize = 18;
  private brushShape: BrushShape = 0;
  private paintLoad = 100;
  private wetness = 78;
  private stabilization = 28;
  private dryBrush = false;
  private strokeCount = 0;
  private savedCount = 0;
  private hasReference = false;
  private referenceOpacity = 32;
  private referenceDataUrl = '';
  private referenceImage?: HTMLImageElement;
  private drawing = false;
  private paletteContact = false;
  private paletteMixCount = 0;
  private guidedStep = 0;
  private storageReady = false;
  private storageError = '';
  private autosavePending = false;
  private dirty = false;
  private saveInFlight = false;
  private revision = 0;
  private activeProjectId = '';
  private projectName = 'Untitled painting';
  private projectCreatedAt = 0;
  private galleryProjects: PaintProjectRecord[] = [];
  private autosaveTimer = 0;
  private newPaintingArmedUntil = 0;
  private disposed = false;
  private status = 'Preparing fresh linen';
  private immersiveMode = false;
  private desktopStudioMode = false;
  private spatialBrushHeld = false;
  private spatialBrushShape = 0;

  private readonly handleStudioKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && this.desktopStudioMode) this.setDesktopStudioMode(false);
  };

  constructor(options: PaintOverlayOptions) {
    this.options = options;
    this.root = document.createElement('div');
    this.root.className = 'paint-palette-app';
    this.root.innerHTML = `
      <header class="paint-topbar">
        <div><b>CANVAS ATELIER</b><span>IMMERSIVE OIL STUDIO</span></div>
        <span class="paint-performance" data-performance>FRAME -- MS / 900 x 675</span>
        <div class="paint-studio-entry">
          <button type="button" data-desktop-studio>3D WITH MOUSE</button>
          <button type="button" data-enter-xr>${options.xrEnabled ? 'ENTER VR' : 'VR UNAVAILABLE'}</button>
        </div>
      </header>
      <main class="paint-workspace">
        <aside class="paint-toolbox paint-palette-box">
          <span class="paint-eyebrow">OIL COLOURS</span>
          <h2>Physical palette</h2>
          <div class="paint-swatches">
            ${COLORS.map((color, index) => `<button type="button" class="paint-swatch" data-color="${index}" style="--swatch:${color}" aria-label="Select colour ${index + 1}"></button>`).join('')}
          </div>
          <button type="button" class="paint-secondary" data-mix>MIX WITH PREVIOUS</button>
          <div class="paint-current"><i data-current></i><span data-color-label>Crimson lake</span></div>
          <div class="paint-load"><span>BRUSH LOAD</span><b data-load-label>100%</b><i><em data-load-bar></em></i></div>
          <div class="paint-inline-actions"><button type="button" data-clean>CLEAN BRUSH</button><button type="button" data-reset-palette>RESET MIX</button></div>
          <span class="paint-eyebrow">PICK A PAINTING BRUSH</span>
          <input data-brush type="range" min="5" max="64" value="18" aria-label="Brush size" />
          <div class="paint-brush-presets">
            <button type="button" data-size="8">S</button><button type="button" data-size="18">M</button><button type="button" data-size="38">L</button>
          </div>
          <div class="paint-brush-shapes">
            <button type="button" data-shape="0">ROUND</button><button type="button" data-shape="1">FLAT</button><button type="button" data-shape="2">FAN</button>
          </div>
          <button type="button" class="paint-secondary" data-dry>DRY BRUSH: OFF</button>
          <div class="paint-inline-actions"><button type="button" data-easel-height>EASEL HEIGHT</button><button type="button" data-easel-distance>EASEL DISTANCE</button></div>
          <button type="button" class="paint-secondary" data-handedness>LAYOUT: RIGHT HANDED</button>
          <span class="paint-eyebrow">STABILIZATION <b data-stabilization-label>28%</b></span>
          <input data-stabilization type="range" min="0" max="85" value="28" aria-label="Brush stabilization" />
          <span class="paint-eyebrow">WET BLENDING</span>
          <input data-wetness type="range" min="0" max="100" value="78" aria-label="Wet paint blending" />
        </aside>
        <section class="paint-canvas-card">
          <div class="paint-canvas-head"><span data-status>Preparing fresh linen</span><b data-strokes>0 strokes</b></div>
          <canvas data-display-canvas width="900" height="675"></canvas>
          <div class="paint-canvas-foot"><span data-guide>1. Load paint, then make your first stroke.</span><span>Reference overlays never appear in exports.</span></div>
        </section>
        <aside class="paint-toolbox paint-actions-box">
          <span class="paint-eyebrow">REFERENCE + TRACE</span>
          <h2>Paint from an image</h2>
          <p>Import stays on this device. Create a clean pencil sketch to paint over, or use the photo as a tracing layer.</p>
          <label class="paint-upload">IMPORT IMAGE<input data-upload type="file" accept="image/*" /></label>
          <div class="paint-reference-preview" data-reference-card><span>No reference loaded</span><img data-reference-preview alt="Imported painting reference" /></div>
          <label class="paint-range-label">TRACE OPACITY <b data-reference-opacity>32%</b><input data-reference-range type="range" min="0" max="80" value="32" /></label>
          <div class="paint-inline-actions"><button type="button" data-sketch>CREATE SKETCH</button><button type="button" data-remove-reference>REMOVE</button></div>
          <span class="paint-eyebrow">HISTORY + PROJECT</span>
          <div class="paint-inline-actions"><button type="button" data-undo>UNDO</button><button type="button" data-redo>REDO</button></div>
          <button type="button" class="paint-secondary" data-new>NEW PAINTING</button>
          <button type="button" class="paint-save" data-save>SAVE PROJECT</button>
          <button type="button" class="paint-secondary" data-export>EXPORT CLEAN PNG</button>
          <small data-storage>Opening local project storage...</small>
          <span class="paint-eyebrow">LOCAL GALLERY</span>
          <div class="paint-gallery" data-gallery><small>Saved paintings will appear here.</small></div>
        </aside>
      </main>
    `;
    this.studioHud = document.createElement('div');
    this.studioHud.className = 'paint-studio-hud';
    this.studioHud.innerHTML = `
      <div>
        <span data-studio-mode>DESKTOP 3D PAINTING</span>
        <b data-studio-help>Hold left mouse on a brush, then drag it onto the palette or canvas.</b>
      </div>
      <div class="paint-studio-hud__status">
        <span data-studio-brush>CHOOSE ROUND, FLAT, OR FAN BRUSH</span>
        <span data-studio-progress>LOAD 100% / 0 STROKES</span>
      </div>
      <button type="button" data-exit-desktop>BACK TO PALETTE</button>
    `;

    this.displayCanvas = this.root.querySelector<HTMLCanvasElement>('[data-display-canvas]') as HTMLCanvasElement;
    this.displayContext = this.displayCanvas.getContext('2d') as CanvasRenderingContext2D;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.displayCanvas.width;
    this.canvas.height = this.displayCanvas.height;
    this.context = this.canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
    this.heightCanvas = document.createElement('canvas');
    this.heightCanvas.width = this.canvas.width;
    this.heightCanvas.height = this.canvas.height;
    this.heightContext = this.heightCanvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
    this.paintEngine = new OilPaintEngine(this.canvas, this.heightCanvas, () => this.refreshDisplay());
    this.paletteEngine = new PalettePaintEngine(this.options.onPaletteTextureChange);
    this.paletteCanvas = this.paletteEngine.canvas;
    this.paletteHeightCanvas = this.paletteEngine.heightCanvas;
    this.paletteEngine.deposit(0, COLORS[0]);
    this.resetCanvasPixels();
    this.history.clear();
    this.status = 'Fresh linen canvas ready';
    document.body.append(this.root);
    document.body.append(this.studioHud);
    window.addEventListener('keydown', this.handleStudioKeydown);
    this.bindEvents();
    this.refreshDisplay();
    this.syncUi();
    void this.initializeStorage();
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
    const safePreset = Math.max(0, Math.min(2, preset));
    this.brushSize = sizes[safePreset];
    const slider = this.root.querySelector<HTMLInputElement>('[data-brush]');
    if (slider != null) slider.value = this.brushSize.toString();
    this.status = `Brush set to ${['fine', 'medium', 'broad'][safePreset]}`;
    this.syncUi();
  }

  setBrushShape(shape: number, pickedUp = false): void {
    this.brushShape = Math.max(0, Math.min(2, shape)) as BrushShape;
    const name = ['Round', 'Flat', 'Fan'][this.brushShape];
    this.status = pickedUp
      ? `${name} brush picked up - load colour on the palette, then paint`
      : `${name} brush selected - pick up the matching physical brush and paint`;
    this.syncUi();
  }

  cycleWetness(): void {
    this.wetness = this.wetness < 45 ? 72 : this.wetness < 90 ? 100 : 28;
    const slider = this.root.querySelector<HTMLInputElement>('[data-wetness]');
    if (slider != null) slider.value = this.wetness.toString();
    this.status = `Canvas blending ${this.wetness}%`;
    this.syncUi();
  }

  cycleStabilization(): void {
    this.stabilization = this.stabilization < 20 ? 38 : this.stabilization < 60 ? 72 : 0;
    const slider = this.root.querySelector<HTMLInputElement>('[data-stabilization]');
    if (slider != null) slider.value = this.stabilization.toString();
    this.status = `Brush stabilization ${this.stabilization}%`;
    this.syncUi();
  }

  toggleDryBrush(): void {
    this.dryBrush = !this.dryBrush;
    this.status = this.dryBrush ? 'Dry brush redistributes nearby colour' : 'Wet paint deposition restored';
    this.syncUi();
  }

  mixWithPrevious(): void {
    this.activePaint = mixPigmentColors(this.activePaint, COLORS[this.previousColor]);
    this.paintLoad = 100;
    this.status = `Pigments ${this.previousColor + 1} + ${this.selectedColor + 1} mixed on the palette`;
    this.syncUi();
  }

  cleanBrush(): void {
    this.paintLoad = 0;
    this.status = 'Brush cleaned - load a pigment from the palette';
    this.syncUi();
  }

  resetPalette(): void {
    this.paletteEngine.resetMixingArea();
    this.status = 'Mixing area reset without clearing the canvas';
    this.syncUi();
  }

  cycleReferenceOpacity(): void {
    if (!this.hasReference) {
      this.status = 'Import a reference image before enabling tracing';
      this.syncUi();
      return;
    }
    this.referenceOpacity = this.referenceOpacity < 25 ? 45 : this.referenceOpacity < 65 ? 80 : 0;
    const slider = this.root.querySelector<HTMLInputElement>('[data-reference-range]');
    if (slider != null) slider.value = this.referenceOpacity.toString();
    this.status = `Tracing overlay ${this.referenceOpacity}%`;
    this.refreshDisplay();
    this.markDirty();
  }

  restartGuide(): void {
    this.guidedStep = 0;
    this.status = 'Guide restarted: load paint from the physical palette';
    this.syncUi();
  }

  cycleEaselHeight(): void {
    this.status = this.options.cycleEaselHeight();
    this.syncUi();
  }

  cycleEaselDistance(): void {
    this.status = this.options.cycleEaselDistance();
    this.syncUi();
  }

  toggleHandedness(): void {
    this.status = this.options.toggleHandedness();
    const button = this.root.querySelector<HTMLButtonElement>('[data-handedness]');
    if (button != null) button.textContent = this.status.includes('LEFT') ? 'LAYOUT: LEFT HANDED' : 'LAYOUT: RIGHT HANDED';
    this.syncUi();
  }

  undo(): void {
    const previous = this.history.undo(this.captureSnapshot());
    if (previous == null) {
      this.status = 'Nothing left to undo';
      this.syncUi();
      return;
    }
    this.restoreSnapshot(previous);
    this.status = 'Last completed painting step undone';
    this.markDirty();
  }

  redo(): void {
    const next = this.history.redo(this.captureSnapshot());
    if (next == null) {
      this.status = 'Nothing left to redo';
      this.syncUi();
      return;
    }
    this.restoreSnapshot(next);
    this.status = 'Painting step restored';
    this.markDirty();
  }

  clear(): void {
    void this.newPainting();
  }

  save(): void {
    void this.saveProject(false);
  }

  exportPng(): void {
    const link = document.createElement('a');
    link.href = this.canvas.toDataURL('image/png');
    link.download = `canvas-atelier-${new Date().toISOString().slice(0, 10)}-${this.canvas.width}x${this.canvas.height}.png`;
    link.click();
    this.status = `Clean PNG exported at ${this.canvas.width} x ${this.canvas.height}`;
    this.syncUi();
  }

  beginSpatialStroke(x: number, y: number, pressure: number): void {
    if (this.drawing) return;
    this.pushUndo();
    this.drawing = true;
    this.paintLoad = this.paintEngine.begin(
      x,
      y,
      pressure,
      this.activePaint,
      this.brushSize,
      this.brushShape,
      this.wetness,
      this.paintLoad,
      this.stabilization,
      this.dryBrush,
    );
    this.status = 'Brush touching the canvas';
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
    this.guidedStep = 2;
    this.status = this.paintLoad < 8 ? 'Brush nearly dry - load more pigment' : 'Wet oil stroke added';
    this.markDirty();
  }

  cancelSpatialStroke(): void {
    if (!this.drawing) return;
    this.drawing = false;
    this.paintEngine.end();
    this.status = 'Stroke safely ended after tracking interruption';
    this.syncUi();
  }

  beginPaletteContact(x: number, y: number, pressure: number): void {
    if (this.paletteContact) return;
    this.paletteContact = true;
    this.paletteEngine.begin(x, y, pressure, this.activePaint, this.paintLoad);
    this.applyPaletteResult();
    this.guidedStep = Math.max(this.guidedStep, 1);
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
    this.status = 'Pigment ready - move the brush to the canvas';
    this.syncUi();
  }

  cancelContacts(): void {
    this.endPaletteContact();
    this.cancelSpatialStroke();
  }

  setImmersiveMode(active: boolean): void {
    this.immersiveMode = active;
    this.syncStudioVisibility();
  }

  setSpatialBrushState(held: boolean, shape: number): void {
    this.spatialBrushHeld = held;
    this.spatialBrushShape = Math.max(0, Math.min(2, shape));
    this.syncStudioHud();
  }

  private setDesktopStudioMode(active: boolean): void {
    if (this.desktopStudioMode === active) return;
    this.desktopStudioMode = active;
    this.options.onDesktopStudioChange(active);
    this.syncStudioVisibility();
  }

  private syncStudioVisibility(): void {
    const studioVisible = this.desktopStudioMode || this.immersiveMode;
    this.root.classList.toggle('paint-palette-app--xr-hidden', studioVisible);
    this.studioHud.classList.toggle('paint-studio-hud--active', studioVisible);
    const exit = this.studioHud.querySelector<HTMLButtonElement>('[data-exit-desktop]');
    if (exit != null) exit.hidden = !this.desktopStudioMode;
    this.syncStudioHud();
  }

  private syncStudioHud(): void {
    const finePointer = globalThis.matchMedia?.('(pointer: fine)').matches ?? false;
    const mode = this.studioHud.querySelector<HTMLElement>('[data-studio-mode]');
    const help = this.studioHud.querySelector<HTMLElement>('[data-studio-help]');
    const brush = this.studioHud.querySelector<HTMLElement>('[data-studio-brush]');
    const progress = this.studioHud.querySelector<HTMLElement>('[data-studio-progress]');
    if (mode != null) {
      mode.textContent = this.desktopStudioMode
        ? 'DESKTOP 3D PAINTING'
        : finePointer
          ? 'VR PREVIEW / MOUSE + HANDS'
          : 'HANDS-FIRST VR PAINTING';
    }
    if (help != null) {
      help.textContent = this.desktopStudioMode || finePointer
        ? 'Hold left mouse on a brush, drag to the palette for paint, then across the canvas.'
        : 'Pinch a brush to pick it up, touch the palette, then paint directly on the canvas.';
    }
    if (brush != null) {
      brush.textContent = this.spatialBrushHeld
        ? `${['ROUND', 'FLAT', 'FAN'][this.spatialBrushShape]} BRUSH HELD`
        : 'CHOOSE ROUND, FLAT, OR FAN BRUSH';
    }
    if (progress != null) progress.textContent = `LOAD ${Math.round(this.paintLoad)}% / ${this.strokeCount} STROKES`;
  }

  setPerformance(frameMilliseconds: number): void {
    const label = this.root.querySelector<HTMLElement>('[data-performance]');
    if (label != null) label.textContent = `FRAME ${frameMilliseconds.toFixed(1)} MS / ${this.canvas.width} x ${this.canvas.height} / ${this.strokeCount} STROKES`;
  }

  dispose(): void {
    this.disposed = true;
    window.clearTimeout(this.autosaveTimer);
    window.removeEventListener('pointerup', this.endStroke);
    window.removeEventListener('keydown', this.handleStudioKeydown);
    this.releaseGalleryUrls();
    this.studioHud.remove();
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
    this.root.querySelector<HTMLButtonElement>('[data-desktop-studio]')?.addEventListener('click', () => {
      this.setDesktopStudioMode(true);
    });
    this.studioHud.querySelector<HTMLButtonElement>('[data-exit-desktop]')?.addEventListener('click', () => {
      this.setDesktopStudioMode(false);
    });
    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-color]')) {
      button.addEventListener('click', () => this.selectColor(Number(button.dataset.color)));
    }
    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-size]')) {
      button.addEventListener('click', () => this.setBrushPreset([8, 18, 38].indexOf(Number(button.dataset.size))));
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
    this.root.querySelector<HTMLInputElement>('[data-stabilization]')?.addEventListener('input', (event) => {
      this.stabilization = Number((event.currentTarget as HTMLInputElement).value);
      this.status = `Brush stabilization ${this.stabilization}%`;
      this.syncUi();
    });
    this.root.querySelector<HTMLInputElement>('[data-reference-range]')?.addEventListener('input', (event) => {
      this.referenceOpacity = Number((event.currentTarget as HTMLInputElement).value);
      this.status = `Tracing overlay ${this.referenceOpacity}%`;
      this.refreshDisplay();
      this.markDirty();
    });
    this.root.querySelector<HTMLButtonElement>('[data-mix]')?.addEventListener('click', () => this.mixWithPrevious());
    this.root.querySelector<HTMLButtonElement>('[data-clean]')?.addEventListener('click', () => this.cleanBrush());
    this.root.querySelector<HTMLButtonElement>('[data-reset-palette]')?.addEventListener('click', () => this.resetPalette());
    this.root.querySelector<HTMLButtonElement>('[data-dry]')?.addEventListener('click', () => this.toggleDryBrush());
    this.root.querySelector<HTMLButtonElement>('[data-easel-height]')?.addEventListener('click', () => this.cycleEaselHeight());
    this.root.querySelector<HTMLButtonElement>('[data-easel-distance]')?.addEventListener('click', () => this.cycleEaselDistance());
    this.root.querySelector<HTMLButtonElement>('[data-handedness]')?.addEventListener('click', () => this.toggleHandedness());
    this.root.querySelector<HTMLButtonElement>('[data-undo]')?.addEventListener('click', () => this.undo());
    this.root.querySelector<HTMLButtonElement>('[data-redo]')?.addEventListener('click', () => this.redo());
    this.root.querySelector<HTMLButtonElement>('[data-new]')?.addEventListener('click', () => void this.newPainting());
    this.root.querySelector<HTMLButtonElement>('[data-save]')?.addEventListener('click', () => void this.saveProject(false));
    this.root.querySelector<HTMLButtonElement>('[data-export]')?.addEventListener('click', () => this.exportPng());
    this.root.querySelector<HTMLButtonElement>('[data-sketch]')?.addEventListener('click', () => this.renderSketch());
    this.root.querySelector<HTMLButtonElement>('[data-remove-reference]')?.addEventListener('click', () => this.removeReference());
    this.root.querySelector<HTMLInputElement>('[data-upload]')?.addEventListener('change', (event) => void this.loadReference(event));
    this.root.querySelector<HTMLElement>('[data-gallery]')?.addEventListener('click', (event) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>('[data-project-id]');
      if (target?.dataset.projectId != null) void this.openProject(target.dataset.projectId);
    });
    this.displayCanvas.addEventListener('pointerdown', (event) => this.beginStroke(event));
    this.displayCanvas.addEventListener('pointermove', (event) => this.continueStroke(event));
    window.addEventListener('pointerup', this.endStroke);
  }

  private beginStroke(event: PointerEvent): void {
    this.displayCanvas.setPointerCapture(event.pointerId);
    const point = this.canvasPoint(event);
    this.beginSpatialStroke(point.x, point.y, event.pressure);
    this.syncUi();
  }

  private continueStroke(event: PointerEvent): void {
    if (!this.drawing) return;
    const point = this.canvasPoint(event);
    this.continueSpatialStroke(point.x, point.y, event.pressure);
  }

  private readonly endStroke = (): void => {
    this.endSpatialStroke();
  };

  private async loadReference(event: Event): Promise<void> {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file == null) return;
    try {
      const source = await this.readFileAsDataUrl(file);
      const image = await this.loadImage(source);
      const scale = Math.min(1, 1400 / Math.max(image.width, image.height));
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));
      const normalized = document.createElement('canvas');
      normalized.width = width;
      normalized.height = height;
      normalized.getContext('2d')?.drawImage(image, 0, 0, width, height);
      await this.setReference(normalized.toDataURL('image/jpeg', 0.88));
      this.status = 'Reference loaded beside the canvas and into the tracing layer';
      this.markDirty();
    } catch (error) {
      this.status = `Reference import failed: ${this.errorMessage(error)}`;
      this.syncUi();
    }
  }

  private async setReference(dataUrl: string): Promise<void> {
    const image = await this.loadImage(dataUrl);
    this.referenceImage = image;
    this.referenceDataUrl = dataUrl;
    this.hasReference = true;
    const preview = this.root.querySelector<HTMLImageElement>('[data-reference-preview]');
    if (preview != null) preview.src = dataUrl;
    this.refreshDisplay();
  }

  private removeReference(): void {
    if (!this.hasReference) return;
    this.referenceImage = undefined;
    this.referenceDataUrl = '';
    this.hasReference = false;
    const preview = this.root.querySelector<HTMLImageElement>('[data-reference-preview]');
    if (preview != null) preview.removeAttribute('src');
    this.status = 'Reference removed; painted pixels are unchanged';
    this.refreshDisplay();
    this.markDirty();
  }

  private renderSketch(): void {
    const image = this.referenceImage;
    if (image == null) {
      this.status = 'Import a reference before creating a sketch';
      this.syncUi();
      return;
    }
    this.pushUndo();
    const sample = document.createElement('canvas');
    sample.width = this.canvas.width;
    sample.height = this.canvas.height;
    const sampleContext = sample.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
    const scale = Math.max(sample.width / image.width, sample.height / image.height);
    const width = image.width * scale;
    const height = image.height * scale;
    sampleContext.fillStyle = '#faf6ed';
    sampleContext.fillRect(0, 0, sample.width, sample.height);
    sampleContext.drawImage(image, (sample.width - width) / 2, (sample.height - height) / 2, width, height);
    const source = sampleContext.getImageData(0, 0, sample.width, sample.height);
    source.data.set(createPencilSketchPixels(source.data, sample.width, sample.height));
    this.context.putImageData(source, 0, 0);
    this.referenceOpacity = 0;
    const opacitySlider = this.root.querySelector<HTMLInputElement>('[data-reference-range]');
    if (opacitySlider != null) opacitySlider.value = '0';
    this.strokeCount = 0;
    this.paintEngine.resetHeight();
    this.status = 'Reference converted to a clean pencil sketch - choose a brush and paint over it';
    this.markDirty();
  }

  private async initializeStorage(): Promise<void> {
    try {
      await this.projectStore.ready();
      this.storageReady = true;
      const lastProjectId = await this.projectStore.getLastProjectId();
      if (lastProjectId != null) {
        const project = await this.projectStore.load(lastProjectId);
        if (project != null) {
          await this.restoreProject(project);
          this.status = 'Last editable project restored';
        }
      } else {
        await this.migrateLegacyArtwork();
      }
      await this.refreshGallery();
      if (this.activeProjectId === '') this.status = 'Fresh project ready; autosave is active';
    } catch (error) {
      this.storageReady = false;
      this.storageError = this.errorMessage(error);
      this.status = `Local project storage unavailable: ${this.storageError}`;
    }
    this.syncUi();
  }

  private async migrateLegacyArtwork(): Promise<void> {
    const legacy = localStorage.getItem('paint-palette-last-work');
    if (legacy == null) return;
    const image = await this.loadImage(legacy);
    this.context.drawImage(image, 0, 0, this.canvas.width, this.canvas.height);
    this.paintEngine.resetHeight();
    this.activeProjectId = this.createProjectId();
    this.projectName = 'Imported earlier artwork';
    this.projectCreatedAt = Date.now();
    this.dirty = true;
    this.revision += 1;
    await this.saveProject(true);
  }

  private async newPainting(): Promise<void> {
    const now = Date.now();
    if (this.dirty && now > this.newPaintingArmedUntil) {
      this.newPaintingArmedUntil = now + 5000;
      this.status = 'Unsaved changes detected - press NEW again within 5 seconds';
      this.syncUi();
      return;
    }
    if (this.dirty && this.storageReady) await this.saveProject(true);
    window.clearTimeout(this.autosaveTimer);
    this.autosavePending = false;
    this.activeProjectId = this.createProjectId();
    this.projectName = `Untitled ${new Date().toLocaleDateString()}`;
    this.projectCreatedAt = Date.now();
    this.referenceImage = undefined;
    this.referenceDataUrl = '';
    this.hasReference = false;
    this.strokeCount = 0;
    this.guidedStep = 0;
    this.resetCanvasPixels();
    this.history.clear();
    this.dirty = true;
    this.revision += 1;
    this.status = 'New linen canvas ready';
    this.refreshDisplay();
    this.scheduleAutosave();
    this.syncUi();
  }

  private async saveProject(autosave: boolean): Promise<void> {
    if (!this.storageReady) {
      this.autosavePending = false;
      this.status = this.storageError === '' ? 'Local project storage is not ready' : `Save failed: ${this.storageError}`;
      this.syncUi();
      return;
    }
    if (this.saveInFlight) {
      if (!autosave) this.status = 'A project save is already in progress';
      this.syncUi();
      return;
    }
    this.saveInFlight = true;
    window.clearTimeout(this.autosaveTimer);
    const saveRevision = this.revision;
    try {
      const project = await this.captureProject();
      await this.projectStore.save(project);
      await this.projectStore.setLastProjectId(project.id);
      this.activeProjectId = project.id;
      this.projectCreatedAt = project.createdAt;
      this.savedCount += 1;
      this.storageError = '';
      if (saveRevision === this.revision) {
        this.dirty = false;
        this.autosavePending = false;
      }
      this.status = autosave ? 'Project autosaved locally' : 'Editable project saved locally';
      await this.refreshGallery();
    } catch (error) {
      this.storageError = this.errorMessage(error);
      this.autosavePending = false;
      this.status = `Save failed: ${this.storageError}`;
    } finally {
      this.saveInFlight = false;
      if (saveRevision !== this.revision) this.scheduleAutosave();
      this.syncUi();
    }
  }

  private async captureProject(): Promise<PaintProjectRecord> {
    const now = Date.now();
    if (this.activeProjectId === '') this.activeProjectId = this.createProjectId();
    if (this.projectCreatedAt === 0) this.projectCreatedAt = now;
    const thumbnail = document.createElement('canvas');
    thumbnail.width = 240;
    thumbnail.height = 180;
    thumbnail.getContext('2d')?.drawImage(this.canvas, 0, 0, thumbnail.width, thumbnail.height);
    const [colorBlob, heightBlob, thumbnailBlob] = await Promise.all([
      this.canvasToBlob(this.canvas),
      this.canvasToBlob(this.heightCanvas),
      this.canvasToBlob(thumbnail, 'image/jpeg', 0.78),
    ]);
    return {
      id: this.activeProjectId,
      version: PAINT_PROJECT_VERSION,
      name: this.projectName,
      createdAt: this.projectCreatedAt,
      updatedAt: now,
      width: this.canvas.width,
      height: this.canvas.height,
      colorBlob,
      heightBlob,
      thumbnailBlob,
      referenceDataUrl: this.referenceDataUrl,
      referenceOpacity: this.referenceOpacity,
      strokeCount: this.strokeCount,
      selectedColor: this.selectedColor,
      activePaint: this.activePaint,
      brushSize: this.brushSize,
      brushShape: this.brushShape,
      wetness: this.wetness,
      paintLoad: this.paintLoad,
      stabilization: this.stabilization,
      dryBrush: this.dryBrush,
      variationSeed: 0,
    };
  }

  private async openProject(id: string): Promise<void> {
    try {
      if (this.dirty && this.storageReady) await this.saveProject(true);
      const project = await this.projectStore.load(id);
      if (project == null) throw new Error('Saved project was not found');
      await this.restoreProject(project);
      await this.projectStore.setLastProjectId(project.id);
      this.status = `${project.name} reopened for editing`;
    } catch (error) {
      this.status = `Could not reopen project: ${this.errorMessage(error)}`;
    }
    this.syncUi();
  }

  private async restoreProject(project: PaintProjectRecord): Promise<void> {
    await Promise.all([
      this.drawBlob(project.colorBlob, this.context, this.canvas.width, this.canvas.height),
      this.drawBlob(project.heightBlob, this.heightContext, this.heightCanvas.width, this.heightCanvas.height),
    ]);
    this.activeProjectId = project.id;
    this.projectName = project.name;
    this.projectCreatedAt = project.createdAt;
    this.strokeCount = project.strokeCount;
    this.selectedColor = Math.max(0, Math.min(COLORS.length - 1, project.selectedColor));
    this.activePaint = project.activePaint;
    this.brushSize = project.brushSize;
    this.brushShape = Math.max(0, Math.min(2, project.brushShape)) as BrushShape;
    this.wetness = project.wetness;
    this.paintLoad = project.paintLoad;
    this.stabilization = project.stabilization;
    this.dryBrush = project.dryBrush;
    this.referenceOpacity = project.referenceOpacity;
    if (project.referenceDataUrl !== '') await this.setReference(project.referenceDataUrl);
    else {
      this.referenceImage = undefined;
      this.referenceDataUrl = '';
      this.hasReference = false;
    }
    this.history.clear();
    this.dirty = false;
    this.autosavePending = false;
    this.refreshDisplay();
  }

  private async refreshGallery(): Promise<void> {
    if (!this.storageReady) return;
    this.galleryProjects = await this.projectStore.list();
    this.releaseGalleryUrls();
    const gallery = this.root.querySelector<HTMLElement>('[data-gallery]');
    if (gallery == null) return;
    if (this.galleryProjects.length === 0) {
      gallery.innerHTML = '<small>Saved paintings will appear here.</small>';
      return;
    }
    gallery.innerHTML = this.galleryProjects.slice(0, 8).map((project) => {
      const url = URL.createObjectURL(project.thumbnailBlob);
      this.galleryUrls.push(url);
      return `<button type="button" data-project-id="${project.id}"><img src="${url}" alt="${project.name} thumbnail" /><span>${project.name}</span><small>${new Date(project.updatedAt).toLocaleDateString()}</small></button>`;
    }).join('');
  }

  private releaseGalleryUrls(): void {
    for (const url of this.galleryUrls) URL.revokeObjectURL(url);
    this.galleryUrls.length = 0;
  }

  private resetCanvasPixels(): void {
    this.context.save();
    this.context.globalCompositeOperation = 'source-over';
    this.context.fillStyle = '#f4ecd9';
    this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.context.restore();
    this.addCanvasGrain();
    this.paintEngine.resetHeight();
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
    this.history.checkpoint(this.captureSnapshot());
  }

  private captureSnapshot(): PaintSnapshot {
    return {
      color: this.context.getImageData(0, 0, this.canvas.width, this.canvas.height),
      height: this.heightContext.getImageData(0, 0, this.heightCanvas.width, this.heightCanvas.height),
      paint: this.activePaint,
      load: this.paintLoad,
      strokeCount: this.strokeCount,
      referenceOpacity: this.referenceOpacity,
    };
  }

  private restoreSnapshot(snapshot: PaintSnapshot): void {
    this.context.putImageData(snapshot.color, 0, 0);
    this.heightContext.putImageData(snapshot.height, 0, 0);
    this.activePaint = snapshot.paint;
    this.paintLoad = snapshot.load;
    this.strokeCount = snapshot.strokeCount;
    this.referenceOpacity = snapshot.referenceOpacity;
    const referenceSlider = this.root.querySelector<HTMLInputElement>('[data-reference-range]');
    if (referenceSlider != null) referenceSlider.value = String(this.referenceOpacity);
    this.paintEngine.end();
    this.drawing = false;
    this.refreshDisplay();
  }

  private canvasPoint(event: PointerEvent): { x: number; y: number } {
    const rect = this.displayCanvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (this.canvas.width / rect.width),
      y: (event.clientY - rect.top) * (this.canvas.height / rect.height),
    };
  }

  private refreshDisplay(): void {
    this.displayContext.save();
    this.displayContext.globalAlpha = 1;
    this.displayContext.globalCompositeOperation = 'source-over';
    this.displayContext.clearRect(0, 0, this.displayCanvas.width, this.displayCanvas.height);
    this.displayContext.drawImage(this.canvas, 0, 0);
    if (this.referenceImage != null && this.referenceOpacity > 0) {
      this.displayContext.globalAlpha = this.referenceOpacity / 100;
      const scale = Math.max(this.displayCanvas.width / this.referenceImage.width, this.displayCanvas.height / this.referenceImage.height);
      const width = this.referenceImage.width * scale;
      const height = this.referenceImage.height * scale;
      this.displayContext.drawImage(
        this.referenceImage,
        (this.displayCanvas.width - width) / 2,
        (this.displayCanvas.height - height) / 2,
        width,
        height,
      );
    }
    this.displayContext.restore();
    this.options.onTextureChange();
  }

  private markDirty(): void {
    this.dirty = true;
    this.revision += 1;
    this.scheduleAutosave();
    this.refreshDisplay();
    this.syncUi();
  }

  private scheduleAutosave(): void {
    window.clearTimeout(this.autosaveTimer);
    if (!this.storageReady) {
      this.autosavePending = false;
      return;
    }
    this.autosavePending = true;
    this.autosaveTimer = window.setTimeout(() => void this.saveProject(true), AUTOSAVE_DELAY_MS);
  }

  private syncUi(): void {
    if (this.disposed) return;
    this.syncStudioHud();
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
    if (label != null) label.textContent = COLORS.includes(this.activePaint as typeof COLORS[number]) ? names[this.selectedColor] : 'Mixed pigment';
    const status = this.root.querySelector<HTMLElement>('[data-status]');
    if (status != null) status.textContent = this.status;
    const strokes = this.root.querySelector<HTMLElement>('[data-strokes]');
    if (strokes != null) strokes.textContent = `${this.strokeCount} stroke${this.strokeCount === 1 ? '' : 's'}`;
    const loadLabel = this.root.querySelector<HTMLElement>('[data-load-label]');
    if (loadLabel != null) loadLabel.textContent = `${Math.round(this.paintLoad)}%`;
    const loadBar = this.root.querySelector<HTMLElement>('[data-load-bar]');
    if (loadBar != null) loadBar.style.width = `${Math.round(this.paintLoad)}%`;
    const stabilization = this.root.querySelector<HTMLElement>('[data-stabilization-label]');
    if (stabilization != null) stabilization.textContent = `${this.stabilization}%`;
    const dry = this.root.querySelector<HTMLButtonElement>('[data-dry]');
    if (dry != null) {
      dry.textContent = `DRY BRUSH: ${this.dryBrush ? 'ON' : 'OFF'}`;
      dry.classList.toggle('selected', this.dryBrush);
    }
    const opacity = this.root.querySelector<HTMLElement>('[data-reference-opacity]');
    if (opacity != null) opacity.textContent = `${this.referenceOpacity}%`;
    const referenceCard = this.root.querySelector<HTMLElement>('[data-reference-card]');
    referenceCard?.classList.toggle('has-reference', this.hasReference);
    const guide = this.root.querySelector<HTMLElement>('[data-guide]');
    if (guide != null) guide.textContent = [
      '1. Load paint from the palette.',
      '2. Touch the brush tip to the canvas.',
      'Exercise complete. Mix two pigments and paint a highlight.',
    ][this.guidedStep];
    const storage = this.root.querySelector<HTMLElement>('[data-storage]');
    if (storage != null) {
      storage.textContent = this.storageError !== ''
        ? `Storage error: ${this.storageError}`
        : this.autosavePending
          ? 'Autosave pending...'
          : this.storageReady
            ? `${this.dirty ? 'Unsaved changes' : 'Saved locally'} / ${this.galleryProjects.length} project${this.galleryProjects.length === 1 ? '' : 's'}`
            : 'Opening local project storage...';
      storage.classList.toggle('error', this.storageError !== '');
    }
    const undo = this.root.querySelector<HTMLButtonElement>('[data-undo]');
    if (undo != null) undo.disabled = this.history.undoCount === 0;
    const redo = this.root.querySelector<HTMLButtonElement>('[data-redo]');
    if (redo != null) redo.disabled = this.history.redoCount === 0;

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
      undoCount: this.history.undoCount,
      redoCount: this.history.redoCount,
      hasReference: this.hasReference,
      referenceOpacity: this.referenceOpacity,
      savedCount: this.savedCount,
      galleryCount: this.galleryProjects.length,
      storageReady: this.storageReady,
      autosavePending: this.autosavePending,
      dirty: this.dirty,
      stabilization: this.stabilization,
      dryBrush: this.dryBrush,
      guidedStep: this.guidedStep,
      status: this.status,
    });
  }

  private createProjectId(): string {
    return globalThis.crypto?.randomUUID?.() ?? `painting-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  }

  private readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener('load', () => resolve(String(reader.result)));
      reader.addEventListener('error', () => reject(reader.error ?? new Error('Could not read the selected image')));
      reader.readAsDataURL(file);
    });
  }

  private loadImage(source: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener('load', () => resolve(image));
      image.addEventListener('error', () => reject(new Error('Image could not be decoded')));
      image.src = source;
    });
  }

  private canvasToBlob(canvas: HTMLCanvasElement, type = 'image/png', quality?: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob == null) reject(new Error('Canvas encoding failed'));
        else resolve(blob);
      }, type, quality);
    });
  }

  private async drawBlob(blob: Blob, context: CanvasRenderingContext2D, width: number, height: number): Promise<void> {
    const url = URL.createObjectURL(blob);
    try {
      const image = await this.loadImage(url);
      context.clearRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
