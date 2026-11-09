import { defineComponents } from '@iwsdk/core';
import {
  AbilityButton,
  GameControl,
  HeartGuardSession,
  Invader,
} from './game/heart-guard-components.js';

export default defineComponents([
  HeartGuardSession,
  Invader,
  AbilityButton,
  GameControl,
]);
