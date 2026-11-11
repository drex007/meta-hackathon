export class BoundedHistory<T> {
  private readonly undoEntries: T[] = [];
  private readonly redoEntries: T[] = [];

  constructor(private readonly limit = 8) {
    if (!Number.isInteger(limit) || limit < 1) throw new Error('History limit must be a positive integer');
  }

  get undoCount(): number {
    return this.undoEntries.length;
  }

  get redoCount(): number {
    return this.redoEntries.length;
  }

  checkpoint(snapshot: T): void {
    this.pushBounded(this.undoEntries, snapshot);
    this.redoEntries.length = 0;
  }

  undo(current: T): T | undefined {
    const previous = this.undoEntries.pop();
    if (previous == null) return undefined;
    this.pushBounded(this.redoEntries, current);
    return previous;
  }

  redo(current: T): T | undefined {
    const next = this.redoEntries.pop();
    if (next == null) return undefined;
    this.pushBounded(this.undoEntries, current);
    return next;
  }

  clear(): void {
    this.undoEntries.length = 0;
    this.redoEntries.length = 0;
  }

  private pushBounded(target: T[], snapshot: T): void {
    target.push(snapshot);
    if (target.length > this.limit) target.shift();
  }
}
