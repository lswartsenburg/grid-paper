import { describe, it, expect } from 'vitest';
import { hitTestDocument, shapeBounds } from './hitTest';
import { BASE_UNIT } from './coordinates';
import type { DrawingDocument, Layer, VectorShape } from '../../types/canvas';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDoc(...shapes: VectorShape[]): DrawingDocument {
  const layer: Layer = {
    id: 'layer-1',
    name: 'Layer 1',
    visible: true,
    locked: false,
    items: shapes,
    annotations: [],
  };
  return {
    id: 'doc-1',
    title: 'Test',
    createdAt: '',
    updatedAt: '',
    viewport: { zoom: 1, panOffset: { x: 0, y: 0 } },
    gridConfig: { majorEvery: 5, snapToGrid: true, cellSize: 1 },
    layers: [layer],
  };
}

const BASE: Pick<VectorShape, 'strokeColor' | 'strokeWidth'> = {
  strokeColor: '#000',
  strokeWidth: 1,
};

// 8 screen pixels expressed in grid units (= the maximum hit distance)
const PX8_IN_GRID = 8 / BASE_UNIT; // 0.4 at zoom=1

// ---------------------------------------------------------------------------
// shapeBounds
// ---------------------------------------------------------------------------

describe('shapeBounds', () => {
  it('returns null for an empty array', () => {
    expect(shapeBounds([])).toBeNull();
  });

  it('computes bounds for a single line', () => {
    const line: VectorShape = {
      ...BASE,
      id: 'l1',
      type: 'line',
      points: [
        { x: 1, y: 2 },
        { x: 5, y: 8 },
      ],
    };
    expect(shapeBounds([line])).toEqual({ minX: 1, minY: 2, maxX: 5, maxY: 8 });
  });

  it('computes bounds for a circle', () => {
    const circle: VectorShape = {
      ...BASE,
      id: 'c1',
      type: 'circle',
      center: { x: 10, y: 10 },
      radius: 3,
      fillColor: 'transparent',
    };
    expect(shapeBounds([circle])).toEqual({
      minX: 7,
      minY: 7,
      maxX: 13,
      maxY: 13,
    });
  });

  it('computes bounds for a rect', () => {
    const rect: VectorShape = {
      ...BASE,
      id: 'r1',
      type: 'rect',
      origin: { x: 2, y: 3 },
      width: 6,
      height: 4,
      fillColor: 'transparent',
    };
    expect(shapeBounds([rect])).toEqual({ minX: 2, minY: 3, maxX: 8, maxY: 7 });
  });

  it('merges bounds of multiple shapes', () => {
    const a: VectorShape = {
      ...BASE,
      id: 'a',
      type: 'line',
      points: [
        { x: 0, y: 0 },
        { x: 2, y: 2 },
      ],
    };
    const b: VectorShape = {
      ...BASE,
      id: 'b',
      type: 'line',
      points: [
        { x: -1, y: 3 },
        { x: 5, y: 1 },
      ],
    };
    expect(shapeBounds([a, b])).toEqual({
      minX: -1,
      minY: 0,
      maxX: 5,
      maxY: 3,
    });
  });
});

// ---------------------------------------------------------------------------
// hitTestDocument — miss cases
// ---------------------------------------------------------------------------

