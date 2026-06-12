'use client';

import {
  useMemo,
  useState,
  useCallback,
  useEffect,
  useRef,
  useLayoutEffect,
} from 'react';
import { createDocument, collectKeys } from '../../lib/drawing/useDrawingState';
import { useCanvasHistory } from '../../lib/drawing/useCanvasHistory';
import {
  loadFromStorage,
  useStorageAdapter,
} from '../../lib/storage/useStorageAdapter';
import { useActiveTool } from '../../lib/tools/useActiveTool';
import { hitTestDocument, shapeBounds } from '../../lib/canvas/hitTest';
import { BASE_UNIT, snapToGrid, zoomAround } from '../../lib/canvas/coordinates';
import GridCanvas from './GridCanvas';
import ShapeRenderer from './ShapeRenderer';
import PreviewLayer from './PreviewLayer';
import SelectionOverlay from './SelectionOverlay';
import Toolbar from '../toolbar/Toolbar';
import LayerManager from '../layers/LayerManager';
import YamlEditor from '../editor/YamlEditor';
import PropertiesPanel from '../properties/PropertiesPanel';
import ContextMenu from './ContextMenu';
import BottomBar from './BottomBar';
import RightSidebar from '../sidebar/RightSidebar';
import type { SidebarPanel } from '../sidebar/RightSidebar';
import type {
  CircleShape,
  DrawingDocument,
  LayerItem,
  LineShape,
  Point,
  RectShape,
  VectorShape,
} from '../../types/canvas';

// ─── Resize helpers ───────────────────────────────────────────────────────────

/** Screen-pixel radius used to snap onto a corner handle. */
const CORNER_HIT_PX = 12;

/** SelectionOverlay renders corner handles with this inset/outset in grid units. */
const CORNER_PAD = 0.25;

type ResizeCorner = 'tl' | 'tr' | 'bl' | 'br';

/**
 * Returns which corner of the selection bounds the pointer is near, or null.
 * Uses the same screen-pixel formula as hitTest.ts: threshold = PX / (BASE_UNIT * zoom).
 */
function hitTestCorners(
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  pos: Point,
  zoom: number
): ResizeCorner | null {
  const threshold = CORNER_HIT_PX / (BASE_UNIT * zoom);
  const corners: Array<{ id: ResizeCorner; x: number; y: number }> = [
    { id: 'tl', x: bounds.minX - CORNER_PAD, y: bounds.minY - CORNER_PAD },
    { id: 'tr', x: bounds.maxX + CORNER_PAD, y: bounds.minY - CORNER_PAD },
    { id: 'br', x: bounds.maxX + CORNER_PAD, y: bounds.maxY + CORNER_PAD },
    { id: 'bl', x: bounds.minX - CORNER_PAD, y: bounds.maxY + CORNER_PAD },
  ];
  for (const c of corners) {
    if (Math.hypot(pos.x - c.x, pos.y - c.y) <= threshold) return c.id;
  }
  return null;
}

const MIN_RECT_SIZE = 0.5; // grid units — prevents collapsing to zero

/** CSS cursor values for each resize corner. */
const CORNER_CURSORS: Record<ResizeCorner, string> = {
  tl: 'nwse-resize',
  tr: 'nesw-resize',
  br: 'nwse-resize',
  bl: 'nesw-resize',
};

/**
 * Returns the new origin/width/height for a rect being dragged by one corner.
 * The opposite corner stays fixed; the dragged corner tracks the pointer.
 */
