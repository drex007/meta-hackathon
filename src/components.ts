import { defineComponents } from '@iwsdk/core';
import { PaintAction, PaintStudioState } from './paint/paint-components.js';

export default defineComponents([
  PaintStudioState,
  PaintAction,
]);
