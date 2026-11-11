import { defineComponents } from '@iwsdk/core';
import {
  DesktopBrushHeld,
  PaintAction,
  PaintBrush,
  PaintStudioState,
} from './paint/paint-components.js';

export default defineComponents([
  PaintStudioState,
  PaintAction,
  PaintBrush,
  DesktopBrushHeld,
]);
