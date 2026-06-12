import type { VectorShape } from '../../types/canvas';

interface Props {
  shape: VectorShape;
  opacity?: number;
  dashed?: boolean;
}

export default function ShapeElement({
  shape,
  opacity = 1,
  dashed = false,
}: Props) {
  const common = {
    'data-key': shape.key,
    stroke: shape.strokeColor,
    strokeWidth: shape.strokeWidth,
    vectorEffect: 'non-scaling-stroke' as const,
    strokeDasharray: dashed
      ? `${shape.strokeWidth * 4} ${shape.strokeWidth * 2}`
      : undefined,
    opacity,
  };

  switch (shape.type) {
    case 'line':
      return (
        <line
          x1={shape.points[0].x}
          y1={shape.points[0].y}
          x2={shape.points[1].x}
          y2={shape.points[1].y}
          fill="none"
          {...common}
        />
      );

    case 'polyline':
      return (
        <polyline
          points={shape.points.map((p) => `${p.x},${p.y}`).join(' ')}
          fill="none"
          {...common}
        />
      );

    case 'circle':
      return (
        <circle
          cx={shape.center.x}
          cy={shape.center.y}
          r={shape.radius}
          fill={shape.fillColor}
          {...common}
        />
      );

    case 'rect':
      return (
        <rect
          x={shape.origin.x}
          y={shape.origin.y}
          width={shape.width}
          height={shape.height}
          fill={shape.fillColor}
          {...common}
        />
      );

    case 'freehand': {
      if (shape.points.length < 2) return null;
      const d =
        `M ${shape.points[0].x},${shape.points[0].y} ` +
        shape.points
          .slice(1)
          .map((p) => `L ${p.x},${p.y}`)
          .join(' ');
      return <path d={d} fill="none" {...common} />;
    }

    default:
      return null;
  }
}
