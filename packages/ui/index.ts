/**
 * @grid-paper/ui — embeddable graph-paper drawing canvas.
 *
 * @example
 * ```tsx
 * import GridPaper from '@grid-paper/ui';
 * import '@grid-paper/ui/style.css'; // when build step is configured
 *
 * export default function App() {
 *   return <GridPaper className="w-full h-screen" />;
 * }
 * ```
 */

// Main embeddable component
export { default, default as GridPaper } from './components/GridPaper';
export type { GridPaperProps } from './components/GridPaper';

// Lower-level shell for consumers who want to build their own UI around the canvas
export { default as CanvasEditor } from './components/canvas/CanvasEditor';

// All public types
export type * from './types';

// State management hooks — for advanced consumers building custom shells
export { useDrawingState, createDocument } from './lib/drawing/useDrawingState';
export type { DrawingAction } from './lib/drawing/useDrawingState';

// Storage — adapter interface + default IndexedDB implementation
export type { StorageAdapter, DocumentSummary } from './lib/storage/StorageAdapter';
export { IndexedDBAdapter, getDefaultAdapter, loadInitialDocument, useStorageAdapter } from './lib/storage/useStorageAdapter';
