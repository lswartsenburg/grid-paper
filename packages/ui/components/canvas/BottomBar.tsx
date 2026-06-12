'use client';

import { useState, useEffect, useRef } from 'react';
import { clampZoom } from '../../lib/canvas/coordinates';
import type { GridConfig } from '../../types/canvas';

const ZOOM_STEP = 0.1;

/** Supported real-world unit options. Empty string means "no unit assigned". */
const UNIT_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'None' },
  { value: 'mm', label: 'mm — millimeters' },
  { value: 'cm', label: 'cm — centimeters' },
  { value: 'm', label: 'm — meters' },
  { value: 'in', label: 'in — inches' },
  { value: 'ft', label: 'ft — feet' },
  { value: 'yd', label: 'yd — yards' },
];

interface Props {
  zoom: number;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  /** Called with a new zoom value (decimal, e.g. 1.0 = 100%). */
  onZoomChange: (zoom: number) => void;
  gridConfig: GridConfig;
  onGridConfigChange: (patch: Partial<GridConfig>) => void;
}

/**
 * Floating bottom-left bar with undo/redo, zoom controls, and grid settings.
 */
export default function BottomBar({
  zoom,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onZoomChange,
  gridConfig,
  onGridConfigChange,
}: Props) {
  const [gridOpen, setGridOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Close the popover on outside click.
  useEffect(() => {
    if (!gridOpen) return;
    function onMouseDown(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        !triggerRef.current?.contains(e.target as Node)
      ) {
        setGridOpen(false);
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [gridOpen]);

  const zoomPct = Math.round(zoom * 100);
  const canZoomOut = zoom > clampZoom(zoom - ZOOM_STEP + 0.001);
  const canZoomIn = zoom < clampZoom(zoom + ZOOM_STEP - 0.001);

  const btnClass =
    'w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-zinc-200 shadow-sm text-zinc-600 hover:bg-zinc-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors';

  const hasUnit = !!gridConfig.unit;

  return (
    <div className="absolute bottom-3 left-3 z-10 flex items-center gap-1 pointer-events-auto">
      {/* Undo / Redo */}
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

      {/* Zoom controls */}
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

      <div className="w-px h-5 bg-zinc-200 mx-0.5" />

      {/* Grid settings trigger */}
      <div className="relative">
        <button
          ref={triggerRef}
          onClick={() => setGridOpen((o) => !o)}
          title="Grid settings"
          className={`${btnClass} ${gridOpen ? 'bg-zinc-100' : ''}`}
        >
          {/* Grid icon */}
          <svg
            viewBox="0 0 16 16"
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <rect x="2" y="2" width="12" height="12" rx="1" />
            <line x1="6" y1="2" x2="6" y2="14" />
            <line x1="10" y1="2" x2="10" y2="14" />
            <line x1="2" y1="6" x2="14" y2="6" />
            <line x1="2" y1="10" x2="14" y2="10" />
          </svg>
        </button>

        {/* Popover */}
        {gridOpen && (
          <div
            ref={popoverRef}
            className="absolute bottom-10 left-0 w-56 bg-white border border-zinc-200 rounded-xl shadow-lg p-3 flex flex-col gap-3"
          >
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">
              Grid Settings
            </p>

            {/* Unit selector */}
            <label className="flex flex-col gap-1">
              <span className="text-xs text-zinc-500">Unit per cell</span>
              <select
                value={gridConfig.unit ?? ''}
                onChange={(e) => {
                  const val = e.target.value;
                  onGridConfigChange(
                    val === ''
                      ? { unit: undefined, cellSize: 1 }
                      : { unit: val }
                  );
                }}
                className="text-xs border border-zinc-200 rounded px-2 py-1.5 text-zinc-700 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
              >
                {UNIT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>

            {/* Cell size — only shown when a unit is selected */}
            {hasUnit && (
              <label className="flex flex-col gap-1">
                <span className="text-xs text-zinc-500">
                  Cell size ({gridConfig.unit}/cell)
                </span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0.01}
                    step={1}
                    value={gridConfig.cellSize}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (!isNaN(v) && v > 0) onGridConfigChange({ cellSize: v });
                    }}
                    className="w-20 text-xs border border-zinc-200 rounded px-2 py-1.5 text-zinc-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                  <span className="text-xs text-zinc-400">{gridConfig.unit}</span>
                </div>
              </label>
            )}

            {/* Major grid lines */}
            <label className="flex flex-col gap-1">
              <span className="text-xs text-zinc-500">Major line every</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={1}
                  max={20}
                  step={1}
                  value={gridConfig.majorEvery}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (!isNaN(v) && v >= 1) onGridConfigChange({ majorEvery: v });
                  }}
                  className="w-20 text-xs border border-zinc-200 rounded px-2 py-1.5 text-zinc-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
                <span className="text-xs text-zinc-400">cells</span>
              </div>
            </label>

            {/* Snap to grid */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={gridConfig.snapToGrid}
                onChange={(e) =>
                  onGridConfigChange({ snapToGrid: e.target.checked })
                }
                className="rounded accent-blue-500"
              />
              <span className="text-xs text-zinc-700">Snap to grid</span>
            </label>
          </div>
        )}
      </div>

      {/* Scale indicator pill — shown when a unit is assigned */}
      {hasUnit && (
        <span className="h-8 px-2.5 flex items-center text-xs bg-white border border-zinc-200 shadow-sm rounded-lg text-zinc-500 select-none whitespace-nowrap">
          1 cell = {gridConfig.cellSize} {gridConfig.unit}
        </span>
      )}
    </div>
  );
}
