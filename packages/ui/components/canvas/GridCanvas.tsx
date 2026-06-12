'use client';

import type { Point, Viewport } from '../../types/canvas';
import { zoomAround } from '../../lib/canvas/coordinates';
import { useCanvasPointer } from '../../lib/canvas/useCanvasPointer';
import GridBackground from './GridBackground';

interface Props {
  viewport: Viewport;
  majorEvery: number;
  onViewportChange: (patch: Partial<Viewport>) => void;
  onPointerDown?: (gridPos: Point, event: PointerEvent) => void;
  onPointerMove?: (gridPos: Point, delta: Point, event: PointerEvent) => void;
  onPointerUp?: (gridPos: Point, event: PointerEvent) => void;
  /** CSS cursor value. Defaults to 'crosshair'. */
  cursorStyle?: string;
  children?: React.ReactNode;
}

export default function GridCanvas({
  viewport,
  majorEvery,
  onViewportChange,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  cursorStyle = 'crosshair',
  children,
}: Props) {
  const canvasRef = useCanvasPointer<HTMLDivElement>({
    viewport,
    onPan(delta) {
      onViewportChange({
        panOffset: {
          x: viewport.panOffset.x + delta.x,
          y: viewport.panOffset.y + delta.y,
        },
      });
    },
    onZoom(newZoom, origin) {
      onViewportChange({
        zoom: newZoom,
        panOffset: zoomAround(
          origin,
          viewport.zoom,
          newZoom,
          viewport.panOffset
        ),
      });
    },
    onPointerDown,
    onPointerMove,
    onPointerUp,
  });

  return (
    <div
      ref={canvasRef}
      // touch-action: none tells the browser to hand all touch events to JS
      // so panning/pinch-zoom aren't intercepted by the browser scroller.
      className="relative flex-1 overflow-hidden select-none touch-none"
      style={{ cursor: cursorStyle }}
    >
      <GridBackground viewport={viewport} majorEvery={majorEvery} />
      {children}
    </div>
  );
}
