import { load } from 'js-yaml';
import type {
  DrawingDocument,
  Layer,
  LayerItem,
  VectorShape,
  GroupShape,
  Point,
  Viewport,
  GridConfig,
} from '../../types/canvas';
import type { YamlDocument, YamlItem, YamlPoint } from './schema';

const DEFAULT_STROKE = '#1a1a1a';
const DEFAULT_STROKE_WIDTH = 1.5;
const DEFAULT_FILL = 'transparent';

function point(p: YamlPoint): Point {
  if (!Array.isArray(p) || p.length < 2)
    throw new Error(`Invalid point: ${JSON.stringify(p)}`);
  return { x: Number(p[0]), y: Number(p[1]) };
}

function parseItem(raw: YamlItem): LayerItem {
  if (!raw || typeof raw !== 'object' || !('type' in raw)) {
    throw new Error(`Shape is missing a "type" field: ${JSON.stringify(raw)}`);
  }

  if (raw.type === 'group') {
    const group: GroupShape = {
      id: crypto.randomUUID(),
      type: 'group',
      name: raw.name ?? 'Group',
      children: (raw.shapes ?? []).map(parseItem),
    };
    return group;
  }

  const base = {
    id: crypto.randomUUID(),
    strokeColor: raw.stroke ?? DEFAULT_STROKE,
    strokeWidth: raw.strokeWidth ?? DEFAULT_STROKE_WIDTH,
  };

  switch (raw.type) {
    case 'line': {
      const shape: VectorShape = {
        ...base,
        type: 'line',
        points: [point(raw.from), point(raw.to)],
      };
      return shape;
    }
    case 'polyline': {
      if (!Array.isArray(raw.points) || raw.points.length < 2) {
        throw new Error('polyline requires at least 2 points');
      }
      return { ...base, type: 'polyline', points: raw.points.map(point) };
    }
    case 'circle': {
      return {
        ...base,
        type: 'circle',
        center: point(raw.center),
        radius: Number(raw.radius),
        fillColor: raw.fill ?? DEFAULT_FILL,
      };
    }
    case 'rect': {
      return {
        ...base,
        type: 'rect',
        origin: point(raw.origin),
        width: Number(raw.width),
        height: Number(raw.height),
        fillColor: raw.fill ?? DEFAULT_FILL,
      };
    }
    case 'freehand': {
      if (!Array.isArray(raw.points) || raw.points.length < 2) {
        throw new Error('freehand requires at least 2 points');
      }
      return { ...base, type: 'freehand', points: raw.points.map(point) };
    }
    default:
      throw new Error(
        `Unknown shape type: "${(raw as { type: string }).type}"`
      );
  }
}

function parseLayer(raw: NonNullable<YamlDocument['layers']>[number]): Layer {
  return {
    id: crypto.randomUUID(),
    name: raw.name ?? 'Layer',
    visible: raw.visible ?? true,
    locked: raw.locked ?? false,
    items: (raw.shapes ?? []).map(parseItem),
    annotations: [],
  };
}

export interface ParseResult {
  document: DrawingDocument;
  error: null;
}

export interface ParseError {
  document: null;
  error: string;
}

// Merges parsed YAML content into an existing document, preserving the
// current viewport and timestamps (which the YAML format intentionally omits).
export function parseYaml(
  yamlStr: string,
  current: DrawingDocument
): ParseResult | ParseError {
  let raw: unknown;
  try {
    raw = load(yamlStr);
  } catch (e) {
    return {
      document: null,
      error: `YAML syntax error: ${(e as Error).message}`,
    };
  }

  if (!raw || typeof raw !== 'object') {
    return {
      document: null,
      error: 'Document must be a YAML mapping at the top level.',
    };
  }

  const yaml = raw as YamlDocument;

  try {
    const layers: Layer[] =
      yaml.layers && Array.isArray(yaml.layers)
        ? yaml.layers.map(parseLayer)
        : [
            {
              id: crypto.randomUUID(),
              name: 'Layer 1',
              visible: true,
              locked: false,
              items: [],
              annotations: [],
            },
          ];

    const gridConfig: GridConfig = {
      majorEvery: yaml.grid?.majorEvery ?? current.gridConfig.majorEvery,
    };

    const viewport: Viewport = current.viewport;

    const doc: DrawingDocument = {
      id: current.id,
      title: yaml.title ?? current.title,
      createdAt: current.createdAt,
      updatedAt: new Date().toISOString(),
      viewport,
      gridConfig,
      layers,
    };

    return { document: doc, error: null };
  } catch (e) {
    return { document: null, error: (e as Error).message };
  }
}
