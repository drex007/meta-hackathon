import { AssetType, defineAssets } from '@iwsdk/core';
import {
  createFanArtistBrush,
  createFlatArtistBrush,
  createPainterCart,
  createRoundArtistBrush,
  createStudioEasel,
  createStudioRoom,
} from './scene-assets/paint-studio.scene-asset.js';
import { createAlpinePaintingDeck, createAlpineVista } from './scene-assets/alpine-studio.scene-asset.js';

export default defineAssets({
  'paint-studio-panel': {
    type: AssetType.UIKitML,
    url: `${import.meta.env.BASE_URL}ui/paint-studio-panel.uikitml`,
  },
  'studio-easel': createStudioEasel(),
  'artist-brush-round': createRoundArtistBrush(),
  'artist-brush-flat': createFlatArtistBrush(),
  'artist-brush-fan': createFanArtistBrush(),
  'painter-cart': createPainterCart(),
  'studio-room': createStudioRoom(),
  'alpine-painting-deck': createAlpinePaintingDeck(),
  'alpine-vista': createAlpineVista(),
});