describe('hitTestDocument — misses', () => {
  it('returns null for an empty document', () => {
    expect(hitTestDocument(makeDoc(), { x: 0, y: 0 }, 1)).toBeNull();
  });

  it('returns null when clicking on a locked layer', () => {
    const shape: VectorShape = {
      ...BASE,
      id: 's1',
      type: 'line',
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
    };
    const doc = makeDoc(shape);
    doc.layers[0].locked = true;
    expect(hitTestDocument(doc, { x: 5, y: 0 }, 1)).toBeNull();
  });

  it('returns null when clicking on a hidden layer', () => {
    const shape: VectorShape = {
      ...BASE,
      id: 's1',
      type: 'line',
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
    };
    const doc = makeDoc(shape);
    doc.layers[0].visible = false;
    expect(hitTestDocument(doc, { x: 5, y: 0 }, 1)).toBeNull();
  });

  it('misses a line when farther than 8 screen pixels away', () => {
    // Line along y=0 from x=0 to x=10
    const line: VectorShape = {
      ...BASE,
      id: 'l1',
      type: 'line',
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
    };
    // Click slightly beyond the threshold
    const beyondThreshold = PX8_IN_GRID + 0.01; // just over 8px in grid units
    expect(
      hitTestDocument(makeDoc(line), { x: 5, y: beyondThreshold }, 1)
    ).toBeNull();
  });

  it('misses the interior of a transparent-fill rect', () => {
    const rect: VectorShape = {
      ...BASE,
      id: 'r1',
      type: 'rect',
      origin: { x: 0, y: 0 },
      width: 10,
      height: 10,
      fillColor: 'transparent',
    };
    // Click dead-centre — well inside, but no fill → border-only hit
    expect(hitTestDocument(makeDoc(rect), { x: 5, y: 5 }, 1)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// hitTestDocument — hit cases
// ---------------------------------------------------------------------------

describe('hitTestDocument — hits', () => {
  it('hits a line on the segment', () => {
    const line: VectorShape = {
      ...BASE,
      id: 'l1',
      type: 'line',
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
    };
    const result = hitTestDocument(makeDoc(line), { x: 5, y: 0 }, 1);
    expect(result).toEqual({ layerId: 'layer-1', shapeId: 'l1' });
  });

  it('hits a line within 8 screen pixels', () => {
    const line: VectorShape = {
      ...BASE,
      id: 'l1',
      type: 'line',
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
    };
    const withinThreshold = PX8_IN_GRID - 0.01; // just under 8px in grid units
    const result = hitTestDocument(
      makeDoc(line),
      { x: 5, y: withinThreshold },
      1
    );
    expect(result).toEqual({ layerId: 'layer-1', shapeId: 'l1' });
  });

  it('hits the border of a transparent-fill rect', () => {
    const rect: VectorShape = {
      ...BASE,
      id: 'r1',
      type: 'rect',
      origin: { x: 0, y: 0 },
      width: 10,
      height: 10,
      fillColor: 'transparent',
    };
    // Click 1px above the top border
    const result = hitTestDocument(
      makeDoc(rect),
      { x: 5, y: 1 / BASE_UNIT },
      1
    );
    expect(result).toEqual({ layerId: 'layer-1', shapeId: 'r1' });
  });

  it('hits the interior of a filled rect', () => {
    const rect: VectorShape = {
      ...BASE,
      id: 'r1',
      type: 'rect',
      origin: { x: 0, y: 0 },
      width: 10,
      height: 10,
      fillColor: '#ff0000',
    };
    const result = hitTestDocument(makeDoc(rect), { x: 5, y: 5 }, 1);
    expect(result).toEqual({ layerId: 'layer-1', shapeId: 'r1' });
  });

  it('hits a circle on its circumference', () => {
    const circle: VectorShape = {
      ...BASE,
      id: 'c1',
      type: 'circle',
      center: { x: 5, y: 5 },
      radius: 3,
      fillColor: 'transparent',
    };
    // Click exactly on the circumference (right side)
    const result = hitTestDocument(makeDoc(circle), { x: 8, y: 5 }, 1);
    expect(result).toEqual({ layerId: 'layer-1', shapeId: 'c1' });
  });

  it('hits a filled circle anywhere inside', () => {
    const circle: VectorShape = {
      ...BASE,
      id: 'c1',
      type: 'circle',
      center: { x: 5, y: 5 },
      radius: 3,
      fillColor: '#blue',
    };
    const result = hitTestDocument(makeDoc(circle), { x: 5, y: 5 }, 1);
    expect(result).toEqual({ layerId: 'layer-1', shapeId: 'c1' });
  });
});

// ---------------------------------------------------------------------------
// hitTestDocument — threshold is screen-pixel-accurate
//
// This directly tests the bug fix: threshold = HIT_RADIUS_PX / (BASE_UNIT * zoom)
// so the hit radius stays at 8 screen pixels regardless of BASE_UNIT.
// ---------------------------------------------------------------------------

describe('hitTestDocument — threshold is 8 screen pixels', () => {
  it('does NOT hit a shape 10 screen pixels away (old buggy threshold would have)', () => {
    // Old formula: threshold = 8 / zoom = 8 grid units = 160 screen pixels → would hit
    // New formula: threshold = 8 / (BASE_UNIT * zoom) = 0.4 grid units = 8 screen pixels → misses
    const line: VectorShape = {
      ...BASE,
      id: 'l1',
      type: 'line',
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
    };
    const tenScreenPx = 10 / BASE_UNIT; // 0.5 grid units
    expect(
      hitTestDocument(makeDoc(line), { x: 5, y: tenScreenPx }, 1)
    ).toBeNull();
  });

  it('DOES hit a shape exactly 8 screen pixels away', () => {
    const line: VectorShape = {
      ...BASE,
      id: 'l1',
      type: 'line',
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
    };
    const eightScreenPx = 8 / BASE_UNIT; // 0.4 grid units — exactly at threshold
    expect(
      hitTestDocument(makeDoc(line), { x: 5, y: eightScreenPx }, 1)
    ).toEqual({
      layerId: 'layer-1',
      shapeId: 'l1',
    });
  });

  it('hit radius scales correctly with zoom — at zoom=2, threshold is still 8px', () => {
    const line: VectorShape = {
      ...BASE,
      id: 'l1',
      type: 'line',
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
    };
    // At zoom=2: 1 grid unit = BASE_UNIT*2 = 40px, so 8px = 8/40 = 0.2 grid units
    const eightScreenPxAtZoom2 = 8 / (BASE_UNIT * 2);
    expect(
      hitTestDocument(makeDoc(line), { x: 5, y: eightScreenPxAtZoom2 }, 2)
    ).toEqual({
      layerId: 'layer-1',
      shapeId: 'l1',
    });
    // And 10px away should miss
    const tenScreenPxAtZoom2 = 10 / (BASE_UNIT * 2);
    expect(
      hitTestDocument(makeDoc(line), { x: 5, y: tenScreenPxAtZoom2 }, 2)
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// hitTestDocument — topmost shape wins
// ---------------------------------------------------------------------------

describe('hitTestDocument — paint order', () => {
  it('returns the topmost (last painted) shape when two shapes overlap', () => {
    const bottom: VectorShape = {
      ...BASE,
      id: 'bottom',
      type: 'line',
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
    };
    const top: VectorShape = {
      ...BASE,
      id: 'top',
      type: 'line',
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
    };
    // top is appended last → higher paint index → should win
    const result = hitTestDocument(makeDoc(bottom, top), { x: 5, y: 0 }, 1);
    expect(result?.shapeId).toBe('top');
  });
});
