'use client';

import type { Layer } from '../../types/canvas';
import type { DrawingAction } from '../../lib/drawing/useDrawingState';

interface Props {
  layers: Layer[];
  activeLayerId: string | null;
  onSetActive: (id: string) => void;
  dispatch: React.Dispatch<DrawingAction>;
}

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg
      viewBox="0 0 16 16"
      stroke="currentColor"
      strokeWidth="1.3"
      fill="none"
      className="w-3.5 h-3.5"
    >
      <path d="M1 8 C3 4, 13 4, 15 8 C13 12, 3 12, 1 8Z" />
      <circle cx="8" cy="8" r="2" fill="currentColor" />
    </svg>
  ) : (
    <svg
      viewBox="0 0 16 16"
      stroke="currentColor"
      strokeWidth="1.3"
      fill="none"
      className="w-3.5 h-3.5"
    >
      <path
        d="M1 8 C3 4, 13 4, 15 8 C13 12, 3 12, 1 8Z"
        strokeDasharray="2 1.5"
      />
      <line x1="3" y1="13" x2="13" y2="3" />
    </svg>
  );
}

function LockIcon({ locked }: { locked: boolean }) {
  return locked ? (
    <svg
      viewBox="0 0 16 16"
      stroke="currentColor"
      strokeWidth="1.3"
      fill="none"
      className="w-3.5 h-3.5"
    >
      <rect x="3" y="7" width="10" height="7" rx="1" />
      <path d="M5 7 V5 A3 3 0 0 1 11 5 V7" />
    </svg>
  ) : (
    <svg
      viewBox="0 0 16 16"
      stroke="currentColor"
      strokeWidth="1.3"
      fill="none"
      className="w-3.5 h-3.5"
    >
      <rect x="3" y="7" width="10" height="7" rx="1" />
      <path d="M5 7 V5 A3 3 0 0 1 11 5" />
    </svg>
  );
}

export default function LayerManager({
  layers,
  activeLayerId,
  onSetActive,
  dispatch,
}: Props) {
  function addLayer() {
    dispatch({
      type: 'ADD_LAYER',
      layer: {
        id: crypto.randomUUID(),
        name: `Layer ${layers.length + 1}`,
        visible: true,
        locked: false,
        items: [],
        annotations: [],
      },
    });
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex items-center justify-end px-3 py-1.5 border-b border-zinc-100 shrink-0">
        <button
          title="Add layer"
          onClick={addLayer}
          className="w-5 h-5 flex items-center justify-center rounded text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 text-base leading-none"
        >
          +
        </button>
      </div>

      <ol className="flex flex-col overflow-y-auto flex-1">
        {[...layers].reverse().map((layer, reversedIdx) => {
          const idx = layers.length - 1 - reversedIdx;
          const isActive = layer.id === activeLayerId;

          return (
            <li
              key={layer.id}
              onClick={() => onSetActive(layer.id)}
              className={`flex items-center gap-1.5 px-2 py-1.5 cursor-pointer select-none border-b border-zinc-50 ${
                isActive ? 'bg-zinc-100' : 'hover:bg-zinc-50'
              }`}
            >
              {/* Reorder */}
              <div className="flex flex-col gap-0.5">
                <button
                  title="Move up"
                  disabled={idx === layers.length - 1}
                  onClick={(e) => {
                    e.stopPropagation();
                    const ids = layers.map((l) => l.id);
                    [ids[idx], ids[idx + 1]] = [ids[idx + 1], ids[idx]];
                    dispatch({ type: 'REORDER_LAYERS', orderedIds: ids });
                  }}
                  className="text-zinc-300 hover:text-zinc-600 disabled:opacity-20 leading-none text-[10px]"
                >
                  ▲
                </button>
                <button
                  title="Move down"
                  disabled={idx === 0}
                  onClick={(e) => {
                    e.stopPropagation();
                    const ids = layers.map((l) => l.id);
                    [ids[idx], ids[idx - 1]] = [ids[idx - 1], ids[idx]];
                    dispatch({ type: 'REORDER_LAYERS', orderedIds: ids });
                  }}
                  className="text-zinc-300 hover:text-zinc-600 disabled:opacity-20 leading-none text-[10px]"
                >
                  ▼
                </button>
              </div>

              {/* Name */}
              <span className="flex-1 text-xs text-zinc-700 truncate">
                {layer.name}
              </span>

              {/* Visibility */}
              <button
                title={layer.visible ? 'Hide layer' : 'Show layer'}
                onClick={(e) => {
                  e.stopPropagation();
                  dispatch({
                    type: 'UPDATE_LAYER',
                    layerId: layer.id,
                    patch: { visible: !layer.visible },
                  });
                }}
                className={`shrink-0 ${layer.visible ? 'text-zinc-400 hover:text-zinc-700' : 'text-zinc-200 hover:text-zinc-500'}`}
              >
                <EyeIcon open={layer.visible} />
              </button>

              {/* Lock */}
              <button
                title={layer.locked ? 'Unlock layer' : 'Lock layer'}
                onClick={(e) => {
                  e.stopPropagation();
                  dispatch({
                    type: 'UPDATE_LAYER',
                    layerId: layer.id,
                    patch: { locked: !layer.locked },
                  });
                }}
                className={`shrink-0 ${layer.locked ? 'text-zinc-700 hover:text-zinc-900' : 'text-zinc-200 hover:text-zinc-500'}`}
              >
                <LockIcon locked={layer.locked} />
              </button>

              {/* Delete */}
              <button
                title="Delete layer"
                onClick={(e) => {
                  e.stopPropagation();
                  dispatch({ type: 'DELETE_LAYER', layerId: layer.id });
                }}
                className="shrink-0 text-zinc-200 hover:text-red-500 text-xs leading-none"
              >
                ×
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
