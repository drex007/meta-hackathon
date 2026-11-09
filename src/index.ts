import { World } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { HeartGuardSystem } from './game/heart-guard-system.js';
import './style.css';

void World.create(
  document.getElementById('scene-container') as HTMLDivElement,
  projectOptions,
).then((world) => {
  world.registerSystem(HeartGuardSystem);
});
