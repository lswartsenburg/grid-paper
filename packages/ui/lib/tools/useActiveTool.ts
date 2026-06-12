'use client';

import { useReducer, useRef } from 'react';
import type { VectorShape, Point } from '../../types/canvas';
import type { DrawingAction } from '../../lib/drawing/useDrawingState';
import { snapToGrid } from '../../lib/canvas/coordinates';
import type { ToolType, ToolSettings } from './types';
import { DEFAULT_TOOL_SETTINGS } from './types';

interface State {
  toolType: ToolType;
  settings: ToolSettings;
  anchor: Point | null;
  preview: VectorShape | null;
  polylinePoints: Point[];
}

type LocalAction =
  | { type: 'SET_TOOL'; toolType: ToolType }
  | { type: 'UPDATE_SETTINGS'; patch: Partial<ToolSettings> }
  | { type: 'SET_ANCHOR'; anchor: Point | null }
  | { type: 'SET_PREVIEW'; preview: VectorShape | null }
  | { type: 'ADD_POLYLINE_POINT'; point: Point }
  | { type: 'CLEAR' };

const initial: State = {
  toolType: 'line',
  settings: DEFAULT_TOOL_SETTINGS,
  anchor: null,
  preview: null,
  polylinePoints: [],
};

function reducer(state: State, action: LocalAction): State {
  switch (action.type) {
    case 'SET_TOOL':
      return {
        ...state,
        toolType: action.toolType,
        anchor: null,
        preview: null,
        polylinePoints: [],
      };
    case 'UPDATE_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.patch } };
    case 'SET_ANCHOR':
      return { ...state, anchor: action.anchor };
    case 'SET_PREVIEW':
      return { ...state, preview: action.preview };
    case 'ADD_POLYLINE_POINT':
      return {
        ...state,
        polylinePoints: [...state.polylinePoints, action.point],
      };
    case 'CLEAR':
      return { ...state, anchor: null, preview: null, polylinePoints: [] };
    default:
      return state;
  }
}

function dist(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function rectFromCorners(a: Point, b: Point) {
  return {
    origin: { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y) },
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
  };
}

