'use client';

import type { Viewport } from '../../types/canvas';
import { BASE_UNIT } from '../../lib/canvas/coordinates';

interface Props {
  viewport: Viewport;
  majorEvery: number;
}

// Returns ((a % b) + b) % b — always non-negative, so the SVG pattern
// origin stays within one tile width of the canvas edge regardless of
// how far the user has panned in either direction.
function mod(a: number, b: number): number {
  return ((a % b) + b) % b;
}

export default function GridBackground({ viewport, majorEvery }: Props) {
  const { zoom, panOffset } = viewport;

  const minorPeriod = BASE_UNIT; // pattern-space size (scaled by zoom via patternTransform)
  const majorPeriod = BASE_UNIT * majorEvery;

  const minorScreenPeriod = minorPeriod * zoom;
  const majorScreenPeriod = majorPeriod * zoom;

  const minorTx = mod(panOffset.x, minorScreenPeriod);
  const minorTy = mod(panOffset.y, minorScreenPeriod);
  const majorTx = mod(panOffset.x, majorScreenPeriod);
  const majorTy = mod(panOffset.y, majorScreenPeriod);

  // strokeWidth is divided by zoom so it stays 1 screen-pixel after the
  // scale() in patternTransform is applied.
  const minorStroke = 0.5 / zoom;
  const majorStroke = 1 / zoom;

  // Hide minor lines when they'd be too dense to be readable.
  const showMinor = zoom >= 0.4;

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {showMinor && (
          <pattern
            id="gp-minor"
            width={minorPeriod}
            height={minorPeriod}
            patternUnits="userSpaceOnUse"
            patternTransform={`translate(${minorTx} ${minorTy}) scale(${zoom})`}
          >
            <path
              d={`M ${minorPeriod} 0 L 0 0 0 ${minorPeriod}`}
              fill="none"
              stroke="#d1d5db"
              strokeWidth={minorStroke}
            />
          </pattern>
        )}
        <pattern
          id="gp-major"
          width={majorPeriod}
          height={majorPeriod}
          patternUnits="userSpaceOnUse"
          patternTransform={`translate(${majorTx} ${majorTy}) scale(${zoom})`}
        >
          <path
            d={`M ${majorPeriod} 0 L 0 0 0 ${majorPeriod}`}
            fill="none"
            stroke="#9ca3af"
            strokeWidth={majorStroke}
          />
        </pattern>
      </defs>

      <rect width="100%" height="100%" fill="white" />
      {showMinor && <rect width="100%" height="100%" fill="url(#gp-minor)" />}
      <rect width="100%" height="100%" fill="url(#gp-major)" />
    </svg>
  );
}
