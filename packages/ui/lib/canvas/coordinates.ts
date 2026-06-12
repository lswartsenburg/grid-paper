import type { Point, Viewport } from '../../types/canvas';

export const BASE_UNIT = 20; // px per grid unit at zoom = 1
export const MAJOR_EVERY = 5; // major grid line every N minor units

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 10;

export function screenToGrid(screen: Point, viewport: Viewport): Point {
  return {
    x: (screen.x - viewport.panOffset.x) / (BASE_UNIT * viewport.zoom),
    y: (screen.y - viewport.panOffset.y) / (BASE_UNIT * viewport.zoom),
  };
}

export function gridToScreen(grid: Point, viewport: Viewport): Point {
  return {
    x: grid.x * BASE_UNIT * viewport.zoom + viewport.panOffset.x,
    y: grid.y * BASE_UNIT * viewport.zoom + viewport.panOffset.y,
  };
}

export function snapToGrid(point: Point, step: number): Point {
  return {
    x: Math.round(point.x / step) * step,
    y: Math.round(point.y / step) * step,
  };
}

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

// Zoom around a fixed screen-space origin point, returning the new panOffset.
export function zoomAround(
  origin: Point,
  prevZoom: number,
  nextZoom: number,
  panOffset: Point
): Point {
  const scale = nextZoom / prevZoom;
  return {
    x: origin.x - scale * (origin.x - panOffset.x),
    y: origin.y - scale * (origin.y - panOffset.y),
  };
}
