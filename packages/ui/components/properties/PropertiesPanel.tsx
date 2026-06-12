'use client';

import type { VectorShape } from '../../types/canvas';
import type { DrawingAction } from '../../lib/drawing/useDrawingState';

interface Props {
  shape: VectorShape | null;
  layerId: string | null;
  dispatch: React.Dispatch<DrawingAction>;
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
 * Displays and edits stroke/fill properties of the currently selected shape.
 * Dispatches `UPDATE_SHAPE_STYLE` on every change.
 */
export default function PropertiesPanel({ shape, layerId, dispatch }: Props) {
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

  const hasFill = shape.type === 'circle' || shape.type === 'rect';

  return (
    <div className="flex flex-col flex-1 overflow-y-auto py-2">
      <div className="px-3 pb-2 text-xs text-zinc-400 uppercase tracking-wide font-semibold">
        {shape.type}
      </div>

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