export function useActiveTool(
  dispatch: React.Dispatch<DrawingAction>,
  activeLayerId: string | null
) {
  const [state, local] = useReducer(reducer, initial);
  const { toolType, settings, anchor, preview, polylinePoints } = state;
  const lastDownTimeRef = useRef(0);

  function snapPos(p: Point): Point {
    return settings.snapEnabled ? snapToGrid(p, settings.snapStep) : p;
  }

  // Rounds a scalar distance to the nearest snap step (used for circle radius).
  function snapRadius(r: number): number {
    return settings.snapEnabled
      ? Math.max(
          settings.snapStep,
          Math.round(r / settings.snapStep) * settings.snapStep
        )
      : r;
  }

  function base() {
    return {
      strokeColor: settings.strokeColor,
      strokeWidth: settings.strokeWidth,
    };
  }

  function commit(shape: VectorShape) {
    if (!activeLayerId) return;
    dispatch({ type: 'ADD_SHAPE', layerId: activeLayerId, shape });
    local({ type: 'CLEAR' });
  }

  function finishPolyline(points: Point[]) {
    if (points.length < 2) {
      local({ type: 'CLEAR' });
      return;
    }
    commit({ ...base(), id: crypto.randomUUID(), type: 'polyline', points });
  }

  function handlePointerDown(rawPos: Point) {
    if (!activeLayerId) return;
    const pos = snapPos(rawPos);

    // Double-click detection for polyline finish
    const now = Date.now();
    const isDouble =
      toolType === 'polyline' && now - lastDownTimeRef.current < 300;
    lastDownTimeRef.current = now;

    if (isDouble) {
      finishPolyline(polylinePoints);
      return;
    }

    switch (toolType) {
      case 'line':
      case 'circle':
      case 'rect':
        local({ type: 'SET_ANCHOR', anchor: pos });
        break;
      case 'freehand':
        local({ type: 'SET_ANCHOR', anchor: pos });
        local({
          type: 'SET_PREVIEW',
          preview: {
            ...base(),
            id: 'preview',
            type: 'freehand',
            points: [pos],
          },
        });
        break;
      case 'polyline': {
        const next = [...polylinePoints, pos];
        local({ type: 'ADD_POLYLINE_POINT', point: pos });
        local({
          type: 'SET_PREVIEW',
          preview: { ...base(), id: 'preview', type: 'polyline', points: next },
        });
        break;
      }
    }
  }

  function handlePointerMove(rawPos: Point) {
    if (!activeLayerId) return;
    const pos = snapPos(rawPos);

    switch (toolType) {
      case 'line':
        if (!anchor) return;
        local({
          type: 'SET_PREVIEW',
          preview: {
            ...base(),
            id: 'preview',
            type: 'line',
            points: [anchor, pos],
          },
        });
        break;
      case 'circle':
        if (!anchor) return;
        local({
          type: 'SET_PREVIEW',
          preview: {
            ...base(),
            id: 'preview',
            type: 'circle',
            center: anchor,
            radius: Math.max(0.01, snapRadius(dist(anchor, pos))),
            fillColor: settings.fillColor,
          },
        });
        break;
      case 'rect': {
        if (!anchor) return;
        const { origin, width, height } = rectFromCorners(anchor, pos);
        local({
          type: 'SET_PREVIEW',
          preview: {
            ...base(),
            id: 'preview',
            type: 'rect',
            origin,
            width: Math.max(0.01, width),
            height: Math.max(0.01, height),
            fillColor: settings.fillColor,
          },
        });
        break;
      }
      case 'freehand':
        if (!preview || preview.type !== 'freehand') return;
        local({
          type: 'SET_PREVIEW',
          preview: { ...preview, points: [...preview.points, pos] },
        });
        break;
    }
  }

  function handlePointerUp(rawPos: Point) {
    if (!activeLayerId) return;
    const pos = snapPos(rawPos);

    switch (toolType) {
      case 'line':
        if (!anchor || dist(anchor, pos) < 0.01) {
          local({ type: 'CLEAR' });
          return;
        }
        commit({
          ...base(),
          id: crypto.randomUUID(),
          type: 'line',
          points: [anchor, pos],
        });
        break;
      case 'circle': {
        if (!anchor) return;
        const r = snapRadius(dist(anchor, pos));
        if (r < 0.01) {
          local({ type: 'CLEAR' });
          return;
        }
        commit({
          ...base(),
          id: crypto.randomUUID(),
          type: 'circle',
          center: anchor,
          radius: r,
          fillColor: settings.fillColor,
        });
        break;
      }
      case 'rect': {
        if (!anchor) return;
        const { origin, width, height } = rectFromCorners(anchor, pos);
        if (width < 0.01 || height < 0.01) {
          local({ type: 'CLEAR' });
          return;
        }
        commit({
          ...base(),
          id: crypto.randomUUID(),
          type: 'rect',
          origin,
          width,
          height,
          fillColor: settings.fillColor,
        });
        break;
      }
      case 'freehand':
        if (
          !preview ||
          preview.type !== 'freehand' ||
          preview.points.length < 2
        ) {
          local({ type: 'CLEAR' });
          return;
        }
        commit({
          ...base(),
          id: crypto.randomUUID(),
          type: 'freehand',
          points: preview.points,
        });
        break;
      // Polyline is committed via double-click, not pointer-up
    }
  }

  return {
    toolType,
    settings,
    preview,
    setTool: (t: ToolType) => local({ type: 'SET_TOOL', toolType: t }),
    updateSettings: (patch: Partial<ToolSettings>) =>
      local({ type: 'UPDATE_SETTINGS', patch }),
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  };
}
