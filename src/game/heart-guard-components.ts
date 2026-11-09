import { createComponent, Types } from '@iwsdk/core';

export const HeartGuardSession = createComponent('HeartGuardSession', {
  phase: { type: Types.Int8, default: 0 },
  heartHealth: { type: Types.Int8, default: 10 },
  energy: { type: Types.Int8, default: 0 },
  score: { type: Types.Int32, default: 0 },
  kills: { type: Types.Int16, default: 0 },
  wave: { type: Types.Int8, default: 1 },
  waveTime: { type: Types.Float32, default: 40 },
  timeScale: { type: Types.Float32, default: 0.15 },
  calibratedDeadZone: { type: Types.Float32, default: 0.06 },
  calibrationTime: { type: Types.Float32, default: 3 },
  selectedAbility: { type: Types.Int8, default: 0 },
  barricadeRemaining: { type: Types.Float32, default: 0 },
  barricadeCooldown: { type: Types.Float32, default: 0 },
});

export const Invader = createComponent('Invader', {
  kind: { type: Types.Int8, default: 0 },
  health: { type: Types.Int8, default: 1 },
  maxHealth: { type: Types.Int8, default: 1 },
  speed: { type: Types.Float32, default: 0.055 },
  active: { type: Types.Boolean, default: true },
  spawnIndex: { type: Types.Int8, default: 0 },
  progress: { type: Types.Float32, default: 0 },
  hitCooldown: { type: Types.Float32, default: 0 },
});

export const AbilityButton = createComponent('AbilityButton', {
  ability: { type: Types.Int8, default: 0 },
  cost: { type: Types.Int8, default: 0 },
});

export const GameControl = createComponent('GameControl', {
  action: { type: Types.Int8, default: 0 },
});
