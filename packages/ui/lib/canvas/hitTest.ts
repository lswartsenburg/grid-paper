import type {
  DrawingDocument,
  LayerItem,
  VectorShape,
  Point,
} from '../../types/canvas';
import { BASE_UNIT } from './coordinates';

/** Screen-pixel radius within which a click counts as a hit. */
const HIT_RADIUS_PX = 8;

/** Returns the shortest distance from point `p` to line segment `a→b`. */
function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(
    0,
    Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq)
  );
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Returns true if `pos` (grid coords) hits `shape` within `threshold` grid units. */
function hitShape(shape: VectorShape, pos: Point, threshold: number): boolean {
  switch (shape.type) {
    case 'line':
      return distToSegment(pos, shape.points[0], shape.points[1]) <= threshold;

    case 'polyline':
    case 'freehand':
      for (let i = 0; i < shape.points.length - 1; i++) {
        if (
          distToSegment(pos, shape.points[i], shape.points[i + 1]) <= threshold
        )
          return true;
      }
      return false;

    case 'circle': {
      const dist = Math.hypot(pos.x - shape.center.x, pos.y - shape.center.y);
      if (shape.fillColor !== 'transparent' && dist <= shape.radius + threshold)
        return true;
      return Math.abs(dist - shape.radius) <= threshold;
    }

    case 'rect': {
      const { origin: o, width: w, height: h, fillColor } = shape;
      if (
        fillColor !== 'transparent' &&
        pos.x >= o.x &&
        pos.x <= o.x + w &&
        pos.y >= o.y &&
        pos.y <= o.y + h
      )
        return true;
      const bl = { x: o.x, y: o.y + h };
      const tr = { x: o.x + w, y: o.y };
      const br = { x: o.x + w, y: o.y + h };
      return (
        distToSegment(pos, o, tr) <= threshold ||
        distToSegment(pos, tr, br) <= threshold ||
        distToSegment(pos, br, bl) <= threshold ||
        distToSegment(pos, bl, o) <= threshold
      );
    }
  }
}

/** Tests items in reverse paint order so the topmost shape wins. */
function hitItems(
  items: LayerItem[],
  pos: Point,
  threshold: number
): string | null {
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    if (item.type === 'group') {
      const hit = hitItems(item.children, pos, threshold);
      if (hit) return hit;
    } else if (hitShape(item, pos, threshold)) {
      return item.id;
    }
  }
  return null;
}

export interface HitResult {
  layerId: string;
  shapeId: string;
}

/**
 * Returns the first shape hit at `pos` (grid coords), searching all visible
 * unlocked layers from top to bottom. Returns null if nothing was hit.
 *
 * @param zoom - current viewport zoom, used to convert the pixel hit radius to grid units
 */
export function hitTestDocument(
  doc: DrawingDocument,
  pos: Point,
  zoom: number
): HitResult | null {
  // Divide by BASE_UNIT so the threshold stays at HIT_RADIUS_PX screen pixels at any zoom level.
  const threshold = HIT_RADIUS_PX / (BASE_UNIT * zoom);
  for (let i = doc.layers.length - 1; i >= 0; i--) {
    const layer = doc.layers[i];
    if (!layer.visible || layer.locked) continue;
    const shapeId = hitItems(layer.items, pos, threshold);
    if (shapeId) return { layerId: layer.id, shapeId };
  }
  return null;
}

/**
 * Computes the axis-aligned bounding box of a set of shapes in grid coordinates.
 * Returns null if the array is empty.
 */
export function shapeBounds(
  shapes: VectorShape[]
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  if (shapes.length === 0) return null;
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  function expand(p: Point) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }

  for (const shape of shapes) {
    switch (shape.type) {
      case 'line':
      case 'polyline':
      case 'freehand':
        shape.points.forEach(expand);
        break;
      case 'circle':
        expand({
          x: shape.center.x - shape.radius,
          y: shape.center.y - shape.radius,
        });
        expand({
          x: shape.center.x + shape.radius,
          y: shape.center.y + shape.radius,
        });
        break;
      case 'rect':
        expand(shape.origin);
        expand({
          x: shape.origin.x + shape.width,
          y: shape.origin.y + shape.height,
        });
        break;
    }
  }

  return { minX, minY, maxX, maxY };
}
