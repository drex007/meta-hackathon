import {
  CanvasTexture,
  Color,
  createSystem,
  DomeTexture,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
  SRGBColorSpace,
  UIKit,
  UIKitMLAsset,
  Vector3,
  VisibilityState,
} from '@iwsdk/core';
import { PaintStudioOverlay, type PaintOverlayState } from './paint-studio-overlay.js';
import { PaintStudioState } from './paint-components.js';

export class PaintStudioSystem extends createSystem({
  sessions: { required: [PaintStudioState] },
}) {
  private overlay?: PaintStudioOverlay;
  private texture?: CanvasTexture;
  private heightTexture?: CanvasTexture;
  private paletteTexture?: CanvasTexture;
  private paletteHeightTexture?: CanvasTexture;
  private canvasMaterial?: MeshStandardMaterial;
  private paletteMaterial?: MeshStandardMaterial;
  private canvasSurface?: Mesh;
  private paletteSurface?: Mesh;
  private brushTip?: Object3D;
  private brushBristleMaterial?: MeshStandardMaterial;
  private readonly brushPaintColor = new Color();
  private readonly dryBristleColor = new Color('#d8bd8f');
  private readonly tipWorld = new Vector3();
  private readonly tipOnCanvas = new Vector3();
  private readonly tipOnPalette = new Vector3();
  private brushContact = false;
  private paletteContact = false;
  private panel?: UIKitMLAsset;
  private statusText?: UIKit.Text;
  private colorText?: UIKit.Text;
  private brushText?: UIKit.Text;
  private shapeText?: UIKit.Text;
  private loadText?: UIKit.Text;
  private blendText?: UIKit.Text;
  private historyText?: UIKit.Text;

  init(): void {
    this.overlay = new PaintStudioOverlay({
      enterXr: () => void this.world.launchXR(),
      xrEnabled: this.world.xrEnabled,
      onTextureChange: () => {
        if (this.texture != null) this.texture.needsUpdate = true;
        if (this.heightTexture != null) this.heightTexture.needsUpdate = true;
      },
      onPaletteTextureChange: () => {
        if (this.paletteTexture != null) this.paletteTexture.needsUpdate = true;
        if (this.paletteHeightTexture != null) this.paletteHeightTexture.needsUpdate = true;
      },
      onStateChange: (state) => this.applyState(state),
    });
    this.cleanupFuncs.push(this.world.visibilityState.subscribe((state) => {
      this.overlay?.setImmersiveMode(state !== VisibilityState.NonImmersive);
    }));
    const level = this.world.activeLevel.value;
    if (level != null && !level.hasComponent(DomeTexture)) {
      level.addComponent(DomeTexture, {
        src: `${import.meta.env.BASE_URL}environments/alpine-lake-panorama.png`,
        intensity: 0.96,
        blurriness: 0,
        rotation: [0, 0, 0],
      });
    }
    this.texture = new CanvasTexture(this.overlay.canvas);
    this.texture.colorSpace = SRGBColorSpace;
    this.texture.needsUpdate = true;
    this.heightTexture = new CanvasTexture(this.overlay.heightCanvas);
    this.heightTexture.needsUpdate = true;
    this.paletteTexture = new CanvasTexture(this.overlay.paletteCanvas);
    this.paletteTexture.colorSpace = SRGBColorSpace;
    this.paletteTexture.needsUpdate = true;
    this.paletteHeightTexture = new CanvasTexture(this.overlay.paletteHeightCanvas);
    this.paletteHeightTexture.needsUpdate = true;
    this.applyCanvasTexture(this.world.requireSceneObject<Object3D>('studio-easel'));
    this.applyPaletteTexture(this.world.requireSceneObject<Object3D>('painter-cart'));
    const brushRoot = this.world.requireSceneObject<Object3D>('artist-brush');
    this.brushTip = brushRoot.getObjectByName('BrushTip');
    this.prepareBrushBristles(brushRoot);
    this.connectPanel();
    this.cleanupFuncs.push(() => {
      this.texture?.dispose();
      this.heightTexture?.dispose();
      this.paletteTexture?.dispose();
      this.paletteHeightTexture?.dispose();
      this.canvasMaterial?.dispose();
      this.paletteMaterial?.dispose();
      this.brushBristleMaterial?.dispose();
      this.overlay?.dispose();
    });
  }

  update(): void {
    if (this.overlay == null || this.brushTip == null || this.canvasSurface == null) return;
    this.brushTip.getWorldPosition(this.tipWorld);
    if (this.updatePaletteContact()) {
      if (this.brushContact) this.overlay.endSpatialStroke();
      this.brushContact = false;
      this.paletteContact = true;
      return;
    }
    if (this.paletteContact) this.overlay.endPaletteContact();
    this.paletteContact = false;
    this.tipOnCanvas.copy(this.tipWorld);
    this.canvasSurface.worldToLocal(this.tipOnCanvas);
    const inside = Math.abs(this.tipOnCanvas.x) <= 0.38 && Math.abs(this.tipOnCanvas.y) <= 0.28;
    const touching = inside && this.tipOnCanvas.z >= -0.012 && this.tipOnCanvas.z <= 0.052;
    if (touching) {
      const x = (this.tipOnCanvas.x / 0.76 + 0.5) * this.overlay.canvas.width;
      const y = (0.5 - this.tipOnCanvas.y / 0.56) * this.overlay.canvas.height;
      const pressure = Math.max(0.08, Math.min(1, (0.052 - this.tipOnCanvas.z) / 0.064));
      if (!this.brushContact) this.overlay.beginSpatialStroke(x, y, pressure);
      else this.overlay.continueSpatialStroke(x, y, pressure);
    } else if (this.brushContact) {
      this.overlay.endSpatialStroke();
    }
    this.brushContact = touching;
  }

  private updatePaletteContact(): boolean {
    if (this.overlay == null || this.paletteSurface == null) return false;
    this.tipOnPalette.copy(this.tipWorld);
    this.paletteSurface.worldToLocal(this.tipOnPalette);
    const radiusSquared = this.tipOnPalette.x * this.tipOnPalette.x + this.tipOnPalette.y * this.tipOnPalette.y;
    const inside = radiusSquared <= 0.228 * 0.228;
    const touching = inside && this.tipOnPalette.z >= -0.025 && this.tipOnPalette.z <= 0.06;
    if (touching) {
      const x = (this.tipOnPalette.x / 0.456 + 0.5) * this.overlay.paletteCanvas.width;
      const y = (0.5 - this.tipOnPalette.y / 0.456) * this.overlay.paletteCanvas.height;
      const pressure = Math.max(0.08, Math.min(1, (0.06 - this.tipOnPalette.z) / 0.085));
      if (!this.paletteContact) this.overlay.beginPaletteContact(x, y, pressure);
      else this.overlay.continuePaletteContact(x, y, pressure);
    }
    return touching;
  }

  private applyCanvasTexture(root: Object3D): void {
    root.traverse((object) => {
      if (!(object instanceof Mesh) || object.name !== 'PaintingSurfaceMesh') return;
      this.canvasSurface = object;
      this.canvasMaterial = new MeshStandardMaterial({
        map: this.texture,
        bumpMap: this.heightTexture,
        bumpScale: 0.026,
        color: '#ffffff',
        roughness: 0.66,
        metalness: 0,
      });
      object.material = this.canvasMaterial;
    });
  }

  private applyPaletteTexture(root: Object3D): void {
    root.traverse((object) => {
      if (!(object instanceof Mesh) || object.name !== 'PaletteMixSurface') return;
      this.paletteSurface = object;
      this.paletteMaterial = new MeshStandardMaterial({
        map: this.paletteTexture,
        bumpMap: this.paletteHeightTexture,
        bumpScale: 0.016,
        color: '#ffffff',
        roughness: 0.38,
        metalness: 0,
      });
      object.material = this.paletteMaterial;
    });
  }

  private prepareBrushBristles(root: Object3D): void {
    root.traverse((object) => {
      if (!(object instanceof Mesh) || !object.name.startsWith('Bristle-')) return;
      if (this.brushBristleMaterial == null) this.brushBristleMaterial = (object.material as MeshStandardMaterial).clone();
      object.material = this.brushBristleMaterial;
    });
  }

  private connectPanel(): void {
    this.panel = this.world.requireSceneObject<UIKitMLAsset>('paint-studio-panel');
    this.statusText = this.panel.requireElementById<UIKit.Text>('StatusText');
    this.colorText = this.panel.requireElementById<UIKit.Text>('ColorText');
    this.brushText = this.panel.requireElementById<UIKit.Text>('BrushText');
    this.shapeText = this.panel.requireElementById<UIKit.Text>('ShapeText');
    this.loadText = this.panel.requireElementById<UIKit.Text>('LoadText');
    this.blendText = this.panel.requireElementById<UIKit.Text>('BlendText');
    this.historyText = this.panel.requireElementById<UIKit.Text>('HistoryText');
    const bindings: Array<[string, () => void]> = [
      ['ColorRed', () => this.overlay?.selectColor(0)],
      ['ColorYellow', () => this.overlay?.selectColor(1)],
      ['ColorBlue', () => this.overlay?.selectColor(2)],
      ['ColorWhite', () => this.overlay?.selectColor(3)],
      ['ColorBlack', () => this.overlay?.selectColor(4)],
      ['ColorGreen', () => this.overlay?.selectColor(5)],
      ['Btn_Small', () => this.overlay?.setBrushPreset(0)],
      ['Btn_Medium', () => this.overlay?.setBrushPreset(1)],
      ['Btn_Large', () => this.overlay?.setBrushPreset(2)],
      ['Btn_Flat', () => this.overlay?.setBrushShape(0)],
      ['Btn_Filbert', () => this.overlay?.setBrushShape(1)],
      ['Btn_Fan', () => this.overlay?.setBrushShape(2)],
      ['Btn_Blend', () => this.overlay?.cycleWetness()],
      ['Btn_Mix', () => this.overlay?.mixWithPrevious()],
      ['Btn_Undo', () => this.overlay?.undo()],
      ['Btn_Clear', () => this.overlay?.clear()],
      ['Btn_Save', () => this.overlay?.save()],
    ];
    for (const [id, action] of bindings) {
      const element = this.panel.requireElementById(id);
      element.name = id;
      element.addEventListener('click', action);
      this.cleanupFuncs.push(() => element.removeEventListener('click', action));
    }
  }

  private applyState(state: PaintOverlayState): void {
    const session = this.queries.sessions.entities.values().next().value;
    if (session != null) {
      session.setValue(PaintStudioState, 'selectedColor', state.selectedColor);
      session.setValue(PaintStudioState, 'brushSize', state.brushSize);
      session.setValue(PaintStudioState, 'brushShape', state.brushShape);
      session.setValue(PaintStudioState, 'paintLoad', state.paintLoad);
      session.setValue(PaintStudioState, 'wetness', state.wetness);
      session.setValue(PaintStudioState, 'paletteMixCount', state.paletteMixCount);
      session.setValue(PaintStudioState, 'paletteContact', state.paletteContact);
      session.setValue(PaintStudioState, 'strokeCount', state.strokeCount);
      session.setValue(PaintStudioState, 'undoCount', state.undoCount);
      session.setValue(PaintStudioState, 'mode', state.hasReference ? 1 : 0);
      session.setValue(PaintStudioState, 'hasReference', state.hasReference);
      session.setValue(PaintStudioState, 'savedCount', state.savedCount);
    }
    const colorNames = ['CRIMSON', 'YELLOW', 'BLUE', 'WHITE', 'BLACK', 'GREEN'];
    this.statusText?.setProperties({ text: state.status.toUpperCase() });
    this.colorText?.setProperties({ text: colorNames[state.selectedColor] });
    this.brushText?.setProperties({ text: ['FINE', 'MEDIUM', 'BROAD'][state.brushSize - 1] });
    this.shapeText?.setProperties({ text: `${['FLAT', 'FILBERT', 'FAN'][state.brushShape]} BRUSH` });
    this.loadText?.setProperties({ text: `LOAD ${state.paintLoad}%` });
    this.blendText?.setProperties({ text: `BLENDING ${state.wetness}%` });
    this.brushPaintColor.set(state.paintColor).lerp(this.dryBristleColor, 1 - state.paintLoad / 100);
    this.brushBristleMaterial?.color.copy(this.brushPaintColor);
    this.historyText?.setProperties({ text: `${state.strokeCount} STROKES / ${state.undoCount} UNDO` });
  }
}
