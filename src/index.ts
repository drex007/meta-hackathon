import { World } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { PaintStudioSystem } from './paint/paint-studio-system.js';
import './style.css';

void World.create(
  document.getElementById('scene-container') as HTMLDivElement,
  projectOptions,
).then((world) => {
  world.registerSystem(PaintStudioSystem);
});
