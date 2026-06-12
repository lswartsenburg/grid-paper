'use client';

import { useMemo, useState, useCallback, useEffect, useRef, useLayoutEffect } from 'react';
import { createDocument } from '../../lib/drawing/useDrawingState';
import { useCanvasHistory } from '../../lib/drawing/useCanvasHistory';
import { loadFromStorage, useStorageAdapter } from '../../lib/storage/useStorageAdapter';
import { useActiveTool } from '../../lib/tools/useActiveTool';
import { hitTestDocument, shapeBounds } from '../../lib/canvas/hitTest';
import { BASE_UNIT } from '../../lib/canvas/coordinates';
import GridCanvas from './GridCanvas';
import ShapeRenderer from './ShapeRenderer';
import PreviewLayer from './PreviewLayer';
import SelectionOverlay from './SelectionOverlay';
import Toolbar from '../toolbar/Toolbar';
import LayerManager from '../layers/LayerManager';
import YamlEditor from '../editor/YamlEditor';
import PropertiesPanel from '../properties/PropertiesPanel';
import RightSidebar from '../sidebar/RightSidebar';
import type { SidebarPanel } from '../sidebar/RightSidebar';
import type { DrawingDocument, LayerItem, Point, RectShape, VectorShape } from '../../types/canvas';

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

