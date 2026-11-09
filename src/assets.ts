import { AssetType, defineAssets } from '@iwsdk/core';
import {
  createBootBrute,
  createDustBunny,
  createHeartHealthToken,
  createPaperPlane,
  createPlushHeart,
  createToyBarricade,
  createToyBomb,
  createToyTable,
} from './scene-assets/heart-guard.scene-asset.js';

export default defineAssets({
  'heart-guard-panel': {
    type: AssetType.UIKitML,
    url: `${import.meta.env.BASE_URL}ui/heart-guard-panel.uikitml`,
  },
  'plush-heart': createPlushHeart(),
  'toy-table': createToyTable(),
  'dust-bunny': createDustBunny(),
  'boot-brute': createBootBrute(),
  'paper-plane': createPaperPlane(),
  'toy-barricade': createToyBarricade(),
  'toy-bomb': createToyBomb(),
  'health-token': createHeartHealthToken(),
});
