export interface Point {
  x: number;
  y: number;
}

interface BaseShape {
  id: string;
  /** Optional human-readable identifier. Serialized as `key:` in YAML and
   *  rendered as `data-key` in the DOM for easy test selection. */
  key?: string;
  strokeColor: string;
  strokeWidth: number;
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
  majorEvery: number; // how many minor cells make one major cell (e.g. 4, 5, 8, 10)
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
