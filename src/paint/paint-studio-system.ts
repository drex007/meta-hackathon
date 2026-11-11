import {
  CanvasTexture,
  Color,
  createSystem,
  DomeTexture,
  type Entity,
  Grabbed,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
  type Object3DEventMap,
  Quaternion,
  SRGBColorSpace,
  UIKit,
  UIKitMLAsset,
  Vector3,
  VisibilityState,
} from '@iwsdk/core';
import { PaintStudioOverlay, type PaintOverlayState } from './paint-studio-overlay.js';
import { DesktopBrushHeld, PaintBrush, PaintStudioState } from './paint-components.js';
import { writeCanvasContact, type CanvasContactSample } from './canvas-contact.js';
import {
  writeCirclePlaneHit,
  writeRectPlaneHit,
  type PlaneHit,
} from './desktop-brush-control.js';

interface HapticActuator {
  pulse?: (intensity: number, duration: number) => Promise<boolean>;
  playEffect?: (type: string, parameters: Record<string, number>) => Promise<string>;
}

interface HapticGamepad {
  hapticActuators?: HapticActuator[];
  vibrationActuator?: HapticActuator;
}

interface RegisteredPaintBrush {
  entity: Entity;
  root: Object3D;
  tip?: Object3D;
  bristleMaterial?: MeshStandardMaterial;
  shape: number;
  homeX: number;
  homePosition: Vector3;
  homeQuaternion: Quaternion;
  tipOffset: Vector3;
  desktopRayOrigin: Vector3;
  desktopRayDirection: Vector3;
  desktopPointerId?: number;
  hasDesktopRay: boolean;
  resetOnRelease: boolean;
  pointerDown?: (event: Object3DEventMap['pointerdown']) => void;
  pointerMove?: (event: Object3DEventMap['pointermove']) => void;
  pointerUp?: (event: Object3DEventMap['pointerup']) => void;
  pointerCancel?: (event: Object3DEventMap['pointercancel']) => void;
}

