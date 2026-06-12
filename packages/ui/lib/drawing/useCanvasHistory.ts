'use client';

import { useState, useCallback, useLayoutEffect, useRef } from 'react';
import type { DrawingDocument } from '../../types/canvas';
import { useDrawingState } from './useDrawingState';
import type { DrawingAction } from './useDrawingState';

/** Actions that create a history snapshot before being applied. */
const SNAPSHOT_TYPES = new Set<DrawingAction['type']>([
  'ADD_SHAPE', 'REPLACE_SHAPE', 'DELETE_SHAPE',
  'TRANSLATE_SHAPES', 'UPDATE_SHAPE_STYLE',
  'ADD_LAYER', 'DELETE_LAYER', 'UPDATE_LAYER', 'REORDER_LAYERS',
  'GROUP_SHAPES', 'UNGROUP', 'REORDER_ITEMS',
  'ADD_ANNOTATION', 'DELETE_ANNOTATION',
  'UPDATE_GRID_CONFIG', 'UPDATE_METADATA',
  'LOAD_DOCUMENT',
]);

const MAX_HISTORY = 100;

/**
 * Wraps `useDrawingState` with an undo/redo history stack.
 * Only actions in `SNAPSHOT_TYPES` create history entries;
 * viewport changes are intentionally excluded.
 */
export function useCanvasHistory(initialDoc: DrawingDocument) {
  const [doc, baseDispatch] = useDrawingState(initialDoc);
  const [past, setPast] = useState<DrawingDocument[]>([]);
  const [future, setFuture] = useState<DrawingDocument[]>([]);

  // Refs to always read the latest values inside stable callbacks.
  const docRef = useRef(doc);
  const pastRef = useRef(past);
  const futureRef = useRef(future);
  useLayoutEffect(() => {
    docRef.current = doc;
    pastRef.current = past;
    futureRef.current = future;
  });

  const dispatch = useCallback(
    (action: DrawingAction) => {
      if (SNAPSHOT_TYPES.has(action.type)) {
        setPast((prev) => [...prev.slice(-(MAX_HISTORY - 1)), docRef.current]);
        setFuture([]);
      }
      baseDispatch(action);
    },
    [baseDispatch]
  );

  const undo = useCallback(() => {
    const p = pastRef.current;
    if (p.length === 0) return;
    const prevDoc = p[p.length - 1];
    setFuture((f) => [docRef.current, ...f.slice(0, MAX_HISTORY - 1)]);
    setPast((prev) => prev.slice(0, -1));
    baseDispatch({ type: 'LOAD_DOCUMENT', document: prevDoc });
  }, [baseDispatch]);

  const redo = useCallback(() => {
    const f = futureRef.current;
    if (f.length === 0) return;
    const nextDoc = f[0];
    setPast((p) => [...p.slice(-(MAX_HISTORY - 1)), docRef.current]);
    setFuture((prev) => prev.slice(1));
    baseDispatch({ type: 'LOAD_DOCUMENT', document: nextDoc });
  }, [baseDispatch]);

  return {
    doc,
    dispatch,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
  };
}