export default function CanvasEditor() {
  const initialDoc = useMemo(() => loadFromStorage() ?? createDocument(), []);
  const { doc, dispatch, undo, redo } = useCanvasHistory(initialDoc);
  const [activePanel, setActivePanel] = useState<string | null>(null);

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
  const resizeOriginalRef = useRef<RectShape | null>(null);
  const resizePreviewRef = useRef<RectShape | null>(null);
  const [resizePreview, setResizePreview] = useState<RectShape | null>(null);

  useLayoutEffect(() => {
    docRef.current = doc;
    selectionLayerIdRef.current = selectionLayerId;
    selectedShapeIdsRef.current = selectedShapeIds;
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
    setSelectionLayerId(null);
    setSelectedShapeIds([]);
    setDragDelta({ x: 0, y: 0 });
    setResizePreview(null);
    updateCursor('default');
  }, []);

  const tool = useActiveTool(dispatch, activeLayerId);
  useStorageAdapter(doc);

  // --- Selection pointer handlers (stable; read latest values via refs) ---
  const handleSelectPointerDown = useCallback(
    (pos: Point) => {
      const d = docRef.current;

      // Check corners first if exactly one rect is selected — enter resize mode.
      const currentShapes = selectedShapesRef.current;
      if (currentShapes.length === 1 && currentShapes[0].type === 'rect') {
        const bounds = shapeBounds(currentShapes);
        if (bounds) {
          const corner = hitTestCorners(bounds, pos, d.viewport.zoom);
          if (corner) {
            resizeCornerRef.current = corner;
            resizeOriginalRef.current = currentShapes[0] as RectShape;
            dragOriginRef.current = pos;
            updateCursor(CORNER_CURSORS[corner]);
            return; // keep existing selection, begin resize
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
        setActivePanel('properties');
        updateCursor('grabbing');
      } else {
        clearSelection();
        setActivePanel((prev) => (prev === 'properties' ? null : prev));
      }
    },
    [clearSelection]
  );

  const handleSelectPointerMove = useCallback((pos: Point) => {
    // Active resize mode.
    if (resizeCornerRef.current !== null && resizeOriginalRef.current !== null) {
      const patch = computeResizedRect(resizeOriginalRef.current, resizeCornerRef.current, pos);
      const preview: RectShape = { ...resizeOriginalRef.current, ...patch };
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
    if (shapes.length === 1 && shapes[0].type === 'rect') {
      const bounds = shapeBounds(shapes);
      if (bounds) {
        const corner = hitTestCorners(bounds, pos, d.viewport.zoom);
        if (corner) {
          updateCursor(CORNER_CURSORS[corner]);
          return;
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

  // --- Keyboard shortcuts ---
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
      if (mod && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); return; }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectionLayerId && selectedShapeIds.length > 0) {
        e.preventDefault();
        selectedShapeIds.forEach((shapeId) =>
          dispatch({ type: 'DELETE_SHAPE', layerId: selectionLayerId, shapeId })
        );
        clearSelection();
        return;
      }
      if (e.key === 'Escape') clearSelection();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, selectionLayerId, selectedShapeIds, dispatch, clearSelection]);

  // When the YAML editor produces a fully-parsed document, replace state entirely.
  const handleYamlDocument = useCallback(
    (next: DrawingDocument) => {
      dispatch({ type: 'UPDATE_METADATA', patch: { title: next.title } });
      dispatch({ type: 'UPDATE_GRID_CONFIG', patch: next.gridConfig });
      doc.layers.forEach((l) => dispatch({ type: 'DELETE_LAYER', layerId: l.id }));
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
        if (item.type === 'group') { collect(item.children); continue; }
        if (ids.has(item.id)) result.push(item);
      }
    }
    collect(layer.items);
    // Keep ref in sync so corner hit-test in handleSelectPointerDown sees current shapes.
    selectedShapesRef.current = result;
    return result;
  }, [doc, selectionLayerId, selectedShapeIds]);

  // --- Route pointer events based on active tool ---
  const isSelectTool = tool.toolType === 'select';

  // When switching away from the select tool, revert to crosshair.
  useEffect(() => {
    updateCursor(isSelectTool ? 'default' : 'crosshair');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSelectTool]);
  const activeLayer = doc.layers.find((l) => l.id === activeLayerId);
  const toolReady = !isSelectTool && !!activeLayer && !activeLayer.locked;

  const pointerDown = isSelectTool ? handleSelectPointerDown
    : (toolReady ? tool.handlePointerDown : undefined);
  const pointerMove = isSelectTool ? handleSelectPointerMove
    : (toolReady ? (pos: Point) => tool.handlePointerMove(pos) : undefined);
  const pointerUp = isSelectTool ? handleSelectPointerUp
    : (toolReady ? tool.handlePointerUp : undefined);

  // --- Sidebar panels ---
  const panels: SidebarPanel[] = [
    {
      id: 'layers',
      label: 'Layers',
      icon: (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
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
      id: 'properties',
      label: 'Properties',
      icon: (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="8" cy="8" r="5" />
          <line x1="8" y1="5" x2="8" y2="8.5" />
          <circle cx="8" cy="11" r="0.75" fill="currentColor" stroke="none" />
        </svg>
      ),
      content: (
        <PropertiesPanel
          shape={selectedShapes[0] ?? null}
          layerId={selectionLayerId}
          dispatch={dispatch}
        />
      ),
    },
    {
      id: 'yaml',
      label: 'YAML',
      icon: (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="5,4 2,8 5,12" />
          <polyline points="11,4 14,8 11,12" />
          <line x1="9" y1="3" x2="7" y2="13" />
        </svg>
      ),
      content: <YamlEditor document={doc} onDocumentChange={handleYamlDocument} />,
    },
  ];

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Canvas area — toolbar floats at top center */}
      <div className="relative flex flex-1 overflow-hidden">
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
          <div className="pointer-events-auto">
            <Toolbar activeTool={tool.toolType} onSetTool={tool.setTool} />
          </div>
        </div>

        <GridCanvas
          viewport={doc.viewport}
          majorEvery={doc.gridConfig.majorEvery}
          onViewportChange={(patch) => dispatch({ type: 'UPDATE_VIEWPORT', patch })}
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={pointerUp}
          cursorStyle={canvasCursor}
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
      </div>

      <RightSidebar panels={panels} activePanel={activePanel} onTogglePanel={togglePanel} />
    </div>
  );
}
