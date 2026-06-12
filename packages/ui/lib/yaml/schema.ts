// YAML authoring schema — designed for human and LLM authorship.
// All coordinates are in grid units. Most fields are optional and fall back
// to sensible defaults so an LLM only needs to specify what matters.
//
// Minimal example:
//   layers:
//     - name: Layer 1
//       shapes:
//         - type: line
//           from: [0, 0]
//           to: [5, 3]

export type YamlPoint = [number, number];

export interface YamlBaseShape {
  /** Human-readable identifier. Preserved as the shape's `key` in the data
   *  model and rendered as `data-key` in the DOM. */
  key?: string;
  stroke?: string;
  strokeWidth?: number;
}

export interface YamlLineShape extends YamlBaseShape {
  type: 'line';
  from: YamlPoint;
  to: YamlPoint;
}

export interface YamlPolylineShape extends YamlBaseShape {
  type: 'polyline';
  points: YamlPoint[];
}

export interface YamlCircleShape extends YamlBaseShape {
  type: 'circle';
  center: YamlPoint;
  radius: number;
  fill?: string;
}

export interface YamlRectShape extends YamlBaseShape {
  type: 'rect';
  origin: YamlPoint;
  width: number;
  height: number;
  fill?: string;
}

export interface YamlFreehandShape extends YamlBaseShape {
  type: 'freehand';
  points: YamlPoint[];
}

export interface YamlGroup {
  type: 'group';
  key?: string;
  name?: string;
  shapes: YamlItem[];
}

export type YamlShape =
  | YamlLineShape
  | YamlPolylineShape
  | YamlCircleShape
  | YamlRectShape
  | YamlFreehandShape;

export type YamlItem = YamlShape | YamlGroup;

export interface YamlLayer {
  name?: string;
  visible?: boolean;
  locked?: boolean;
  shapes: YamlItem[];
}

export interface YamlDocument {
  title?: string;
  grid?: {
    majorEvery?: number;
  };
  layers?: YamlLayer[];
}