function computeResizedRect(
  original: RectShape,
  corner: ResizeCorner,
  pos: Point
): Pick<RectShape, 'origin' | 'width' | 'height'> {
  const { origin: o, width: w, height: h } = original;
  const fixedX = o.x + w; // right edge
  const fixedY = o.y + h; // bottom edge
  switch (corner) {
    case 'br':
      return {
        origin: o,
        width: Math.max(MIN_RECT_SIZE, pos.x - o.x),
        height: Math.max(MIN_RECT_SIZE, pos.y - o.y),
      };
    case 'bl': {
      const newX = Math.min(pos.x, fixedX - MIN_RECT_SIZE);
      return {
        origin: { x: newX, y: o.y },
        width: Math.max(MIN_RECT_SIZE, fixedX - pos.x),
        height: Math.max(MIN_RECT_SIZE, pos.y - o.y),
      };
    }
    case 'tr': {
      const newY = Math.min(pos.y, fixedY - MIN_RECT_SIZE);
      return {
        origin: { x: o.x, y: newY },
        width: Math.max(MIN_RECT_SIZE, pos.x - o.x),
        height: Math.max(MIN_RECT_SIZE, fixedY - pos.y),
      };
    }
    case 'tl': {
      const newX = Math.min(pos.x, fixedX - MIN_RECT_SIZE);
      const newY = Math.min(pos.y, fixedY - MIN_RECT_SIZE);
      return {
        origin: { x: newX, y: newY },
        width: Math.max(MIN_RECT_SIZE, fixedX - pos.x),
        height: Math.max(MIN_RECT_SIZE, fixedY - pos.y),
      };
    }
  }
}

const MIN_CIRCLE_RADIUS = 0.5;

/**
 * Returns which of a line's two endpoints is closest to the given corner of
 * its bounding box. Used to decide which endpoint a corner drag moves.
 */
function lineEndpointForCorner(
  line: LineShape,
  corner: ResizeCorner,
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
): 0 | 1 {
  const cp = {
    tl: { x: bounds.minX - CORNER_PAD, y: bounds.minY - CORNER_PAD },
    tr: { x: bounds.maxX + CORNER_PAD, y: bounds.minY - CORNER_PAD },
    br: { x: bounds.maxX + CORNER_PAD, y: bounds.maxY + CORNER_PAD },
    bl: { x: bounds.minX - CORNER_PAD, y: bounds.maxY + CORNER_PAD },
  }[corner];
  const d0 = Math.hypot(line.points[0].x - cp.x, line.points[0].y - cp.y);
  const d1 = Math.hypot(line.points[1].x - cp.x, line.points[1].y - cp.y);
  return d0 <= d1 ? 0 : 1;
}

/**
 * Moves one endpoint of a line to `pos`, leaving the other fixed.
 */
function computeResizedLine(
  original: LineShape,
  endpointIdx: 0 | 1,
  pos: Point
): LineShape {
  const newPoints: [Point, Point] = [original.points[0], original.points[1]];
  newPoints[endpointIdx] = pos;
  return { ...original, points: newPoints };
}

/**
 * Resizes a circle so its bounding-box corner tracks the pointer.
 * The center stays fixed; the new radius = max(|Δx|, |Δy|) from center.
 */
function computeResizedCircle(
  original: CircleShape,
  pos: Point
): CircleShape {
  const newRadius = Math.max(
    MIN_CIRCLE_RADIUS,
    Math.max(
      Math.abs(pos.x - original.center.x),
      Math.abs(pos.y - original.center.y)
    )
  );
  return { ...original, radius: newRadius };
}

