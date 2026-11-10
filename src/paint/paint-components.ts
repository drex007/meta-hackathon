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
  savedCount: { type: Types.Int16, default: 0 },
  galleryCount: { type: Types.Int16, default: 0 },
  storageReady: { type: Types.Boolean, default: false },
  autosavePending: { type: Types.Boolean, default: false },
});

export const PaintAction = createComponent('PaintAction', {
  action: { type: Types.Int8, default: 0 },
  value: { type: Types.Int8, default: 0 },
});