export class PaintStudioSystem extends createSystem({
  sessions: { required: [PaintStudioState] },
  brushes: { required: [PaintBrush] },
  heldBrushes: { required: [PaintBrush, Grabbed] },
  desktopHeldBrushes: { required: [PaintBrush, DesktopBrushHeld] },
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
  private easelRoot?: Object3D;
  private cartRoot?: Object3D;
  private readonly brushes = new Map<Entity, RegisteredPaintBrush>();
  private readonly heldBrushes = new Set<Entity>();
  private readonly desktopHeldBrushes = new Set<Entity>();
  private activeBrush?: RegisteredPaintBrush;
  private readonly brushPaintColor = new Color();
  private readonly dryBristleColor = new Color('#d8bd8f');
  private readonly tipWorld = new Vector3();
  private readonly tipOnCanvas = new Vector3();
  private readonly tipOnPalette = new Vector3();
  private readonly lastTipWorld = new Vector3();
  private readonly localRayOrigin = new Vector3();
  private readonly localRayEnd = new Vector3();
  private readonly localRayDirection = new Vector3();
  private readonly desiredTipWorld = new Vector3();
  private readonly desiredRootWorld = new Vector3();
  private readonly tipOffsetWorld = new Vector3();
  private readonly brushWorldScale = new Vector3();
  private readonly rotationAxisX = new Vector3(1, 0, 0);
  private readonly surfaceWorldQuaternion = new Quaternion();
  private readonly parentWorldQuaternion = new Quaternion();
  private readonly brushWorldQuaternion = new Quaternion();
  private readonly brushLocalQuaternion = new Quaternion();
  private readonly brushToSurfaceQuaternion = new Quaternion().setFromAxisAngle(this.rotationAxisX, Math.PI / 2);
  private readonly canvasPlaneHit: PlaneHit = { x: 0, y: 0, t: 0 };
  private readonly palettePlaneHit: PlaneHit = { x: 0, y: 0, t: 0 };
  private readonly canvasContact: CanvasContactSample = { x: 0, y: 0, pressure: 0 };
  private hasLastTip = false;
  private brushContact = false;
  private paletteContact = false;
  private performanceTime = 0;
  private performanceFrames = 0;
  private easelHeightIndex = 1;
  private easelDistanceIndex = 1;
  private leftHanded = false;
  private desktopBrushHeld = false;
  private desktopBrushShape = 0;
  private panel?: UIKitMLAsset;
  private statusText?: UIKit.Text;
  private colorText?: UIKit.Text;
  private brushText?: UIKit.Text;
  private shapeText?: UIKit.Text;
  private loadText?: UIKit.Text;
  private blendText?: UIKit.Text;
  private historyText?: UIKit.Text;
  private storageText?: UIKit.Text;
  private guideText?: UIKit.Text;
  private traceText?: UIKit.Text;
  private performanceText?: UIKit.Text;
  private layoutText?: UIKit.Text;

  init(): void {
    this.overlay = new PaintStudioOverlay({
      enterXr: () => void this.world.launchXR(),
      xrEnabled: this.world.xrEnabled,
      cycleEaselHeight: () => this.cycleEaselHeight(),
      cycleEaselDistance: () => this.cycleEaselDistance(),
      toggleHandedness: () => this.toggleHandedness(),
      onDesktopStudioChange: (active) => {
        if (!active) this.releaseAllDesktopBrushes();
      },
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
      if (state === VisibilityState.VisibleBlurred) {
        this.releaseAllDesktopBrushes();
        this.endAllContacts();
      }
    }));
    const releaseDesktopBrushes = (): void => this.releaseAllDesktopBrushes();
    window.addEventListener('blur', releaseDesktopBrushes);
    this.cleanupFuncs.push(() => window.removeEventListener('blur', releaseDesktopBrushes));
    const level = this.world.activeLevel.value;
    if (level != null && !level.hasComponent(DomeTexture)) {
      level.addComponent(DomeTexture, {
        src: `${import.meta.env.BASE_URL}environments/alpine-lake-panorama.png`,
        intensity: 0.96,
        blurriness: 0,
        rotation: [0, 0, 0],
      });
    }
    this.texture = new CanvasTexture(this.overlay.displayCanvas);
    this.texture.colorSpace = SRGBColorSpace;
    this.texture.needsUpdate = true;
    this.heightTexture = new CanvasTexture(this.overlay.heightCanvas);
    this.heightTexture.needsUpdate = true;
    this.paletteTexture = new CanvasTexture(this.overlay.paletteCanvas);
    this.paletteTexture.colorSpace = SRGBColorSpace;
    this.paletteTexture.needsUpdate = true;
    this.paletteHeightTexture = new CanvasTexture(this.overlay.paletteHeightCanvas);
    this.paletteHeightTexture.needsUpdate = true;
    this.easelRoot = this.world.requireSceneObject<Object3D>('studio-easel');
    this.cartRoot = this.world.requireSceneObject<Object3D>('painter-cart');
    this.applyCanvasTexture(this.easelRoot);
    this.applyPaletteTexture(this.cartRoot);
    this.cleanupFuncs.push(
      this.queries.brushes.subscribe('qualify', (entity) => this.registerBrush(entity)),
      this.queries.brushes.subscribe('disqualify', (entity) => this.unregisterBrush(entity)),
      this.queries.heldBrushes.subscribe('qualify', (entity) => this.activateBrush(entity, false)),
      this.queries.heldBrushes.subscribe('disqualify', (entity) => this.deactivateBrush(entity, false)),
      this.queries.desktopHeldBrushes.subscribe('qualify', (entity) => this.activateBrush(entity, true)),
      this.queries.desktopHeldBrushes.subscribe('disqualify', (entity) => this.deactivateBrush(entity, true)),
    );
    for (const entity of this.queries.brushes.entities) this.registerBrush(entity);
    for (const entity of this.queries.heldBrushes.entities) this.activateBrush(entity, false);
    for (const entity of this.queries.desktopHeldBrushes.entities) this.activateBrush(entity, true);
    this.connectPanel();
    this.applyStudioPlacement();
    this.cleanupFuncs.push(() => {
      this.texture?.dispose();
      this.heightTexture?.dispose();
      this.paletteTexture?.dispose();
      this.paletteHeightTexture?.dispose();
      this.canvasMaterial?.dispose();
      this.paletteMaterial?.dispose();
      this.disposeBrushes();
      this.overlay?.dispose();
    });
  }

  update(delta: number): void {
    if (this.overlay == null) return;
    this.updatePerformance(delta);
    if (this.activeBrush != null && this.desktopHeldBrushes.has(this.activeBrush.entity)) {
      this.positionDesktopBrush(this.activeBrush);
    }
    const brushTip = this.activeBrush?.tip;
    if (brushTip == null || this.canvasSurface == null) return;
    brushTip.getWorldPosition(this.tipWorld);
    const trackingJump = this.hasLastTip && this.tipWorld.distanceToSquared(this.lastTipWorld) > 0.18 * 0.18;
    if (delta > 0.2 || trackingJump) this.endAllContacts();
    this.lastTipWorld.copy(this.tipWorld);
    this.hasLastTip = true;
    if (this.updatePaletteContact()) {
      if (this.brushContact) this.overlay.endSpatialStroke();
      this.brushContact = false;
      if (!this.paletteContact) this.pulseContactHaptics();
      this.paletteContact = true;
      return;
    }
    if (this.paletteContact) this.overlay.endPaletteContact();
    this.paletteContact = false;
    this.tipOnCanvas.copy(this.tipWorld);
    this.canvasSurface.worldToLocal(this.tipOnCanvas);
    const touching = writeCanvasContact(
      this.tipOnCanvas.x,
      this.tipOnCanvas.y,
      this.tipOnCanvas.z,
      this.overlay.canvas.width,
      this.overlay.canvas.height,
      this.canvasContact,
    );
    if (touching) {
      if (!this.brushContact) {
        this.overlay.beginSpatialStroke(this.canvasContact.x, this.canvasContact.y, this.canvasContact.pressure);
        this.pulseContactHaptics();
      } else {
        this.overlay.continueSpatialStroke(this.canvasContact.x, this.canvasContact.y, this.canvasContact.pressure);
      }
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

  private positionDesktopBrush(brush: RegisteredPaintBrush): void {
    if (!brush.hasDesktopRay || this.canvasSurface == null || this.paletteSurface == null) return;
    this.writeLocalRay(this.canvasSurface, brush);
    const hitsCanvas = writeRectPlaneHit(
      this.localRayOrigin.x,
      this.localRayOrigin.y,
      this.localRayOrigin.z,
      this.localRayDirection.x,
      this.localRayDirection.y,
      this.localRayDirection.z,
      0.018,
      0.37,
      0.27,
      this.canvasPlaneHit,
    );
    this.writeLocalRay(this.paletteSurface, brush);
    const hitsPalette = writeCirclePlaneHit(
      this.localRayOrigin.x,
      this.localRayOrigin.y,
      this.localRayOrigin.z,
      this.localRayDirection.x,
      this.localRayDirection.y,
      this.localRayDirection.z,
      0.018,
      0.218,
      this.palettePlaneHit,
    );
    if (!hitsCanvas && !hitsPalette) return;
    if (hitsPalette && (!hitsCanvas || this.palettePlaneHit.t < this.canvasPlaneHit.t)) {
      this.placeDesktopBrushOnSurface(
        brush,
        this.paletteSurface,
        this.palettePlaneHit.x,
        this.palettePlaneHit.y,
        0.018,
      );
      return;
    }
    this.placeDesktopBrushOnSurface(
      brush,
      this.canvasSurface,
      this.canvasPlaneHit.x,
      this.canvasPlaneHit.y,
      0.018,
    );
  }

  private writeLocalRay(surface: Object3D, brush: RegisteredPaintBrush): void {
    this.localRayOrigin.copy(brush.desktopRayOrigin);
    this.localRayEnd.copy(brush.desktopRayOrigin).add(brush.desktopRayDirection);
    surface.worldToLocal(this.localRayOrigin);
    surface.worldToLocal(this.localRayEnd);
    this.localRayDirection.subVectors(this.localRayEnd, this.localRayOrigin);
  }

  private placeDesktopBrushOnSurface(
    brush: RegisteredPaintBrush,
    surface: Object3D,
    localX: number,
    localY: number,
    localZ: number,
  ): void {
    this.desiredTipWorld.set(localX, localY, localZ);
    surface.localToWorld(this.desiredTipWorld);
    surface.getWorldQuaternion(this.surfaceWorldQuaternion);
    this.brushWorldQuaternion.copy(this.surfaceWorldQuaternion).multiply(this.brushToSurfaceQuaternion);

    const parent = brush.root.parent;
    if (parent == null) {
      this.brushLocalQuaternion.copy(this.brushWorldQuaternion);
    } else {
      parent.getWorldQuaternion(this.parentWorldQuaternion);
      this.brushLocalQuaternion.copy(this.parentWorldQuaternion).invert().multiply(this.brushWorldQuaternion);
    }
    brush.root.quaternion.copy(this.brushLocalQuaternion);
    brush.root.updateWorldMatrix(true, false);
    brush.root.getWorldScale(this.brushWorldScale);
    this.tipOffsetWorld
      .copy(brush.tipOffset)
      .multiply(this.brushWorldScale)
      .applyQuaternion(this.brushWorldQuaternion);
    this.desiredRootWorld.copy(this.desiredTipWorld).sub(this.tipOffsetWorld);
    if (parent != null) parent.worldToLocal(this.desiredRootWorld);
    brush.root.position.copy(this.desiredRootWorld);
    brush.root.updateMatrixWorld(true);
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

  private registerBrush(entity: Entity): void {
    if (this.brushes.has(entity)) return;
    const root = entity.object3D;
    if (root == null) return;
    const authoredShape = entity.getValue(PaintBrush, 'shape') ?? 0;
    const tip = root.getObjectByName('BrushTip');
    const tipOffset = new Vector3();
    root.updateWorldMatrix(true, true);
    if (tip != null) {
      tip.getWorldPosition(tipOffset);
      root.worldToLocal(tipOffset);
    }
    const registration: RegisteredPaintBrush = {
      entity,
      root,
      tip,
      shape: Math.max(0, Math.min(2, authoredShape)),
      homeX: Math.abs(root.position.x),
      homePosition: root.position.clone(),
      homeQuaternion: root.quaternion.clone(),
      tipOffset,
      desktopRayOrigin: new Vector3(),
      desktopRayDirection: new Vector3(),
      hasDesktopRay: false,
      resetOnRelease: false,
    };
    root.traverse((object) => {
      if (!(object instanceof Mesh) || !object.name.startsWith('Bristle-')) return;
      if (registration.bristleMaterial == null) {
        registration.bristleMaterial = (object.material as MeshStandardMaterial).clone();
        registration.bristleMaterial.color.copy(this.brushPaintColor);
      }
      object.material = registration.bristleMaterial;
    });
    this.bindDesktopBrush(registration);
    this.brushes.set(entity, registration);
    this.placeBrush(registration);
  }

  private unregisterBrush(entity: Entity): void {
    const registration = this.brushes.get(entity);
    if (registration == null) return;
    this.releaseDesktopBrush(registration);
    this.unbindDesktopBrush(registration);
    this.heldBrushes.delete(entity);
    this.desktopHeldBrushes.delete(entity);
    if (this.activeBrush === registration) {
      this.finishReleasedContacts();
      this.activeBrush = undefined;
      this.hasLastTip = false;
      this.selectNextHeldBrush();
    }
    registration.bristleMaterial?.dispose();
    this.brushes.delete(entity);
    this.updateDesktopBrushState();
  }

  private activateBrush(entity: Entity, desktop: boolean): void {
    if (desktop) {
      this.desktopHeldBrushes.add(entity);
      this.desktopBrushHeld = true;
    } else {
      this.heldBrushes.add(entity);
    }
    let registration = this.brushes.get(entity);
    if (registration == null) {
      this.registerBrush(entity);
      registration = this.brushes.get(entity);
    }
    if (registration == null) return;
    if (desktop) this.desktopBrushShape = registration.shape;
    if (this.activeBrush !== registration) this.endAllContacts();
    this.activeBrush = registration;
    this.hasLastTip = false;
    registration.bristleMaterial?.color.copy(this.brushPaintColor);
    this.overlay?.setBrushShape(registration.shape, true);
    this.updateDesktopBrushState();
  }

  private deactivateBrush(entity: Entity, desktop: boolean): void {
    if (desktop) this.desktopHeldBrushes.delete(entity);
    else this.heldBrushes.delete(entity);
    const registration = this.brushes.get(entity);
    if (registration == null) return;
    if (desktop) registration.resetOnRelease = true;
    this.desktopBrushHeld = this.desktopHeldBrushes.size > 0;
    this.updateDesktopBrushState();
    if (this.isHeld(entity)) return;
    if (registration.resetOnRelease) {
      this.placeBrush(registration, true);
      registration.resetOnRelease = false;
    }
    if (this.activeBrush !== registration) return;
    this.finishReleasedContacts();
    this.activeBrush = undefined;
    this.hasLastTip = false;
    this.selectNextHeldBrush();
    this.updateDesktopBrushState();
  }

  private disposeBrushes(): void {
    this.endAllContacts();
    this.releaseAllDesktopBrushes();
    for (const registration of this.brushes.values()) {
      this.unbindDesktopBrush(registration);
      registration.bristleMaterial?.dispose();
    }
    this.brushes.clear();
    this.heldBrushes.clear();
    this.desktopHeldBrushes.clear();
    this.activeBrush = undefined;
  }

  private bindDesktopBrush(brush: RegisteredPaintBrush): void {
    brush.pointerDown = (event): void => {
      if (event.pointerType !== 'screen-mouse' || event.button !== 0 || brush.desktopPointerId != null) return;
      brush.desktopPointerId = event.pointerId;
      this.captureDesktopRay(brush, event);
      if (!brush.root.hasPointerCapture(event.pointerId)) brush.root.setPointerCapture(event.pointerId);
      if (!brush.entity.hasComponent(DesktopBrushHeld)) brush.entity.addComponent(DesktopBrushHeld);
    };
    brush.pointerMove = (event): void => {
      if (event.pointerType !== 'screen-mouse' || event.pointerId !== brush.desktopPointerId) return;
      this.captureDesktopRay(brush, event);
    };
    brush.pointerUp = (event): void => {
      if (event.pointerType !== 'screen-mouse' || event.pointerId !== brush.desktopPointerId) return;
      this.captureDesktopRay(brush, event);
      this.releaseDesktopBrush(brush);
    };
    brush.pointerCancel = (event): void => {
      if (event.pointerType !== 'screen-mouse' || event.pointerId !== brush.desktopPointerId) return;
      this.releaseDesktopBrush(brush);
    };
    brush.root.addEventListener('pointerdown', brush.pointerDown);
    brush.root.addEventListener('pointermove', brush.pointerMove);
    brush.root.addEventListener('pointerup', brush.pointerUp);
    brush.root.addEventListener('pointercancel', brush.pointerCancel);
  }

  private unbindDesktopBrush(brush: RegisteredPaintBrush): void {
    if (brush.pointerDown != null) brush.root.removeEventListener('pointerdown', brush.pointerDown);
    if (brush.pointerMove != null) brush.root.removeEventListener('pointermove', brush.pointerMove);
    if (brush.pointerUp != null) brush.root.removeEventListener('pointerup', brush.pointerUp);
    if (brush.pointerCancel != null) brush.root.removeEventListener('pointercancel', brush.pointerCancel);
  }

  private captureDesktopRay(
    brush: RegisteredPaintBrush,
    event: Object3DEventMap['pointermove'] | Object3DEventMap['pointerdown'] | Object3DEventMap['pointerup'],
  ): void {
    brush.desktopRayOrigin.copy(event.ray.origin);
    brush.desktopRayDirection.copy(event.ray.direction).normalize();
    brush.hasDesktopRay = true;
  }

  private releaseDesktopBrush(brush: RegisteredPaintBrush): void {
    const pointerId = brush.desktopPointerId;
    if (pointerId != null && brush.root.hasPointerCapture(pointerId)) brush.root.releasePointerCapture(pointerId);
    brush.desktopPointerId = undefined;
    brush.hasDesktopRay = false;
    if (brush.entity.hasComponent(DesktopBrushHeld)) brush.entity.removeComponent(DesktopBrushHeld);
  }

  private releaseAllDesktopBrushes(): void {
    for (const brush of this.brushes.values()) this.releaseDesktopBrush(brush);
  }

  private isHeld(entity: Entity): boolean {
    return this.heldBrushes.has(entity) || this.desktopHeldBrushes.has(entity);
  }

  private selectNextHeldBrush(): void {
    const entity = this.desktopHeldBrushes.values().next().value ?? this.heldBrushes.values().next().value;
    if (entity == null) return;
    const registration = this.brushes.get(entity);
    if (registration == null) return;
    this.activeBrush = registration;
    this.hasLastTip = false;
    registration.bristleMaterial?.color.copy(this.brushPaintColor);
    this.overlay?.setBrushShape(registration.shape, true);
  }

  private updateDesktopBrushState(): void {
    const session = this.queries.sessions.entities.values().next().value;
    if (session == null) return;
    session.setValue(PaintStudioState, 'desktopBrushHeld', this.desktopBrushHeld);
    session.setValue(PaintStudioState, 'desktopBrushShape', this.desktopBrushShape);
    this.overlay?.setSpatialBrushState(this.activeBrush != null, this.activeBrush?.shape ?? this.desktopBrushShape);
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
    this.storageText = this.panel.requireElementById<UIKit.Text>('StorageText');
    this.guideText = this.panel.requireElementById<UIKit.Text>('GuideText');
    this.traceText = this.panel.requireElementById<UIKit.Text>('TraceText');
    this.performanceText = this.panel.requireElementById<UIKit.Text>('PerfText');
    this.layoutText = this.panel.requireElementById<UIKit.Text>('LayoutText');
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
      ['Btn_Stabilize', () => this.overlay?.cycleStabilization()],
      ['Btn_Dry', () => this.overlay?.toggleDryBrush()],
      ['Btn_Mix', () => this.overlay?.mixWithPrevious()],
      ['Btn_Clean', () => this.overlay?.cleanBrush()],
      ['Btn_ResetMix', () => this.overlay?.resetPalette()],
      ['Btn_Undo', () => this.overlay?.undo()],
      ['Btn_Redo', () => this.overlay?.redo()],
      ['Btn_Clear', () => this.overlay?.clear()],
      ['Btn_Save', () => this.overlay?.save()],
      ['Btn_Export', () => this.overlay?.exportPng()],
      ['Btn_Trace', () => this.overlay?.cycleReferenceOpacity()],
      ['Btn_Guide', () => this.overlay?.restartGuide()],
      ['Btn_Height', () => this.overlay?.cycleEaselHeight()],
      ['Btn_Distance', () => this.overlay?.cycleEaselDistance()],
      ['Btn_Handedness', () => this.overlay?.toggleHandedness()],
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
      session.setValue(PaintStudioState, 'redoCount', state.redoCount);
      session.setValue(PaintStudioState, 'mode', state.hasReference ? 1 : 0);
      session.setValue(PaintStudioState, 'hasReference', state.hasReference);
      session.setValue(PaintStudioState, 'referenceOpacity', state.referenceOpacity);
      session.setValue(PaintStudioState, 'savedCount', state.savedCount);
      session.setValue(PaintStudioState, 'galleryCount', state.galleryCount);
      session.setValue(PaintStudioState, 'storageReady', state.storageReady);
      session.setValue(PaintStudioState, 'autosavePending', state.autosavePending);
      session.setValue(PaintStudioState, 'dirty', state.dirty);
      session.setValue(PaintStudioState, 'stabilization', state.stabilization);
      session.setValue(PaintStudioState, 'dryBrush', state.dryBrush);
      session.setValue(PaintStudioState, 'guidedStep', state.guidedStep);
      session.setValue(PaintStudioState, 'desktopBrushHeld', this.desktopBrushHeld);
      session.setValue(PaintStudioState, 'desktopBrushShape', this.desktopBrushShape);
    }
    const colorNames = ['CRIMSON', 'YELLOW', 'BLUE', 'WHITE', 'BLACK', 'GREEN'];
    this.statusText?.setProperties({ text: state.status.toUpperCase() });
    this.colorText?.setProperties({ text: colorNames[state.selectedColor] });
    this.brushText?.setProperties({ text: ['FINE', 'MEDIUM', 'BROAD'][state.brushSize - 1] });
    this.shapeText?.setProperties({ text: `${['ROUND', 'FLAT', 'FAN'][state.brushShape]} BRUSH` });
    this.loadText?.setProperties({ text: `LOAD ${state.paintLoad}%` });
    this.blendText?.setProperties({ text: `BLENDING ${state.wetness}%` });
    this.brushPaintColor.set(state.paintColor).lerp(this.dryBristleColor, 1 - state.paintLoad / 100);
    this.activeBrush?.bristleMaterial?.color.copy(this.brushPaintColor);
    this.historyText?.setProperties({ text: `${state.strokeCount} STROKES / ${state.undoCount} UNDO / ${state.redoCount} REDO` });
    this.storageText?.setProperties({
      text: state.storageReady
        ? `${state.autosavePending ? 'AUTOSAVE PENDING' : state.dirty ? 'UNSAVED CHANGES' : 'SAVED LOCALLY'} / ${state.galleryCount} PROJECTS`
        : 'LOCAL STORAGE UNAVAILABLE',
    });
    this.guideText?.setProperties({
      text: [
        'STEP 1: LOAD PAINT FROM THE PALETTE',
        'STEP 2: TOUCH THE BRUSH TO THE CANVAS',
        'EXERCISE COMPLETE: MIX A HIGHLIGHT',
      ][state.guidedStep],
    });
    this.traceText?.setProperties({ text: state.hasReference ? `TRACE ${state.referenceOpacity}%` : 'NO REFERENCE' });
  }

  private endAllContacts(): void {
    this.overlay?.cancelContacts();
    this.brushContact = false;
    this.paletteContact = false;
  }

  private finishReleasedContacts(): void {
    if (this.brushContact) this.overlay?.endSpatialStroke();
    if (this.paletteContact) this.overlay?.endPaletteContact();
    this.brushContact = false;
    this.paletteContact = false;
  }

  private updatePerformance(delta: number): void {
    this.performanceTime += delta;
    this.performanceFrames += 1;
    if (this.performanceTime < 0.5) return;
    const frameMilliseconds = this.performanceFrames > 0
      ? (this.performanceTime / this.performanceFrames) * 1000
      : 0;
    this.overlay?.setPerformance(frameMilliseconds);
    this.performanceText?.setProperties({ text: `FRAME ${frameMilliseconds.toFixed(1)} MS / 900 X 675` });
    this.performanceTime = 0;
    this.performanceFrames = 0;
  }

  private pulseContactHaptics(): void {
    const session = this.world.renderer.xr.getSession();
    if (session == null) return;
    for (const source of session.inputSources) {
      const gamepad = source.gamepad as unknown as HapticGamepad | undefined;
      const actuator = gamepad?.hapticActuators?.[0] ?? gamepad?.vibrationActuator;
      if (actuator?.pulse != null) void actuator.pulse(0.22, 24).catch(() => undefined);
      else if (actuator?.playEffect != null) {
        void actuator.playEffect('dual-rumble', {
          duration: 24,
          strongMagnitude: 0.12,
          weakMagnitude: 0.28,
          startDelay: 0,
        }).catch(() => undefined);
      }
    }
  }

  private cycleEaselHeight(): string {
    this.easelHeightIndex = (this.easelHeightIndex + 1) % 3;
    this.applyStudioPlacement();
    return `EASEL HEIGHT: ${['SEATED', 'STANDARD', 'STANDING'][this.easelHeightIndex]}`;
  }

  private cycleEaselDistance(): string {
    this.easelDistanceIndex = (this.easelDistanceIndex + 1) % 3;
    this.applyStudioPlacement();
    return `EASEL DISTANCE: ${['CLOSE', 'STANDARD', 'FAR'][this.easelDistanceIndex]}`;
  }

  private toggleHandedness(): string {
    this.leftHanded = !this.leftHanded;
    this.applyStudioPlacement();
    return `LAYOUT: ${this.leftHanded ? 'LEFT' : 'RIGHT'} HANDED`;
  }

  private applyStudioPlacement(): void {
    const heights = [-0.14, 0, 0.16] as const;
    const distances = [-1.08, -1.28, -1.48] as const;
    if (this.easelRoot != null) {
      this.easelRoot.position.y = heights[this.easelHeightIndex];
      this.easelRoot.position.z = distances[this.easelDistanceIndex];
    }
    if (this.cartRoot != null) {
      this.cartRoot.position.x = this.leftHanded ? -0.86 : 0.86;
      this.cartRoot.rotation.y = (this.leftHanded ? 12 : -12) * Math.PI / 180;
    }
    for (const brush of this.brushes.values()) {
      if (brush !== this.activeBrush) this.placeBrush(brush);
    }
    if (this.panel != null) {
      this.panel.position.x = this.leftHanded ? 0.78 : -0.78;
      this.panel.rotation.y = (this.leftHanded ? -8 : 8) * Math.PI / 180;
    }
    const session = this.queries.sessions.entities.values().next().value;
    if (session != null) {
      session.setValue(PaintStudioState, 'easelHeight', this.easelHeightIndex);
      session.setValue(PaintStudioState, 'easelDistance', this.easelDistanceIndex);
      session.setValue(PaintStudioState, 'leftHanded', this.leftHanded);
    }
    this.layoutText?.setProperties({
      text: `${this.leftHanded ? 'LEFT' : 'RIGHT'} HAND / ${['SEATED', 'STANDARD', 'STANDING'][this.easelHeightIndex]} / ${['CLOSE', 'STANDARD', 'FAR'][this.easelDistanceIndex]}`,
    });
  }

  private placeBrush(brush: RegisteredPaintBrush, restorePose = false): void {
    if (restorePose) {
      brush.root.position.copy(brush.homePosition);
      brush.root.quaternion.copy(brush.homeQuaternion);
    }
    brush.root.position.x = (this.leftHanded ? -1 : 1) * brush.homeX;
    brush.root.updateMatrixWorld(true);
  }
}