export default function CanvasEditor() {
  const initialDoc = useMemo(() => loadFromStorage() ?? createDocument(), []);
  const { doc, dispatch, undo, redo, canUndo, canRedo } = useCanvasHistory(initialDoc);
  const [activePanel, setActivePanel] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  function togglePanel(id: string) {
    setActivePanel((prev) => (prev === id ? null : id));
  }

  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(
    () => initialDoc.layers[0]?.id ?? null
  );
  // Derive active drawing layer: fall back to first layer if the selected one was deleted.
  const activeLayerId = doc.layers.some((l) => l.id === selectedLayerId)
    ? selectedLayerId
    : (doc.layers[0]?.id ?? null);

  // --- Selection state (React state for rendering; refs for stable event callbacks) ---
  const [selectionLayerId, setSelectionLayerId] = useState<string | null>(null);
  const [selectedShapeIds, setSelectedShapeIds] = useState<string[]>([]);
  // Display-only: drives SelectionOverlay position during a drag.
  const [dragDelta, setDragDelta] = useState<Point>({ x: 0, y: 0 });

  // Refs read synchronously inside pointer handlers — no stale-closure risk.
  const selectionLayerIdRef = useRef<string | null>(null);
  const selectedShapeIdsRef = useRef<string[]>([]);
  // Reflects the latest resolved selectedShapes array (avoids re-deriving in handlers).
  const selectedShapesRef = useRef<VectorShape[]>([]);
  const dragOriginRef = useRef<Point | null>(null);
  // Accumulates grid-unit delta without waiting for React re-renders.
  const dragAccumRef = useRef<Point>({ x: 0, y: 0 });
  // Always reflects the latest doc so hitTest reads current state.
  const docRef = useRef(doc);

  // Canvas cursor — updated on hover and during drag/resize.
  const [canvasCursor, setCanvasCursor] = useState('crosshair');
  // Ref-backed dedup so pointermove doesn't trigger re-renders when cursor is unchanged.
  const canvasCursorRef = useRef('crosshair');
  function updateCursor(next: string) {
    if (canvasCursorRef.current !== next) {
      canvasCursorRef.current = next;
      setCanvasCursor(next);
    }
  }

  // Resize state — refs for synchronous handler logic, state for rendering.
  const resizeCornerRef = useRef<ResizeCorner | null>(null);
  const resizeOriginalRef = useRef<VectorShape | null>(null);
  const resizePreviewRef = useRef<VectorShape | null>(null);
  const [resizePreview, setResizePreview] = useState<VectorShape | null>(null);
  // For line resize: which endpoint (0 or 1) the active corner drag moves.
  const resizeLineEndpointRef = useRef<0 | 1 | null>(null);

  useLayoutEffect(() => {
    docRef.current = doc;
    selectionLayerIdRef.current = selectionLayerId;
    selectedShapeIdsRef.current = selectedShapeIds;
    snapSettingsRef.current = tool.settings;
  });

  const clearSelection = useCallback(() => {
    selectionLayerIdRef.current = null;
    selectedShapeIdsRef.current = [];
    selectedShapesRef.current = [];
    dragOriginRef.current = null;
    dragAccumRef.current = { x: 0, y: 0 };
    resizeCornerRef.current = null;
    resizeOriginalRef.current = null;
    resizePreviewRef.current = null;
    resizeLineEndpointRef.current = null;
    setSelectionLayerId(null);
    setSelectedShapeIds([]);
    setDragDelta({ x: 0, y: 0 });
    setResizePreview(null);
    updateCursor('default');
  }, []);

  const tool = useActiveTool(dispatch, activeLayerId);
  useStorageAdapter(doc);

  // Keeps the latest snap settings available inside stable pointer callbacks.
  const snapSettingsRef = useRef(tool.settings);

  // --- Context menu state ---
  const [contextMenuPos, setContextMenuPos] = useState<{
    x: number;
    y: number;
  } | null>(null);

  /**
   * Reorders the selected shape within its layer.
   * Uses refs so the callback stays stable regardless of doc/selection changes.
   */
  const dispatchZOrder = useCallback(
    (mode: 'backward' | 'forward' | 'back' | 'front') => {
      const layerId = selectionLayerIdRef.current;
      const shapeIds = selectedShapeIdsRef.current;
      if (!layerId || shapeIds.length !== 1) return;
      const shapeId = shapeIds[0];

      const layer = docRef.current.layers.find((l) => l.id === layerId);
      if (!layer) return;

      const ids = layer.items.map((i) => i.id);
      const idx = ids.indexOf(shapeId);
      if (idx === -1) return;

      let newIds: string[];
      switch (mode) {
        case 'backward':
          if (idx === 0) return;
          newIds = [...ids];
          [newIds[idx - 1], newIds[idx]] = [newIds[idx], newIds[idx - 1]];
          break;
        case 'forward':
          if (idx === ids.length - 1) return;
          newIds = [...ids];
          [newIds[idx], newIds[idx + 1]] = [newIds[idx + 1], newIds[idx]];
          break;
        case 'back':
          newIds = [shapeId, ...ids.filter((id) => id !== shapeId)];
          break;
        case 'front':
          newIds = [...ids.filter((id) => id !== shapeId), shapeId];
          break;
        default:
          return;
      }

      dispatch({ type: 'REORDER_ITEMS', layerId, orderedIds: newIds });
      setContextMenuPos(null);
    },
    [dispatch]
  );

  // --- Selection pointer handlers (stable; read latest values via refs) ---
  const handleSelectPointerDown = useCallback(
    (pos: Point) => {
      const d = docRef.current;

      // Check corners first if exactly one resizable shape is selected.
      const currentShapes = selectedShapesRef.current;
      if (currentShapes.length === 1) {
        const shape = currentShapes[0];
        if (
          shape.type === 'rect' ||
          shape.type === 'line' ||
          shape.type === 'circle'
        ) {
          const bounds = shapeBounds(currentShapes);
          if (bounds) {
            const corner = hitTestCorners(bounds, pos, d.viewport.zoom);
            if (corner) {
              resizeCornerRef.current = corner;
              resizeOriginalRef.current = shape;
              dragOriginRef.current = pos;
              if (shape.type === 'line') {
                resizeLineEndpointRef.current = lineEndpointForCorner(
                  shape,
                  corner,
                  bounds
                );
              }
              updateCursor(CORNER_CURSORS[corner]);
              return; // keep existing selection, begin resize
            }
          }
        }
      }

      const hit = hitTestDocument(d, pos, d.viewport.zoom);
      if (hit) {
        selectionLayerIdRef.current = hit.layerId;
        selectedShapeIdsRef.current = [hit.shapeId];
        dragOriginRef.current = pos;
        dragAccumRef.current = { x: 0, y: 0 };
        setSelectionLayerId(hit.layerId);
        setSelectedShapeIds([hit.shapeId]);
        updateCursor('grabbing');
      } else {
        clearSelection();
      }
    },
    [clearSelection]
  );

  const handleSelectPointerMove = useCallback((pos: Point) => {
    // Active resize mode.
    if (
      resizeCornerRef.current !== null &&
      resizeOriginalRef.current !== null
    ) {
      const { snapEnabled, snapStep } = snapSettingsRef.current;
      const snappedPos = snapEnabled ? snapToGrid(pos, snapStep) : pos;
      const original = resizeOriginalRef.current;
      let preview: VectorShape;
      if (original.type === 'rect') {
        preview = {
          ...original,
          ...computeResizedRect(original, resizeCornerRef.current, snappedPos),
        };
      } else if (original.type === 'line') {
        preview = computeResizedLine(
          original,
          resizeLineEndpointRef.current!,
          snappedPos
        );
      } else if (original.type === 'circle') {
        preview = computeResizedCircle(original, snappedPos);
      } else {
        return;
      }
      resizePreviewRef.current = preview;
      setResizePreview(preview);
      return;
    }

    // Active translate mode.
    if (dragOriginRef.current !== null) {
      const dx = pos.x - dragOriginRef.current.x;
      const dy = pos.y - dragOriginRef.current.y;
      dragAccumRef.current = { x: dx, y: dy };
      setDragDelta({ x: dx, y: dy }); // drives overlay display only
      return;
    }

    // Idle hover: update cursor to signal what a drag would do.
    const d = docRef.current;
    const shapes = selectedShapesRef.current;
    if (shapes.length === 1) {
      const s = shapes[0];
      if (s.type === 'rect' || s.type === 'line' || s.type === 'circle') {
        const bounds = shapeBounds(shapes);
        if (bounds) {
          const corner = hitTestCorners(bounds, pos, d.viewport.zoom);
          if (corner) {
            updateCursor(CORNER_CURSORS[corner]);
            return;
          }
        }
      }
    }
    if (shapes.length > 0) {
      const hit = hitTestDocument(d, pos, d.viewport.zoom);
      if (hit && selectedShapeIdsRef.current.includes(hit.shapeId)) {
        updateCursor('grab');
        return;
      }
    }
    updateCursor('default');
  }, []);

  const handleSelectPointerUp = useCallback(() => {
    // Commit a resize as a single undo entry.
    if (resizeCornerRef.current !== null) {
      const layerId = selectionLayerIdRef.current;
      const committed = resizePreviewRef.current;
      if (layerId && committed) {
        dispatch({ type: 'REPLACE_SHAPE', layerId, shape: committed });
      }
      resizeCornerRef.current = null;
      resizeOriginalRef.current = null;
      resizePreviewRef.current = null;
      resizeLineEndpointRef.current = null;
      dragOriginRef.current = null;
      setResizePreview(null);
      updateCursor('default');
      return;
    }

    // Commit a translate.
    const { x: dx, y: dy } = dragAccumRef.current;
    const layerId = selectionLayerIdRef.current;
    const shapeIds = selectedShapeIdsRef.current;
    if (layerId && shapeIds.length > 0 && (dx !== 0 || dy !== 0)) {
      dispatch({ type: 'TRANSLATE_SHAPES', layerId, shapeIds, dx, dy });
    }
    dragAccumRef.current = { x: 0, y: 0 };
    dragOriginRef.current = null;
    setDragDelta({ x: 0, y: 0 });
    // Return to grab if still hovering over the shape; reset for simplicity.
    updateCursor('default');
  }, [dispatch]);

  // --- Right-click context menu ---
  const handleCanvasContextMenu = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (tool.toolType !== 'select') return;
      const rect = e.currentTarget.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const d = docRef.current;
      const gridPos = {
        x: (screenX - d.viewport.panOffset.x) / (BASE_UNIT * d.viewport.zoom),
        y: (screenY - d.viewport.panOffset.y) / (BASE_UNIT * d.viewport.zoom),
      };
      const hit = hitTestDocument(d, gridPos, d.viewport.zoom);
      if (hit) {
        // Select the hit shape if it isn't already.
        if (!selectedShapeIdsRef.current.includes(hit.shapeId)) {
          selectionLayerIdRef.current = hit.layerId;
          selectedShapeIdsRef.current = [hit.shapeId];
          setSelectionLayerId(hit.layerId);
          setSelectedShapeIds([hit.shapeId]);
        }
        setContextMenuPos({ x: screenX, y: screenY });
      } else {
        setContextMenuPos(null);
      }
    },
    [tool.toolType]
  );

  // --- Keyboard shortcuts ---
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      if (mod && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
        return;
      }
      const focusedTag = (document.activeElement as HTMLElement)?.tagName;
      const isEditingText =
        focusedTag === 'INPUT' || focusedTag === 'TEXTAREA' || (document.activeElement as HTMLElement)?.isContentEditable;
      if (
        (e.key === 'Delete' || e.key === 'Backspace') &&
        !isEditingText &&
        selectionLayerId &&
        selectedShapeIds.length > 0
      ) {
        e.preventDefault();
        selectedShapeIds.forEach((shapeId) =>
          dispatch({ type: 'DELETE_SHAPE', layerId: selectionLayerId, shapeId })
        );
        clearSelection();
        return;
      }
      if (e.key === 'Escape') {
        clearSelection();
        setContextMenuPos(null);
        return;
      }
      // Tool shortcuts (only when not typing in an input)
      if (!isEditingText) {
        if (e.key === 'v' || e.key === 'V') { tool.setTool('select'); return; }
        if (e.key === 'h' || e.key === 'H') { tool.setTool('hand'); return; }
      }
      // Z-order shortcuts (single selected shape, select tool only)
      if (mod && (e.key === '[' || e.key === ']') && selectionLayerId && selectedShapeIds.length === 1) {
        e.preventDefault();
        if (e.key === '[') dispatchZOrder(e.altKey ? 'back' : 'backward');
        else dispatchZOrder(e.altKey ? 'front' : 'forward');
        return;
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    undo,
    redo,
    selectionLayerId,
    selectedShapeIds,
    dispatch,
    clearSelection,
    dispatchZOrder,
    tool,
  ]);

  // When the YAML editor produces a fully-parsed document, replace state entirely.
  const handleYamlDocument = useCallback(
    (next: DrawingDocument) => {
      dispatch({ type: 'UPDATE_METADATA', patch: { title: next.title } });
      dispatch({ type: 'UPDATE_GRID_CONFIG', patch: next.gridConfig });
      doc.layers.forEach((l) =>
        dispatch({ type: 'DELETE_LAYER', layerId: l.id })
      );
      next.layers.forEach((l) => dispatch({ type: 'ADD_LAYER', layer: l }));
      setSelectedLayerId(next.layers[0]?.id ?? null);
    },
    [doc.layers, dispatch]
  );

  // --- Derive selected shapes for the overlay and properties panel ---
  const selectedShapes = useMemo((): VectorShape[] => {
    if (!selectionLayerId || selectedShapeIds.length === 0) return [];
    const layer = doc.layers.find((l) => l.id === selectionLayerId);
    if (!layer) return [];
    const ids = new Set(selectedShapeIds);
    const result: VectorShape[] = [];
    function collect(items: LayerItem[]) {
      for (const item of items) {
        if (item.type === 'group') {
          collect(item.children);
          continue;
        }
        if (ids.has(item.id)) result.push(item);
      }
    }
    collect(layer.items);
    // Keep ref in sync so corner hit-test in handleSelectPointerDown sees current shapes.
    selectedShapesRef.current = result;
    return result;
  }, [doc, selectionLayerId, selectedShapeIds]);

  // Keys already in use by every shape except the one currently selected.
  const existingKeys = useMemo(
    () => collectKeys(doc, selectedShapes[0]?.id),
    [doc, selectedShapes]
  );

  // --- Route pointer events based on active tool ---
  const isSelectTool = tool.toolType === 'select';
  const isHandTool = tool.toolType === 'hand';

  // Track Space key so we can show a grab cursor while panning with Space.
  const [isSpaceDown, setIsSpaceDown] = useState(false);
  useEffect(() => {
    function onDown(e: KeyboardEvent) {
      if (e.code === 'Space' && !e.repeat) {
        const tag = (document.activeElement as HTMLElement)?.tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA') setIsSpaceDown(true);
      }
    }
    function onUp(e: KeyboardEvent) {
      if (e.code === 'Space') setIsSpaceDown(false);
    }
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, []);

  // Track active pan gesture so we can switch between grab and grabbing.
  const [isPanning, setIsPanning] = useState(false);
  const handlePanStart = useCallback(() => setIsPanning(true), []);
  const handlePanEnd = useCallback(() => setIsPanning(false), []);

  // Compute the effective canvas cursor, overriding the drawing-tool cursor
  // whenever the user is in a pan mode (hand tool, space held, or mid-click).
  const isPanCursor = isHandTool || isSpaceDown;
  const effectiveCursor = isPanCursor
    ? isPanning ? 'grabbing' : 'grab'
    : canvasCursor;

  // When switching away from the select tool, revert to crosshair.
  useEffect(() => {
    if (!isSelectTool && !isHandTool) updateCursor('crosshair');
    if (isSelectTool) updateCursor('default');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSelectTool, isHandTool]);
  const activeLayer = doc.layers.find((l) => l.id === activeLayerId);
  const toolReady = !isSelectTool && !isHandTool && !!activeLayer && !activeLayer.locked;

  const pointerDown = isSelectTool
    ? handleSelectPointerDown
    : toolReady
      ? tool.handlePointerDown
      : undefined;
  const pointerMove = isSelectTool
    ? handleSelectPointerMove
    : toolReady
      ? (pos: Point) => tool.handlePointerMove(pos)
      : undefined;
  const pointerUp = isSelectTool
    ? handleSelectPointerUp
    : toolReady
      ? tool.handlePointerUp
      : undefined;

  // --- Sidebar panels ---
  const panels: SidebarPanel[] = [
    {
      id: 'layers',
      label: 'Layers',
      icon: (
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        >
          <rect x="2" y="10" width="12" height="3" rx="0.5" />
          <rect x="2" y="6.5" width="12" height="3" rx="0.5" />
          <rect x="2" y="3" width="12" height="3" rx="0.5" />
        </svg>
      ),
      content: (
        <LayerManager
          layers={doc.layers}
          activeLayerId={activeLayerId}
          onSetActive={setSelectedLayerId}
          dispatch={dispatch}
        />
      ),
    },
    {
      id: 'yaml',
      label: 'YAML',
      icon: (
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="5,4 2,8 5,12" />
          <polyline points="11,4 14,8 11,12" />
          <line x1="9" y1="3" x2="7" y2="13" />
        </svg>
      ),
      content: (
        <YamlEditor document={doc} onDocumentChange={handleYamlDocument} />
      ),
    },
  ];

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Canvas area — toolbar floats at top center */}
      <div ref={containerRef} className="relative flex flex-1 overflow-hidden">
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none flex flex-col items-center gap-2">
          <div className="pointer-events-auto">
            <Toolbar activeTool={tool.toolType} onSetTool={tool.setTool} />
          </div>
          <p className="text-xs text-zinc-400 select-none whitespace-nowrap">
            To move canvas: hold <kbd className="font-mono bg-zinc-100 border border-zinc-300 rounded px-1">Space</kbd>, scroll wheel, or use the hand tool&nbsp;(<kbd className="font-mono bg-zinc-100 border border-zinc-300 rounded px-1">H</kbd>)
          </p>
        </div>

        <GridCanvas
          viewport={doc.viewport}
          majorEvery={doc.gridConfig.majorEvery}
          onViewportChange={(patch) =>
            dispatch({ type: 'UPDATE_VIEWPORT', patch })
          }
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={pointerUp}
          onContextMenu={handleCanvasContextMenu}
          isPanMode={isHandTool}
          onPanStart={handlePanStart}
          onPanEnd={handlePanEnd}
          cursorStyle={effectiveCursor}
        >
          {/* Hide the original shape while a resize preview is active. */}
          <ShapeRenderer
            document={doc}
            viewport={doc.viewport}
            hiddenIds={resizePreview ? new Set([resizePreview.id]) : undefined}
          />
          {toolReady && tool.preview && (
            <PreviewLayer shape={tool.preview} viewport={doc.viewport} />
          )}
          {/* Live resize preview: dashed ghost at the prospective new bounds. */}
          {resizePreview && (
            <PreviewLayer shape={resizePreview} viewport={doc.viewport} />
          )}
          {/* Overlay tracks the preview during resize, the translate delta otherwise. */}
          {(selectedShapes.length > 0 || resizePreview) && (
            <SelectionOverlay
              shapes={resizePreview ? [resizePreview] : selectedShapes}
              dragDelta={resizePreview ? { x: 0, y: 0 } : dragDelta}
              viewport={doc.viewport}
            />
          )}
        </GridCanvas>

        {/* Z-order context menu — shown on right-click over a shape */}
        {contextMenuPos && selectedShapes.length === 1 && (
          <ContextMenu
            x={contextMenuPos.x}
            y={contextMenuPos.y}
            onClose={() => setContextMenuPos(null)}
            sections={[
              {
                items: [
                  {
                    label: 'Send backward',
                    shortcut: '⌘[',
                    onClick: () => dispatchZOrder('backward'),
                  },
                  {
                    label: 'Bring forward',
                    shortcut: '⌘]',
                    onClick: () => dispatchZOrder('forward'),
                  },
                  {
                    label: 'Send to back',
                    shortcut: '⌘⌥[',
                    onClick: () => dispatchZOrder('back'),
                  },
                  {
                    label: 'Bring to front',
                    shortcut: '⌘⌥]',
                    onClick: () => dispatchZOrder('front'),
                  },
                ],
              },
            ]}
          />
        )}

        {/* Floating properties panel — visible only when a shape is selected */}
        {selectedShapes.length > 0 && (
          <div className="absolute left-3 top-20 z-10 w-52 bg-white rounded-xl border border-zinc-200 shadow-lg overflow-hidden pointer-events-auto">
            <PropertiesPanel
              shape={selectedShapes[0]}
              layerId={selectionLayerId}
              dispatch={dispatch}
              existingKeys={existingKeys}
            />
          </div>
        )}

        <BottomBar
          zoom={doc.viewport.zoom}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={undo}
          onRedo={redo}
          onZoomChange={(newZoom) => {
            const el = containerRef.current;
            if (el) {
              const { width, height } = el.getBoundingClientRect();
              const center = { x: width / 2, y: height / 2 };
              dispatch({
                type: 'UPDATE_VIEWPORT',
                patch: {
                  zoom: newZoom,
                  panOffset: zoomAround(center, doc.viewport.zoom, newZoom, doc.viewport.panOffset),
                },
              });
            } else {
              dispatch({ type: 'UPDATE_VIEWPORT', patch: { zoom: newZoom } });
            }
          }}
        />
      </div>

      <RightSidebar
        panels={panels}
        activePanel={activePanel}
        onTogglePanel={togglePanel}
      />
    </div>
  );
}
