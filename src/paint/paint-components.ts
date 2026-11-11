import { createComponent, Types } from '@iwsdk/core';

export const PaintStudioState = createComponent('PaintStudioState', {
  selectedColor: { type: Types.Int8, default: 0 },
  brushSize: { type: Types.Int8, default: 2 },
  brushShape: { type: Types.Int8, default: 0 },
  paintLoad: { type: Types.Int8, default: 100 },
  wetness: { type: Types.Int8, default: 78 },
  paletteMixCount: { type: Types.Int16, default: 0 },
  paletteContact: { type: Types.Boolean, default: false },
  strokeCount: { type: Types.Int32, default: 0 },
  undoCount: { type: Types.Int16, default: 0 },
  redoCount: { type: Types.Int16, default: 0 },
  mode: { type: Types.Int8, default: 0 },
  hasReference: { type: Types.Boolean, default: false },
  referenceOpacity: { type: Types.Int8, default: 32 },
  savedCount: { type: Types.Int16, default: 0 },
  galleryCount: { type: Types.Int16, default: 0 },
  storageReady: { type: Types.Boolean, default: false },
  autosavePending: { type: Types.Boolean, default: false },
  dirty: { type: Types.Boolean, default: false },
  stabilization: { type: Types.Int8, default: 28 },
  dryBrush: { type: Types.Boolean, default: false },
  guidedStep: { type: Types.Int8, default: 0 },
  easelHeight: { type: Types.Int8, default: 1 },
  easelDistance: { type: Types.Int8, default: 1 },
  leftHanded: { type: Types.Boolean, default: false },
  desktopBrushHeld: { type: Types.Boolean, default: false },
  desktopBrushShape: { type: Types.Int8, default: 0 },
});

export const PaintAction = createComponent('PaintAction', {
  action: { type: Types.Int8, default: 0 },
  value: { type: Types.Int8, default: 0 },
});

export const PaintBrush = createComponent('PaintBrush', {
  shape: { type: Types.Int8, default: 0 },
});

/** App-owned transient tag for a brush held by the browser mouse. */
export const DesktopBrushHeld = createComponent('DesktopBrushHeld', {});
