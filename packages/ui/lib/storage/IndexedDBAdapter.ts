import type { DrawingDocument } from '../../types/canvas';
import type { StorageAdapter, DocumentSummary } from './StorageAdapter';

const DB_NAME = 'grid-paper';
const DB_VERSION = 1;
const STORE_NAME = 'documents';

/** Key used by the legacy localStorage adapter — checked once during migration. */
const LEGACY_STORAGE_KEY = 'grid-paper:document';

/**
 * Opens (or creates) the IndexedDB database and resolves with the connection.
 * The `documents` object store is created on first run with an `updatedAt`
 * index so `list()` can sort by recency without loading shape data.
 */
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      // Close the connection when another context (e.g. a test) requests a
      // database version upgrade or deletion, so it doesn't block indefinitely.
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * IndexedDB-backed `StorageAdapter`.
 *
 * Stores one `DrawingDocument` per record, keyed by `doc.id`.
 * On first call to `migrateLegacyLocalStorage()` it imports any document
 * written by the old single-key localStorage store, then removes that entry.
 *
 * @example
 * ```ts
 * const adapter = new IndexedDBAdapter();
 * await adapter.save(doc);
 * const loaded = await adapter.load(doc.id);
 * ```
 */
export class IndexedDBAdapter implements StorageAdapter {
  private readonly dbPromise: Promise<IDBDatabase>;

  constructor() {
    this.dbPromise =
      typeof window !== 'undefined'
        ? openDatabase()
        : Promise.reject(
            new Error('IndexedDB is not available outside a browser context')
          );
  }

  async save(doc: DrawingDocument): Promise<void> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(doc);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async load(id: string): Promise<DrawingDocument | null> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const request = db
        .transaction(STORE_NAME, 'readonly')
        .objectStore(STORE_NAME)
        .get(id);
      request.onsuccess = () =>
        resolve((request.result as DrawingDocument) ?? null);
      request.onerror = () => reject(request.error);
    });
  }

  async list(): Promise<DocumentSummary[]> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const request = db
        .transaction(STORE_NAME, 'readonly')
        .objectStore(STORE_NAME)
        .getAll();
      request.onsuccess = () => {
        const docs = request.result as DrawingDocument[];
        resolve(
          docs
            .map(({ id, title, updatedAt }) => ({ id, title, updatedAt }))
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        );
      };
      request.onerror = () => reject(request.error);
    });
  }

  async delete(id: string): Promise<void> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * One-time migration from the old single-document localStorage store.
   *
   * Reads the JSON blob written by the legacy `useStorageAdapter`, saves it
   * to IndexedDB under its existing `id`, then removes the localStorage entry
   * so the migration only runs once.
   *
   * Returns the migrated document, or `null` if nothing was found.
   */
  async migrateLegacyLocalStorage(): Promise<DrawingDocument | null> {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return null;
    try {
      const doc = JSON.parse(raw) as DrawingDocument;
      await this.save(doc);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      return doc;
    } catch {
      return null;
    }
  }
}
