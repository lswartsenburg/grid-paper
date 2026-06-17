export interface Point {
  x: number;
  y: number;
}

interface BaseShape {
  id: string;
  /** Optional human-readable identifier. Serialized as `key:` in YAML and
   *  rendered as `data-key` in the DOM for easy test selection. */
  key?: string;
  /**
   * Optional text label rendered at the center of the shape on the canvas.
   * Useful for annotating shapes without requiring a separate annotation layer.
   */
  label?: string;
  strokeColor: string;
  strokeWidth: number;
  /** Stroke dash pattern. Omitting or setting to 'solid' renders a solid line. */
  strokeDash?: 'solid' | 'dashed' | 'dotted';
}

export interface LineShape extends BaseShape {
  type: 'line';
  points: [Point, Point];
}

export interface PolylineShape extends BaseShape {
  type: 'polyline';
  points: Point[];
}

export interface CircleShape extends BaseShape {
  type: 'circle';
  center: Point;
  radius: number;
  fillColor: string;
}

export interface RectShape extends BaseShape {
  type: 'rect';
  origin: Point;
  width: number;
  height: number;
  fillColor: string;
}

export interface FreehandShape extends BaseShape {
  type: 'freehand';
  points: Point[];
}

export type VectorShape =
  | LineShape
  | PolylineShape
  | CircleShape
  | RectShape
  | FreehandShape;

export type ShapeType = VectorShape['type'];

export interface GroupShape {
  id: string;
  /** Optional human-readable identifier — same semantics as on VectorShape. */
  key?: string;
  type: 'group';
  name: string;
  children: LayerItem[];
}

export type LayerItem = VectorShape | GroupShape;

export interface Annotation {
  id: string;
  text: string;
  position: Point;
  fontSize: number;
  color: string;
}

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  items: LayerItem[];
  annotations: Annotation[];
}

export interface Viewport {
  zoom: number;
  panOffset: Point;
}

export interface GridConfig {
  /** How many minor cells make one major cell (e.g. 4, 5, 8, 10). */
  majorEvery: number;
  /** Whether shapes snap to the nearest grid intersection while drawing or dragging. */
  snapToGrid: boolean;
  /**
   * Real-world unit label for one minor cell — e.g. `"cm"`, `"ft"`, `"in"`, `"m"`.
   * Omit (undefined) when no unit is assigned.
   */
  unit?: string;
  /**
   * How many `unit`s one minor cell represents.
   * Only meaningful when `unit` is set. Defaults to 1.
   */
  cellSize: number;
}

export interface DrawingDocument {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  viewport: Viewport;
  gridConfig: GridConfig;
  layers: Layer[];
}
