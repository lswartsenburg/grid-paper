'use client';

import CanvasEditor from './canvas/CanvasEditor';
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
   * Optional initial document to pre-populate the canvas.
   * When omitted the editor starts with a blank document.
   */
  initialDocument?: DrawingDocument;

  /**
   * Called whenever the document changes (shape drawn, layer edited, etc.).
   * Use this to persist the document in your own storage layer.
   */
  onDocumentChange?: (doc: DrawingDocument) => void;

  /** Additional CSS class names applied to the root element. */
  className?: string;
}

/**
 * Self-contained graph-paper drawing canvas.
 * All state is managed internally; mount it and it just works.
 */
export default function GridPaper({ className }: GridPaperProps) {
  return (
    <div className={`flex overflow-hidden${className ? ` ${className}` : ''}`}>
      <CanvasEditor />
    </div>
  );
}
