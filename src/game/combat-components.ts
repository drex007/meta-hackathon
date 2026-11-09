import { createComponent, Types } from '@iwsdk/core';

export const CombatTarget = createComponent('CombatTarget', {
  health: { type: Types.Int16, default: 3 },
  maxHealth: { type: Types.Int16, default: 3 },
  scoreValue: { type: Types.Int16, default: 100 },
  active: { type: Types.Boolean, default: true },
});

export const CombatSession = createComponent('CombatSession', {
  score: { type: Types.Int32, default: 0 },
  kills: { type: Types.Int16, default: 0 },
  wave: { type: Types.Int8, default: 1 },
  roundsFired: { type: Types.Int16, default: 0 },
});

export const BirdFlight = createComponent('BirdFlight', {
  lane: { type: Types.Int8, default: 0 },
  speed: { type: Types.Float32, default: 1 },
  phase: { type: Types.Float32, default: 0 },
  wingRate: { type: Types.Float32, default: 6 },
});
