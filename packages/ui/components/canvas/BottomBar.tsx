'use client';

import { clampZoom } from '../../lib/canvas/coordinates';

const ZOOM_STEP = 0.1;

interface Props {
  zoom: number;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  /** Called with a new zoom value (decimal, e.g. 1.0 = 100%). */
  onZoomChange: (zoom: number) => void;
}

/**
 * Floating bottom-left bar with undo/redo buttons and −/+ zoom controls.
 * Each step changes zoom by 10 percentage points.
 */
export default function BottomBar({
  zoom,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onZoomChange,
}: Props) {
  const zoomPct = Math.round(zoom * 100);
  const canZoomOut = zoom > clampZoom(zoom - ZOOM_STEP + 0.001);
  const canZoomIn = zoom < clampZoom(zoom + ZOOM_STEP - 0.001);

  const btnClass =
    'w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-zinc-200 shadow-sm text-zinc-600 hover:bg-zinc-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors';

  return (
    <div className="absolute bottom-3 left-3 z-10 flex items-center gap-1 pointer-events-auto">
      <button
        onClick={onUndo}
        disabled={!canUndo}
        title="Undo (⌘Z)"
        className={btnClass}
      >
        <svg
          viewBox="0 0 16 16"
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 7.5C3 5 5 3 8 3c3 0 5 2 5 4.5S11 12 8 12" />
          <polyline points="3,4.5 3,7.5 6,7.5" />
        </svg>
      </button>

      <button
        onClick={onRedo}
        disabled={!canRedo}
        title="Redo (⌘⇧Z)"
        className={btnClass}
      >
        <svg
          viewBox="0 0 16 16"
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M13 7.5C13 5 11 3 8 3 5 3 3 5 3 7.5S5 12 8 12" />
          <polyline points="13,4.5 13,7.5 10,7.5" />
        </svg>
      </button>

      <div className="w-px h-5 bg-zinc-200 mx-0.5" />

      <button
        onClick={() => onZoomChange(clampZoom(zoom - ZOOM_STEP))}
        disabled={!canZoomOut}
        title="Zoom out"
        className={btnClass}
      >
        <svg
          viewBox="0 0 16 16"
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        >
          <line x1="4" y1="8" x2="12" y2="8" />
        </svg>
      </button>

      <span className="h-8 px-2 flex items-center text-sm bg-white border border-zinc-200 shadow-sm rounded-lg text-zinc-700 tabular-nums min-w-14 justify-center select-none">
        {zoomPct}%
      </span>

      <button
        onClick={() => onZoomChange(clampZoom(zoom + ZOOM_STEP))}
        disabled={!canZoomIn}
        title="Zoom in"
        className={btnClass}
      >
        <svg
          viewBox="0 0 16 16"
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        >
          <line x1="8" y1="4" x2="8" y2="12" />
          <line x1="4" y1="8" x2="12" y2="8" />
        </svg>
      </button>
    </div>
  );
}
