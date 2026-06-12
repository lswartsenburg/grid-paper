import type { VectorShape } from '../../types/canvas';

interface Props {
  shape: VectorShape;
  opacity?: number;
  dashed?: boolean;
}

/**
 * Returns the center point of a shape in grid units.
 * Used to position the optional text label.
 */
function shapeLabelPosition(
  shape: VectorShape
): { x: number; y: number } | null {
  switch (shape.type) {
    case 'rect':
      return { x: shape.origin.x + shape.width / 2, y: shape.origin.y + shape.height / 2 };
    case 'circle':
      return { x: shape.center.x, y: shape.center.y };
    case 'line': {
      const [a, b] = shape.points;
      return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    }
    case 'polyline': {
      if (shape.points.length === 0) return null;
      const mid = Math.floor((shape.points.length - 1) / 2);
      return shape.points[mid];
    }
    case 'freehand': {
      if (shape.points.length === 0) return null;
      const sumX = shape.points.reduce((s, p) => s + p.x, 0);
      const sumY = shape.points.reduce((s, p) => s + p.y, 0);
      return { x: sumX / shape.points.length, y: sumY / shape.points.length };
    }
    default:
      return null;
  }
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

  let shapeEl: React.ReactNode;

  switch (shape.type) {
    case 'line':
      shapeEl = (
        <line
          x1={shape.points[0].x}
          y1={shape.points[0].y}
          x2={shape.points[1].x}
          y2={shape.points[1].y}
          fill="none"
          {...common}
        />
      );
      break;

    case 'polyline':
      shapeEl = (
        <polyline
          points={shape.points.map((p) => `${p.x},${p.y}`).join(' ')}
          fill="none"
          {...common}
        />
      );
      break;

    case 'circle':
      shapeEl = (
        <circle
          cx={shape.center.x}
          cy={shape.center.y}
          r={shape.radius}
          fill={shape.fillColor}
          {...common}
        />
      );
      break;

    case 'rect':
      shapeEl = (
        <rect
          x={shape.origin.x}
          y={shape.origin.y}
          width={shape.width}
          height={shape.height}
          fill={shape.fillColor}
          {...common}
        />
      );
      break;

    case 'freehand': {
      if (shape.points.length < 2) {
        shapeEl = null;
        break;
      }
      const d =
        `M ${shape.points[0].x},${shape.points[0].y} ` +
        shape.points
          .slice(1)
          .map((p) => `L ${p.x},${p.y}`)
          .join(' ');
      shapeEl = <path d={d} fill="none" {...common} />;
      break;
    }

    default:
      shapeEl = null;
  }

  if (!shape.label) return <>{shapeEl}</>;

  const pos = shapeLabelPosition(shape);
  if (!pos) return <>{shapeEl}</>;

  return (
    <>
      {shapeEl}
      {/*
       * Font size is in grid units (0.6 ≈ 12 px at default zoom=1 / BASE_UNIT=20).
       * A white "halo" painted behind the text keeps it readable over shape fills.
       * paintOrder="stroke fill" ensures the halo sits beneath the coloured text.
       */}
      <text
        x={pos.x}
        y={pos.y}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={0.6}
        fill={shape.strokeColor}
        stroke="white"
        strokeWidth={0.18}
        paintOrder="stroke fill"
        style={{ userSelect: 'none', pointerEvents: 'none' }}
      >
        {shape.label}
      </text>
    </>
  );
}
