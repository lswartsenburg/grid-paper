'use client';

import type { DrawingDocument, LayerItem, Viewport } from '../../types/canvas';
import { BASE_UNIT } from '../../lib/canvas/coordinates';
import ShapeElement from './ShapeElement';

function renderItem(item: LayerItem, hiddenIds?: Set<string>): React.ReactNode {
  if (hiddenIds?.has(item.id)) return null;
  if (item.type === 'group') {
    return (
      <g key={item.id}>
        {item.children.map((child) => renderItem(child, hiddenIds))}
      </g>
    );
  }
  return <ShapeElement key={item.id} shape={item} />;
}

interface Props {
  document: DrawingDocument;
  viewport: Viewport;
  /** Shape IDs to skip during rendering (e.g. a shape being live-resized). */
  hiddenIds?: Set<string>;
}

export default function ShapeRenderer({ document: doc, viewport, hiddenIds }: Props) {
  const { zoom, panOffset } = viewport;

  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
      <g transform={`translate(${panOffset.x} ${panOffset.y}) scale(${BASE_UNIT * zoom})`}>
        {doc.layers
          .filter((l) => l.visible)
          .map((layer) => (
            <g key={layer.id}>
              {layer.items.map((item) => renderItem(item, hiddenIds))}
            </g>
          ))}
      </g>
    </svg>
  );
}
