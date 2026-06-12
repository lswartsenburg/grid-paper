import type { DrawingDocument } from '../../types/canvas';

/**
 * Lightweight document metadata returned by `list()`.
 * Contains only the fields needed to render a document picker — no shapes.
 */
export interface DocumentSummary {
  id: string;
  title: string;
  updatedAt: string;
}

/**
 * Persistence interface for drawing documents.
 *
 * The default implementation is `IndexedDBAdapter`. Swap it for an
 * API-backed class when a backend is available — `CanvasEditor` and
 * `GridPaper` accept any object that satisfies this interface.
 *
 * ID assignment is the caller's responsibility: every `DrawingDocument`
 * already carries a UUID (from `createDocument()`). A server-side adapter
 * may re-assign the id on first save and return the updated document.
 */
export interface StorageAdapter {
  /**
   * Persist a document (insert or replace by `doc.id`).
   * Called automatically on every document change via `useStorageAdapter`.
   */
  save(doc: DrawingDocument): Promise<void>;

  /**
   * Load a single document by id.
   * Returns `null` when no document with that id exists.
   */
  load(id: string): Promise<DrawingDocument | null>;

  /**
   * Return lightweight metadata for every stored document,
   * sorted by most-recently-modified first.
   */
  list(): Promise<DocumentSummary[]>;

  /** Permanently remove a document by id. */
  delete(id: string): Promise<void>;
}
