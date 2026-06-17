'use client';

import { useReducer } from 'react';
import type {
  DrawingDocument,
  GridConfig,
  GroupShape,
  Layer,
  LayerItem,
  VectorShape,
  Annotation,
  Viewport,
} from '../../types/canvas';

export type DrawingAction =
  | { type: 'ADD_LAYER'; layer: Layer }
  | { type: 'DELETE_LAYER'; layerId: string }
  | {
      type: 'UPDATE_LAYER';
      layerId: string;
      patch: Partial<Pick<Layer, 'name' | 'visible' | 'locked'>>;
    }
  | { type: 'REORDER_LAYERS'; orderedIds: string[] }
  | { type: 'ADD_SHAPE'; layerId: string; shape: VectorShape; groupId?: string }
  | { type: 'REPLACE_SHAPE'; layerId: string; shape: VectorShape }
  | { type: 'DELETE_SHAPE'; layerId: string; shapeId: string }
  | {
      type: 'GROUP_SHAPES';
      layerId: string;
      shapeIds: string[];
      groupId: string;
      groupName: string;
    }
  | { type: 'UNGROUP'; layerId: string; groupId: string }
  | {
      type: 'REORDER_ITEMS';
      layerId: string;
      orderedIds: string[];
      groupId?: string;
    }
  | { type: 'ADD_ANNOTATION'; layerId: string; annotation: Annotation }
  | { type: 'DELETE_ANNOTATION'; layerId: string; annotationId: string }
  | { type: 'UPDATE_VIEWPORT'; patch: Partial<Viewport> }
  | { type: 'UPDATE_GRID_CONFIG'; patch: Partial<GridConfig> }
  | { type: 'UPDATE_METADATA'; patch: Partial<Pick<DrawingDocument, 'title'>> }
  | { type: 'LOAD_DOCUMENT'; document: DrawingDocument }
  | {
      type: 'TRANSLATE_SHAPES';
      layerId: string;
      shapeIds: string[];
      dx: number;
      dy: number;
    }
  | {
      type: 'UPDATE_SHAPE_STYLE';
      layerId: string;
      shapeId: string;
      patch: Partial<
        Pick<VectorShape, 'strokeColor' | 'strokeWidth' | 'strokeDash'>
      > & {
        fillColor?: string;
      };
    }
  | {
      type: 'UPDATE_SHAPE_KEY';
      layerId: string;
      shapeId: string;
      /** Pass undefined to remove the key entirely. */
      key: string | undefined;
    }
  | {
      type: 'UPDATE_SHAPE_LABEL';
      layerId: string;
      shapeId: string;
      /** Pass undefined or empty string to remove the label. */
      label: string | undefined;
    };

// --- Recursive item helpers ---

function mapItemsDeep(
  items: LayerItem[],
  fn: (item: LayerItem) => LayerItem | null
): LayerItem[] {
  const out: LayerItem[] = [];
  for (const item of items) {
    const mapped = fn(item);
    if (mapped === null) continue;
    if (mapped.type === 'group') {
      out.push({ ...mapped, children: mapItemsDeep(mapped.children, fn) });
    } else {
      out.push(mapped);
    }
  }
  return out;
}

function reorderById(items: LayerItem[], orderedIds: string[]): LayerItem[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  return orderedIds.flatMap((id) => {
    const item = byId.get(id);
    return item ? [item] : [];
  });
}

function reorderWithinGroup(
  items: LayerItem[],
  groupId: string,
  orderedIds: string[]
): LayerItem[] {
  return items.map((item) => {
    if (item.type !== 'group') return item;
    if (item.id === groupId)
      return { ...item, children: reorderById(item.children, orderedIds) };
    return {
      ...item,
      children: reorderWithinGroup(item.children, groupId, orderedIds),
    };
  });
}

