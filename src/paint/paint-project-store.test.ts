import { describe, expect, it } from 'vitest';
import { isSupportedPaintProject, PAINT_PROJECT_VERSION } from './paint-project-store.js';

describe('paint project schema', () => {
  it('accepts the current version and rejects incompatible records', () => {
    const record = {
      id: 'project-1',
      name: 'Study',
      version: PAINT_PROJECT_VERSION,
      updatedAt: 1,
      colorBlob: new Blob(['color']),
      heightBlob: new Blob(['height']),
    };
    expect(isSupportedPaintProject(record)).toBe(true);
    expect(isSupportedPaintProject({ ...record, version: 2 })).toBe(false);
  });
});
