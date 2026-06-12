'use client';

import type { VectorShape, Viewport } from '../../types/canvas';
import { BASE_UNIT } from '../../lib/canvas/coordinates';
import ShapeElement from './ShapeElement';

interface Props {
  shape: VectorShape;
  viewport: Viewport;
}

export default function PreviewLayer({ shape, viewport }: Props) {
  const { zoom, panOffset } = viewport;

  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
      <g
        transform={`translate(${panOffset.x} ${panOffset.y}) scale(${BASE_UNIT * zoom})`}
      >
        <ShapeElement shape={shape} dashed opacity={0.65} />
      </g>
    </svg>
  );
}
