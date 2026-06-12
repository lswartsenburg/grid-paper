'use client';

import type { VectorShape, Viewport } from '../../types/canvas';
import { BASE_UNIT } from '../../lib/canvas/coordinates';
import { shapeBounds } from '../../lib/canvas/hitTest';

interface Props {
  /** The currently selected shapes at their original (pre-drag) positions. */
  shapes: VectorShape[];
  /** Live drag offset in grid units. The overlay moves by this amount during drag. */
  dragDelta: { x: number; y: number };
  viewport: Viewport;
}

const PAD = 0.25; // grid-unit padding around the selection box

/**
 * Renders a dashed bounding-box overlay around selected shapes.
 * During drag the box follows the cursor while shapes stay in place,
 * so the user sees where they will land on release.
 */
export default function SelectionOverlay({
  shapes,
  dragDelta,
  viewport,
}: Props) {
  if (shapes.length === 0) return null;
  const bounds = shapeBounds(shapes);
  if (!bounds) return null;

  const { zoom, panOffset } = viewport;
  const { minX, minY, maxX, maxY } = bounds;

  // Offset the box by drag delta so it shows the prospective landing position.
  const bx = minX + dragDelta.x - PAD;
  const by = minY + dragDelta.y - PAD;
  const bw = maxX - minX + PAD * 2;
  const bh = maxY - minY + PAD * 2;

  const scale = BASE_UNIT * zoom;
  // Dash pattern scales with the transform, so compute values in grid units
  // that look like ~4px on / ~3px off at any zoom level.
  const dashOn = 4 / scale;
  const dashOff = 3 / scale;

  const corners: [number, number][] = [
    [bx, by],
    [bx + bw, by],
    [bx + bw, by + bh],
    [bx, by + bh],
  ];

  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
      <g transform={`translate(${panOffset.x} ${panOffset.y}) scale(${scale})`}>
        {/* Selection rectangle */}
        <rect
          x={bx}
          y={by}
          width={bw}
          height={bh}
          fill="rgba(59,130,246,0.04)"
          stroke="rgb(59,130,246)"
          strokeWidth={1.5 / scale}
          strokeDasharray={`${dashOn} ${dashOff}`}
          rx={2 / scale}
        />
        {/* Corner handles */}
        {corners.map(([cx, cy], i) => (
          <rect
            key={i}
            x={cx - 4 / scale}
            y={cy - 4 / scale}
            width={8 / scale}
            height={8 / scale}
            fill="white"
            stroke="rgb(59,130,246)"
            strokeWidth={1.5 / scale}
            rx={1 / scale}
          />
        ))}
      </g>
    </svg>
  );
}