// Collect top-level items matching ids (preserving original order), then replace
// them with a group at the position of the first matched item.
function groupItems(
  items: LayerItem[],
  shapeIds: Set<string>,
  group: GroupShape
): LayerItem[] {
  const collected: LayerItem[] = [];
  const remaining: LayerItem[] = [];
  let insertIndex = -1;

  items.forEach((item, i) => {
    if (shapeIds.has(item.id)) {
      collected.push(item);
      if (insertIndex === -1)
        insertIndex = i - (items.length - remaining.length - 1);
    } else {
      remaining.push(item);
    }
  });

  const result = [...remaining];
  result.splice(Math.max(0, insertIndex), 0, { ...group, children: collected });
  return result;
}

function ungroupItems(items: LayerItem[], groupId: string): LayerItem[] {
  return items.flatMap((item) => {
    if (item.type !== 'group') return [item];
    if (item.id === groupId) return item.children;
    return [{ ...item, children: ungroupItems(item.children, groupId) }];
  });
}

// --- Shape transform helpers ---

import type { Point } from '../../types/canvas';

function translateShape(
  shape: VectorShape,
  dx: number,
  dy: number
): VectorShape {
  const tp = (p: Point): Point => ({ x: p.x + dx, y: p.y + dy });
  switch (shape.type) {
    case 'line':
      return { ...shape, points: [tp(shape.points[0]), tp(shape.points[1])] };
    case 'polyline':
    case 'freehand':
      return { ...shape, points: shape.points.map(tp) };
    case 'circle':
      return { ...shape, center: tp(shape.center) };
    case 'rect':
      return { ...shape, origin: tp(shape.origin) };
  }
}

// --- Reducer ---

function stamp(state: DrawingDocument): DrawingDocument {
  return { ...state, updatedAt: new Date().toISOString() };
}

function mapLayer(
  state: DrawingDocument,
  layerId: string,
  fn: (layer: Layer) => Layer
): DrawingDocument {
  return {
    ...state,
    layers: state.layers.map((l) => (l.id === layerId ? fn(l) : l)),
  };
}

