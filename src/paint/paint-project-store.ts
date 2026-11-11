export const PAINT_PROJECT_VERSION = 1 as const;

export interface PaintProjectRecord {
  id: string;
  version: typeof PAINT_PROJECT_VERSION;
  name: string;
  createdAt: number;
  updatedAt: number;
  width: number;
  height: number;
  colorBlob: Blob;
  heightBlob: Blob;
  thumbnailBlob: Blob;
  referenceDataUrl: string;
  referenceOpacity: number;
  strokeCount: number;
  selectedColor: number;
  activePaint: string;
  brushSize: number;
  brushShape: number;
  wetness: number;
  paintLoad: number;
  stabilization: number;
  dryBrush: boolean;
  variationSeed: number;
}

interface PaintSetting {
  key: string;
  value: string;
}

const DATABASE_NAME = 'canvas-atelier';
const DATABASE_VERSION = 1;
const PROJECTS_STORE = 'projects';
const SETTINGS_STORE = 'settings';
const LAST_PROJECT_KEY = 'last-project-id';

export function isSupportedPaintProject(value: unknown): value is PaintProjectRecord {
  if (value == null || typeof value !== 'object') return false;
  const candidate = value as Partial<PaintProjectRecord>;
  return candidate.version === PAINT_PROJECT_VERSION
    && typeof candidate.id === 'string'
    && typeof candidate.name === 'string'
    && typeof candidate.updatedAt === 'number'
    && candidate.colorBlob instanceof Blob
    && candidate.heightBlob instanceof Blob;
}

export class PaintProjectStore {
  private databasePromise?: Promise<IDBDatabase>;

  async ready(): Promise<void> {
    await this.database();
  }

  async save(project: PaintProjectRecord): Promise<void> {
    const database = await this.database();
    await this.writeTransaction(database, PROJECTS_STORE, (store) => store.put(project));
  }

  async load(id: string): Promise<PaintProjectRecord | undefined> {
    const database = await this.database();
    const value = await this.request<unknown>(database.transaction(PROJECTS_STORE).objectStore(PROJECTS_STORE).get(id));
    if (value == null) return undefined;
    if (!isSupportedPaintProject(value)) throw new Error('This painting uses an unsupported project version');
    return value;
  }

  async list(): Promise<PaintProjectRecord[]> {
    const database = await this.database();
    const values = await this.request<unknown[]>(database.transaction(PROJECTS_STORE).objectStore(PROJECTS_STORE).getAll());
    return values
      .filter(isSupportedPaintProject)
      .sort((first, second) => second.updatedAt - first.updatedAt);
  }

  async setLastProjectId(id: string): Promise<void> {
    const database = await this.database();
    const setting: PaintSetting = { key: LAST_PROJECT_KEY, value: id };
    await this.writeTransaction(database, SETTINGS_STORE, (store) => store.put(setting));
  }

  async getLastProjectId(): Promise<string | undefined> {
    const database = await this.database();
    const value = await this.request<PaintSetting | undefined>(
      database.transaction(SETTINGS_STORE).objectStore(SETTINGS_STORE).get(LAST_PROJECT_KEY),
    );
    return value?.value;
  }

  private database(): Promise<IDBDatabase> {
    if (this.databasePromise != null) return this.databasePromise;
    if (!('indexedDB' in globalThis)) return Promise.reject(new Error('IndexedDB is unavailable in this browser'));
    this.databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      request.addEventListener('upgradeneeded', () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(PROJECTS_STORE)) {
          const projects = database.createObjectStore(PROJECTS_STORE, { keyPath: 'id' });
          projects.createIndex('updatedAt', 'updatedAt');
        }
        if (!database.objectStoreNames.contains(SETTINGS_STORE)) {
          database.createObjectStore(SETTINGS_STORE, { keyPath: 'key' });
        }
      });
      request.addEventListener('success', () => resolve(request.result));
      request.addEventListener('error', () => reject(request.error ?? new Error('Could not open painting storage')));
      request.addEventListener('blocked', () => reject(new Error('Painting storage is blocked by another tab')));
    });
    return this.databasePromise;
  }

  private request<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      request.addEventListener('success', () => resolve(request.result));
      request.addEventListener('error', () => reject(request.error ?? new Error('Painting storage request failed')));
    });
  }

  private writeTransaction(
    database: IDBDatabase,
    storeName: string,
    mutate: (store: IDBObjectStore) => void,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, 'readwrite');
      transaction.addEventListener('complete', () => resolve());
      transaction.addEventListener('abort', () => reject(transaction.error ?? new Error('Painting storage transaction aborted')));
      transaction.addEventListener('error', () => reject(transaction.error ?? new Error('Painting storage transaction failed')));
      mutate(transaction.objectStore(storeName));
    });
  }
}
