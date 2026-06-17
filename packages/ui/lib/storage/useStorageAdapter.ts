'use client';

import { useEffect } from 'react';
import type { DrawingDocument } from '../../types/canvas';
import { createDocument } from '../drawing/useDrawingState';
import type { StorageAdapter } from './StorageAdapter';
import { IndexedDBAdapter } from './IndexedDBAdapter';

export type { StorageAdapter } from './StorageAdapter';
export type { DocumentSummary } from './StorageAdapter';
export { IndexedDBAdapter } from './IndexedDBAdapter';

// Module-level singleton so the app shares one database connection across
// all components regardless of how many times getDefaultAdapter() is called.
let _defaultAdapter: IndexedDBAdapter | null = null;

// Deduplicates concurrent loadInitialDocument calls (e.g. from React StrictMode's
// double-invoke of effects). Both callers receive the same Promise and therefore
// the same document, preventing two fresh docs from being created in an empty DB.
let _inflightLoad: Promise<DrawingDocument> | null = null;

/**
 * Returns the shared IndexedDB adapter instance for this page.
 * Safe to call multiple times — always returns the same object.
 */
export function getDefaultAdapter(): IndexedDBAdapter {
  if (!_defaultAdapter) _defaultAdapter = new IndexedDBAdapter();
  return _defaultAdapter;
}

/**
 * Resolves the document to load on startup:
 *
 * 1. Runs a one-time migration from the legacy localStorage store
 *    (only when `adapter` is an `IndexedDBAdapter`).
 * 2. Loads `documentId` if specified and found.
 * 3. Falls back to the most recently modified document.
 * 4. Creates and persists a fresh document when nothing is stored yet.
 *
 * @param adapter  The storage backend to query.
 * @param documentId  Optional id of a specific document to open.
 */
/**
 * Back-fills any `GridConfig` fields that were added after an older document
 * was saved. Without this, documents from before `snapToGrid`/`cellSize` were
 * introduced would render those fields as `undefined`.
 */
function normalizeDocument(doc: DrawingDocument): DrawingDocument {
  const gc = doc.gridConfig ?? {};
  return {
    ...doc,
    gridConfig: {
      majorEvery: gc.majorEvery ?? 5,
      snapToGrid: gc.snapToGrid ?? true,
      cellSize: gc.cellSize ?? 1,
      ...(gc.unit !== undefined ? { unit: gc.unit } : {}),
    },
  };
}

export function loadInitialDocument(
  adapter: StorageAdapter,
  documentId?: string
): Promise<DrawingDocument> {
  if (!_inflightLoad) {
    _inflightLoad = _doLoadInitialDocument(adapter, documentId);
    _inflightLoad.finally(() => {
      _inflightLoad = null;
    });
  }
  return _inflightLoad;
}

async function _doLoadInitialDocument(
  adapter: StorageAdapter,
  documentId?: string
): Promise<DrawingDocument> {
  if (adapter instanceof IndexedDBAdapter) {
    await adapter.migrateLegacyLocalStorage();
  }

  if (documentId) {
    const doc = await adapter.load(documentId);
    if (doc) return normalizeDocument(doc);
  }

  const summaries = await adapter.list();
  if (summaries.length > 0) {
    const doc = await adapter.load(summaries[0].id);
    if (doc) return normalizeDocument(doc);
  }

  const fresh = createDocument();
  await adapter.save(fresh);
  return fresh;
}

/**
 * Persists the document to `adapter` every time it changes.
 * Failures are silently swallowed (storage unavailable, quota exceeded, etc.).
 *
 * @param doc      The current drawing document from `useCanvasHistory`.
 * @param adapter  The storage backend to write to.
 */
export function useStorageAdapter(
  doc: DrawingDocument,
  adapter: StorageAdapter
): void {
  useEffect(() => {
    adapter.save(doc).catch(() => {});
  }, [doc, adapter]);
}
