'use client';

import { useState, useEffect } from 'react';
import type { VectorShape } from '../../types/canvas';
import type { DrawingAction } from '../../lib/drawing/useDrawingState';

interface Props {
  shape: VectorShape | null;
  layerId: string | null;
  dispatch: React.Dispatch<DrawingAction>;
  /** Keys already claimed by other shapes — used to block duplicates. */
  existingKeys?: Set<string>;
}

type StylePatch = Partial<Pick<VectorShape, 'strokeColor' | 'strokeWidth'>> & {
  fillColor?: string;
};

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5">
      <span className="w-16 shrink-0 text-xs text-zinc-400">{label}</span>
      {children}
    </div>
  );
}

/**
 * A fixed-size color swatch that opens the native color picker on click.
 * Using a hidden overlay input avoids the inconsistent native sizing of
 * <input type="color"> across browsers and operating systems.
 */
function ColorSwatch({
  value,
  onChange,
  title,
}: {
  value: string;
  onChange: (color: string) => void;
  title?: string;
}) {
  return (
    <div
      className="relative w-7 h-7 shrink-0 rounded border border-zinc-200 overflow-hidden cursor-pointer"
      title={title}
    >
      <div
        className="absolute inset-0"
        style={{ background: value === 'transparent' ? 'white' : value }}
      />
      {/* Checkerboard pattern shown behind transparent swatches */}
      {value === 'transparent' && (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'repeating-conic-gradient(#d1d5db 0% 25%, white 0% 50%)',
            backgroundSize: '8px 8px',
          }}
        />
      )}
      <input
        type="color"
        value={value === 'transparent' ? '#ffffff' : value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        title={title}
      />
    </div>
  );
}

/**
 * Displays and edits stroke/fill properties of the currently selected shape.
 * Dispatches `UPDATE_SHAPE_STYLE` on every change.
 */
export default function PropertiesPanel({
  shape,
  layerId,
  dispatch,
  existingKeys,
}: Props) {
  // Local draft for the key field — dispatches only on commit (blur / Enter)
  // to keep the undo history clean.
  const [keyDraft, setKeyDraft] = useState(shape?.key ?? '');
  const [keyError, setKeyError] = useState<string | null>(null);

  // Reset draft and error whenever the selected shape changes.
  useEffect(() => {
    setKeyDraft(shape?.key ?? '');
    setKeyError(null);
  }, [shape?.id, shape?.key]);

  if (!shape || !layerId) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center p-4">
        <p className="text-xs text-zinc-400 text-center">
          Select a shape to edit its properties.
        </p>
      </div>
    );
  }

  function update(patch: StylePatch) {
    dispatch({
      type: 'UPDATE_SHAPE_STYLE',
      layerId: layerId!,
      shapeId: shape!.id,
      patch,
    });
  }

  function commitKey(value: string) {
    const trimmed = value.trim();
    // Only dispatch if the value actually changed.
    if (trimmed === (shape!.key ?? '')) return;
    if (trimmed !== '' && existingKeys?.has(trimmed)) {
      setKeyError(`"${trimmed}" is already used`);
      return;
    }
    setKeyError(null);
    dispatch({
      type: 'UPDATE_SHAPE_KEY',
      layerId: layerId!,
      shapeId: shape!.id,
      key: trimmed === '' ? undefined : trimmed,
    });
  }

  const hasFill = shape.type === 'circle' || shape.type === 'rect';

  return (
    <div className="flex flex-col flex-1 overflow-y-auto py-2">
      <div className="px-3 pb-2 text-xs text-zinc-400 uppercase tracking-wide font-semibold">
        {shape.type}
      </div>

      <Row label="Key">
        <div className="flex flex-col gap-0.5 flex-1 min-w-0">
          <input
            type="text"
            value={keyDraft}
            placeholder="none"
            onChange={(e) => {
              setKeyDraft(e.target.value);
              setKeyError(null);
            }}
            onBlur={(e) => commitKey(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                commitKey((e.target as HTMLInputElement).value);
                (e.target as HTMLInputElement).blur();
              }
              if (e.key === 'Escape') {
                setKeyDraft(shape.key ?? '');
                setKeyError(null);
                (e.target as HTMLInputElement).blur();
              }
            }}
            className={`w-full text-xs border rounded px-1.5 py-1 text-zinc-700 font-mono placeholder-zinc-300 focus:outline-none focus:ring-1 ${
              keyError
                ? 'border-red-400 focus:ring-red-400'
                : 'border-zinc-200 focus:ring-blue-400'
            }`}
            title="Unique key for this shape (used in YAML and data-key attribute)"
            spellCheck={false}
          />
          {keyError && (
            <span className="text-xs text-red-500 leading-tight">
              {keyError}
            </span>
          )}
        </div>
      </Row>

      <Row label="Stroke">
        <input
          type="color"
          value={shape.strokeColor}
          onChange={(e) => update({ strokeColor: e.target.value })}
          className="w-7 h-7 rounded cursor-pointer border border-zinc-200 p-0.5 bg-white"
          title="Stroke color"
        />
        <input
          type="number"
          min={0.5}
          max={20}
          step={0.5}
          value={shape.strokeWidth}
          onChange={(e) => update({ strokeWidth: Number(e.target.value) })}
          className="w-16 text-xs border border-zinc-200 rounded px-1.5 py-1 text-zinc-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
          title="Stroke width"
        />
        <span className="text-xs text-zinc-400">px</span>
      </Row>

      {hasFill && (
        <Row label="Fill">
          <input
            type="color"
            value={
              shape.fillColor === 'transparent' ? '#ffffff' : shape.fillColor
            }
            onChange={(e) => update({ fillColor: e.target.value })}
            className="w-7 h-7 rounded cursor-pointer border border-zinc-200 p-0.5 bg-white"
            title="Fill color"
          />
          <button
            onClick={() => update({ fillColor: 'transparent' })}
            className={`text-xs px-2 py-1 rounded border transition-colors ${
              shape.fillColor === 'transparent'
                ? 'border-zinc-400 bg-zinc-100 text-zinc-700'
                : 'border-zinc-200 text-zinc-400 hover:text-zinc-700'
            }`}
          >
            None
          </button>
        </Row>
      )}
    </div>
  );
}