function reducer(
  state: DrawingDocument,
  action: DrawingAction
): DrawingDocument {
  switch (action.type) {
    case 'ADD_LAYER':
      return stamp({ ...state, layers: [...state.layers, action.layer] });

    case 'DELETE_LAYER':
      return stamp({
        ...state,
        layers: state.layers.filter((l) => l.id !== action.layerId),
      });

    case 'UPDATE_LAYER':
      return stamp(
        mapLayer(state, action.layerId, (l) => ({ ...l, ...action.patch }))
      );

    case 'REORDER_LAYERS': {
      const byId = new Map(state.layers.map((l) => [l.id, l]));
      const reordered = action.orderedIds.flatMap((id) => {
        const layer = byId.get(id);
        return layer ? [layer] : [];
      });
      return stamp({ ...state, layers: reordered });
    }

    case 'ADD_SHAPE':
      return stamp(
        mapLayer(state, action.layerId, (l) => {
          if (!action.groupId) {
            return { ...l, items: [...l.items, action.shape] };
          }
          return {
            ...l,
            items: mapItemsDeep(l.items, (item) => {
              if (item.type === 'group' && item.id === action.groupId) {
                return { ...item, children: [...item.children, action.shape] };
              }
              return item;
            }),
          };
        })
      );

    case 'REPLACE_SHAPE':
      return stamp(
        mapLayer(state, action.layerId, (l) => ({
          ...l,
          items: mapItemsDeep(l.items, (item) =>
            item.id === action.shape.id ? action.shape : item
          ),
        }))
      );

    case 'DELETE_SHAPE':
      return stamp(
        mapLayer(state, action.layerId, (l) => ({
          ...l,
          items: mapItemsDeep(l.items, (item) =>
            item.id === action.shapeId ? null : item
          ),
        }))
      );

    case 'GROUP_SHAPES':
      return stamp(
        mapLayer(state, action.layerId, (l) => ({
          ...l,
          items: groupItems(l.items, new Set(action.shapeIds), {
            id: action.groupId,
            type: 'group',
            name: action.groupName,
            children: [],
          }),
        }))
      );

    case 'UNGROUP':
      return stamp(
        mapLayer(state, action.layerId, (l) => ({
          ...l,
          items: ungroupItems(l.items, action.groupId),
        }))
      );

    case 'REORDER_ITEMS':
      return stamp(
        mapLayer(state, action.layerId, (l) => ({
          ...l,
          items: action.groupId
            ? reorderWithinGroup(l.items, action.groupId, action.orderedIds)
            : reorderById(l.items, action.orderedIds),
        }))
      );

    case 'ADD_ANNOTATION':
      return stamp(
        mapLayer(state, action.layerId, (l) => ({
          ...l,
          annotations: [...l.annotations, action.annotation],
        }))
      );

    case 'DELETE_ANNOTATION':
      return stamp(
        mapLayer(state, action.layerId, (l) => ({
          ...l,
          annotations: l.annotations.filter(
            (a) => a.id !== action.annotationId
          ),
        }))
      );

    case 'UPDATE_VIEWPORT':
      return { ...state, viewport: { ...state.viewport, ...action.patch } };

    case 'UPDATE_GRID_CONFIG':
      return stamp({
        ...state,
        gridConfig: { ...state.gridConfig, ...action.patch },
      });

    case 'UPDATE_METADATA':
      return stamp({ ...state, ...action.patch });

    case 'LOAD_DOCUMENT':
      return action.document;

    case 'TRANSLATE_SHAPES': {
      const ids = new Set(action.shapeIds);
      return stamp(
        mapLayer(state, action.layerId, (l) => ({
          ...l,
          items: mapItemsDeep(l.items, (item) => {
            if (ids.has(item.id) && item.type !== 'group') {
              return translateShape(item, action.dx, action.dy);
            }
            return item;
          }),
        }))
      );
    }

    case 'UPDATE_SHAPE_STYLE':
      return stamp(
        mapLayer(state, action.layerId, (l) => ({
          ...l,
          items: mapItemsDeep(l.items, (item) => {
            if (item.id !== action.shapeId || item.type === 'group')
              return item;
            return { ...item, ...action.patch };
          }),
        }))
      );

    case 'UPDATE_SHAPE_KEY':
      return stamp(
        mapLayer(state, action.layerId, (l) => ({
          ...l,
          items: mapItemsDeep(l.items, (item) => {
            if (item.id !== action.shapeId) return item;
            if (action.key === undefined) {
              const { key: _removed, ...rest } = item as typeof item & {
                key?: string;
              };
              return rest as LayerItem;
            }
            return { ...item, key: action.key };
          }),
        }))
      );

    case 'UPDATE_SHAPE_LABEL':
      return stamp(
        mapLayer(state, action.layerId, (l) => ({
          ...l,
          items: mapItemsDeep(l.items, (item) => {
            if (item.id !== action.shapeId) return item;
            if (!action.label) {
              const { label: _removed, ...rest } = item as typeof item & {
                label?: string;
              };
              return rest as LayerItem;
            }
            return { ...item, label: action.label };
          }),
        }))
      );

    default:
      return state;
  }
}

// --- Public API ---

export function createDocument(
  overrides?: Partial<DrawingDocument>
): DrawingDocument {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: 'Untitled',
    createdAt: now,
    updatedAt: now,
    viewport: { zoom: 1, panOffset: { x: 0, y: 0 } },
    gridConfig: { majorEvery: 5, snapToGrid: true, cellSize: 1 },
    layers: [
      {
        id: crypto.randomUUID(),
        name: 'Layer 1',
        visible: true,
        locked: false,
        items: [],
        annotations: [],
      },
    ],
    ...overrides,
  };
}

export function useDrawingState(initialDocument: DrawingDocument) {
  return useReducer(reducer, initialDocument);
}

/**
 * Returns the set of all `key` values used across every shape/group in the
 * document. Pass `excludeId` to omit the currently-selected shape so it
 * doesn't block re-confirming its own key.
 */
export function collectKeys(
  doc: DrawingDocument,
  excludeId?: string
): Set<string> {
  const keys = new Set<string>();

  function walk(items: LayerItem[]): void {
    for (const item of items) {
      if (item.id !== excludeId && item.key !== undefined) {
        keys.add(item.key);
      }
      if (item.type === 'group') walk(item.children);
    }
  }

  for (const layer of doc.layers) walk(layer.items);
  return keys;
}
