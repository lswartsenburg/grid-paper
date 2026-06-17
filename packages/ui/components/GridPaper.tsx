'use client';

import { useState, useEffect } from 'react';
import CanvasEditor from './canvas/CanvasEditor';
import {
  getDefaultAdapter,
  loadInitialDocument,
} from '../lib/storage/useStorageAdapter';
import type { StorageAdapter } from '../lib/storage/StorageAdapter';
import type { DrawingDocument } from '../types/canvas';

/**
 * The primary embeddable component for the grid-paper npm package.
 *
 * Drop this into any React app to get a full-featured graph-paper drawing
 * canvas — tools, layers, YAML editor, pan/zoom — as a self-contained unit.
 *
 * @example
 * ```tsx
 * import { GridPaper } from '@grid-paper/ui';
 * import '@grid-paper/ui/style.css';
 *
 * export default function App() {
 *   return <GridPaper className="w-full h-screen" />;
 * }
 * ```
 */
export interface GridPaperProps {
  /**
   * Storage backend to use. Defaults to the built-in `IndexedDBAdapter`.
   * Swap this for an API-backed adapter when a backend is available.
   */
  adapter?: StorageAdapter;

  /**
   * ID of the document to open. When omitted the most recently modified
   * document is loaded; a blank document is created when none exist yet.
   */
  documentId?: string;

  /**
   * Called whenever the document changes (shape drawn, layer edited, etc.).
   * Use this when you need to react to changes from outside the component.
   * Persistence is handled automatically by the `adapter`.
   */
  onDocumentChange?: (doc: DrawingDocument) => void;

  /**
   * When true, the canvas is rendered in view-only mode: the toolbar is hidden,
   * drawing tools are disabled, and the default interaction is pan/zoom only.
   * Useful for embedded previews and public share pages.
   */
  readOnly?: boolean;

  /** Additional CSS class names applied to the root element. */
  className?: string;
}

/**
 * Self-contained graph-paper drawing canvas.
 * Resolves the initial document asynchronously, then mounts `CanvasEditor`.
 */
export default function GridPaper({
  adapter,
  documentId,
  readOnly,
  className,
}: GridPaperProps) {
  const resolvedAdapter = adapter ?? getDefaultAdapter();
  const [initialDoc, setInitialDoc] = useState<DrawingDocument | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadInitialDocument(resolvedAdapter, documentId).then((doc) => {
      if (!cancelled) setInitialDoc(doc);
    });
    // Cancel a stale load when React StrictMode unmounts and remounts this
    // effect so the first (cancelled) call never calls setInitialDoc.
    return () => {
      cancelled = true;
    };
    // Re-run only when the adapter instance or target document id changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedAdapter, documentId]);

  const rootClass = `flex overflow-hidden${className ? ` ${className}` : ''}`;

  if (!initialDoc) {
    return (
      <div className={`${rootClass} items-center justify-center`}>
        <span className="text-sm text-zinc-400">Loading…</span>
      </div>
    );
  }

  return (
    <div className={rootClass}>
      <CanvasEditor
        initialDoc={initialDoc}
        adapter={resolvedAdapter}
        readOnly={readOnly}
      />
    </div>
  );
}
