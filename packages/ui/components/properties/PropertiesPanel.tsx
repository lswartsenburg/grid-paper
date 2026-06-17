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
  /** Called when the user clicks the delete button. */
  onDelete?: () => void;
  /** Called when the user clicks the duplicate button. */
  onDuplicate?: () => void;
}

type StylePatch = Partial<
  Pick<VectorShape, 'strokeColor' | 'strokeWidth' | 'strokeDash'>
> & { fillColor?: string };

const PRESET_COLORS = [
  '#000000',
  '#495057',
  '#868e96',
  '#dee2e6',
  '#e03131',
  '#f08c00',
  '#2f9e44',
  '#1971c2',
  '#ae3ec9',
  '#e64980',
];

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

/** Three small buttons for selecting solid / dashed / dotted stroke style. */
function StrokeDashSelector({
  value,
  onChange,
}: {
  value: VectorShape['strokeDash'];
  onChange: (v: 'solid' | 'dashed' | 'dotted') => void;
}) {
  const current = value ?? 'solid';
  const options: Array<{
    id: 'solid' | 'dashed' | 'dotted';
    title: string;
    dash?: string;
  }> = [
    { id: 'solid', title: 'Solid' },
    { id: 'dashed', title: 'Dashed', dash: '5 3' },
    { id: 'dotted', title: 'Dotted', dash: '2 3' },
  ];
  return (
    <div className="flex gap-0.5">
      {options.map(({ id, title, dash }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          title={title}
          className={`w-7 h-7 flex items-center justify-center rounded border transition-colors ${
            current === id
              ? 'border-blue-400 bg-blue-50 text-blue-600'
              : 'border-zinc-200 text-zinc-500 hover:bg-zinc-50'
          }`}
        >
          <svg viewBox="0 0 20 10" width="14" height="7" fill="none">
            <line
              x1="1"
              y1="5"
              x2="19"
              y2="5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray={dash}
            />
          </svg>
        </button>
      ))}
    </div>
  );
}

/**
 * Displays and edits stroke/fill/style properties of the currently selected shape.
 * Also exposes Delete and Duplicate actions via optional callbacks.
 */
export default function PropertiesPanel({
  shape,
  layerId,
  dispatch,
  existingKeys,
  onDelete,
  onDuplicate,
}: Props) {
  // Local draft for the key field — dispatches only on commit (blur / Enter)
  // to keep the undo history clean.
  const [keyDraft, setKeyDraft] = useState(shape?.key ?? '');
  const [keyError, setKeyError] = useState<string | null>(null);
  const [labelDraft, setLabelDraft] = useState(shape?.label ?? '');

  // Reset drafts whenever the selected shape changes.
  useEffect(() => {
    setKeyDraft(shape?.key ?? '');
    setKeyError(null);
    setLabelDraft(shape?.label ?? '');
  }, [shape?.id, shape?.key, shape?.label]);

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

  function commitLabel(value: string) {
    const trimmed = value.trim();
    if (trimmed === (shape!.label ?? '')) return;
    dispatch({
      type: 'UPDATE_SHAPE_LABEL',
      layerId: layerId!,
      shapeId: shape!.id,
      label: trimmed === '' ? undefined : trimmed,
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
      {/* Header: shape type + action buttons */}
      <div className="flex items-center justify-between px-3 pb-2">
        <span className="text-xs text-zinc-400 uppercase tracking-wide font-semibold">
          {shape.type}
        </span>
        <div className="flex items-center gap-0.5">
          {onDuplicate && (
            <button
              onClick={onDuplicate}
              title="Duplicate shape"
              className="p-1 rounded hover:bg-zinc-100 text-zinc-500 hover:text-zinc-700 transition-colors"
            >
              {/* Copy icon */}
              <svg
                viewBox="0 0 16 16"
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="5" y="5" width="8" height="8" rx="1" />
                <path d="M3 11V3h8" />
              </svg>
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              title="Delete shape"
              className="p-1 rounded hover:bg-red-50 text-zinc-500 hover:text-red-500 transition-colors"
            >
              {/* Trash icon */}
              <svg
                viewBox="0 0 16 16"
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M2 4h12M5 4V3h6v1M6 7v5M10 7v5M3 4l1 9h8l1-9" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <Row label="Label">
        <input
          type="text"
          value={labelDraft}
          placeholder="none"
          onChange={(e) => setLabelDraft(e.target.value)}
          onBlur={(e) => commitLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              commitLabel((e.target as HTMLInputElement).value);
              (e.target as HTMLInputElement).blur();
            }
            if (e.key === 'Escape') {
              setLabelDraft(shape.label ?? '');
              (e.target as HTMLInputElement).blur();
            }
          }}
          className="w-full text-xs border border-zinc-200 rounded px-1.5 py-1 text-zinc-700 placeholder-zinc-300 focus:outline-none focus:ring-1 focus:ring-blue-400"
          title="Text label rendered at the center of the shape"
        />
      </Row>

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
        <ColorSwatch
          value={shape.strokeColor}
          onChange={(color) => update({ strokeColor: color })}
          title="Stroke color"
        />
        <input
          type="number"
          min={0.5}
          max={20}
          step={0.5}
          value={shape.strokeWidth}
          onChange={(e) => update({ strokeWidth: Number(e.target.value) })}
          className="w-14 text-xs border border-zinc-200 rounded px-1.5 py-1 text-zinc-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
          title="Stroke width"
        />
        <StrokeDashSelector
          value={shape.strokeDash}
          onChange={(v) => update({ strokeDash: v })}
        />
      </Row>

      {hasFill && (
        <Row label="Fill">
          <ColorSwatch
            value={shape.fillColor}
            onChange={(color) => update({ fillColor: color })}
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

      {/* Preset color swatches — click to set stroke color */}
      <div className="px-3 pt-1 pb-1">
        <div className="flex flex-wrap gap-1">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => update({ strokeColor: c })}
              title={c}
              className={`w-5 h-5 rounded border cursor-pointer transition-transform hover:scale-110 ${
                shape.strokeColor === c
                  ? 'border-blue-400 ring-1 ring-blue-300'
                  : 'border-zinc-200'
              }`}
              style={{ background: c }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
