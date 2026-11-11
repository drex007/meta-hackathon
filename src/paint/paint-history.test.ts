import { describe, expect, it } from 'vitest';
import { BoundedHistory } from './paint-history.js';

describe('bounded stroke history', () => {
  it('undoes and redoes one completed checkpoint at a time', () => {
    const history = new BoundedHistory<string>(3);
    history.checkpoint('blank');
    history.checkpoint('stroke-1');

    expect(history.undo('stroke-2')).toBe('stroke-1');
    expect(history.undo('stroke-1')).toBe('blank');
    expect(history.redo('blank')).toBe('stroke-1');
    expect(history.redo('stroke-1')).toBe('stroke-2');
  });

  it('bounds undo memory and invalidates redo after a new stroke', () => {
    const history = new BoundedHistory<number>(2);
    history.checkpoint(0);
    history.checkpoint(1);
    history.checkpoint(2);
    expect(history.undoCount).toBe(2);
    expect(history.undo(3)).toBe(2);
    history.checkpoint(4);
    expect(history.redoCount).toBe(0);
  });
});
