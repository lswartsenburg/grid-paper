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
  /** Text label rendered at the center of the shape on the canvas. */
  label?: string;
  stroke?: string;
  strokeWidth?: number;
  /** Stroke dash pattern. Defaults to solid when omitted. */
  strokeDash?: 'solid' | 'dashed' | 'dotted';
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
  /**
   * Grid configuration. All fields are optional — omitted fields fall back to
   * their defaults so the YAML only needs to declare what differs.
   *
   * Example (1 cell = 10 cm, major lines every 5 cells):
   *   grid:
   *     majorEvery: 5
   *     unit: "cm"
   *     cellSize: 10
   */
  grid?: {
    /** Minor cells per major grid line. Default: 5. */
    majorEvery?: number;
    /** Snap shapes to the nearest grid intersection. Default: true. */
    snapToGrid?: boolean;
    /** Real-world unit label for one minor cell, e.g. "cm", "ft", "in", "m". */
    unit?: string;
    /** How many `unit`s one minor cell represents. Default: 1. */
    cellSize?: number;
  };
  layers?: YamlLayer[];
}
