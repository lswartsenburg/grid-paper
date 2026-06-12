'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import type { Point, Viewport } from '../../types/canvas';
import { clampZoom, screenToGrid } from './coordinates';

interface Options {
  viewport: Viewport;
  onPan?: (delta: Point) => void;
  onZoom?: (newZoom: number, origin: Point) => void;
  onPointerDown?: (gridPos: Point, event: PointerEvent) => void;
  onPointerMove?: (gridPos: Point, delta: Point, event: PointerEvent) => void;
  onPointerUp?: (gridPos: Point, event: PointerEvent) => void;
  /** When true, left-button drag pans instead of forwarding to onPointerDown (hand tool). */
  isPanMode?: boolean;
  /** Called when a pan gesture starts (middle-click, space+drag, or hand tool drag). */
  onPanStart?: () => void;
  /** Called when a pan gesture ends. */
  onPanEnd?: () => void;
}

function normalizeWheelDelta(e: WheelEvent): number {
  if (e.deltaMode === WheelEvent.DOM_DELTA_LINE) return e.deltaY * 16;
  if (e.deltaMode === WheelEvent.DOM_DELTA_PAGE) return e.deltaY * 200;
  return e.deltaY;
}

export function useCanvasPointer<T extends HTMLElement>(options: Options) {
  const ref = useRef<T>(null);
  // Always reflect latest options without re-binding events.
  const optionsRef = useRef(options);
  // Update ref after every render so event handlers always see current options
  // without needing to re-bind. useLayoutEffect runs synchronously before paint.
  useLayoutEffect(() => {
    optionsRef.current = options;
  });

  const isPanningRef = useRef(false);
  const isSpaceDownRef = useRef(false);
  const activePointerIdRef = useRef<number | null>(null);
  const lastScreenRef = useRef<Point>({ x: 0, y: 0 });

  // Pinch: track two touch pointer positions
  const pinchPointersRef = useRef<Map<number, Point>>(new Map());
  const lastPinchDistRef = useRef<number | null>(null);
  const lastPinchMidRef = useRef<Point | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    function toScreen(e: PointerEvent): Point {
      const rect = el!.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    function pinchDistance(a: Point, b: Point): number {
      return Math.hypot(b.x - a.x, b.y - a.y);
    }

    function pinchMidpoint(a: Point, b: Point): Point {
      return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    }

    function handlePointerDown(e: PointerEvent) {
      const screen = toScreen(e);
      const { viewport, onPointerDown } = optionsRef.current;

      // Track all pointers for pinch detection
      pinchPointersRef.current.set(e.pointerId, screen);
      el!.setPointerCapture(e.pointerId);

      if (pinchPointersRef.current.size === 2) {
        const [a, b] = Array.from(pinchPointersRef.current.values());
        lastPinchDistRef.current = pinchDistance(a, b);
        lastPinchMidRef.current = pinchMidpoint(a, b);
        isPanningRef.current = false;
        activePointerIdRef.current = null;
        return;
      }

      // Middle-click, space+left, or hand tool = pan
      if (e.button === 1 || (e.button === 0 && (isSpaceDownRef.current || optionsRef.current.isPanMode))) {
        isPanningRef.current = true;
        lastScreenRef.current = screen;
        optionsRef.current.onPanStart?.();
        e.preventDefault();
        return;
      }

      if (e.button === 0) {
        activePointerIdRef.current = e.pointerId;
        lastScreenRef.current = screen;
        onPointerDown?.(screenToGrid(screen, viewport), e);
      }
    }

    function handlePointerMove(e: PointerEvent) {
      const screen = toScreen(e);
      const { viewport, onPointerMove, onPan, onZoom } = optionsRef.current;

      pinchPointersRef.current.set(e.pointerId, screen);

      // Pinch gesture
      if (pinchPointersRef.current.size === 2) {
        const [a, b] = Array.from(pinchPointersRef.current.values());
        const dist = pinchDistance(a, b);
        const mid = pinchMidpoint(a, b);

        if (
          lastPinchDistRef.current !== null &&
          lastPinchMidRef.current !== null
        ) {
          const scale = dist / lastPinchDistRef.current;
          const newZoom = clampZoom(viewport.zoom * scale);
          onZoom?.(newZoom, mid);

          const panDelta = {
            x: mid.x - lastPinchMidRef.current.x,
            y: mid.y - lastPinchMidRef.current.y,
          };
          if (panDelta.x !== 0 || panDelta.y !== 0) onPan?.(panDelta);
        }

        lastPinchDistRef.current = dist;
        lastPinchMidRef.current = mid;
        return;
      }

      if (isPanningRef.current) {
        const delta = {
          x: screen.x - lastScreenRef.current.x,
          y: screen.y - lastScreenRef.current.y,
        };
        lastScreenRef.current = screen;
        onPan?.(delta);
        return;
      }

      if (e.pointerId === activePointerIdRef.current) {
        const delta = {
          x: screen.x - lastScreenRef.current.x,
          y: screen.y - lastScreenRef.current.y,
        };
        lastScreenRef.current = screen;
        onPointerMove?.(screenToGrid(screen, viewport), delta, e);
      } else if (activePointerIdRef.current === null) {
        // No active drag — forward hover moves so callers can update cursor etc.
        onPointerMove?.(screenToGrid(screen, viewport), { x: 0, y: 0 }, e);
      }
    }

    function handlePointerUp(e: PointerEvent) {
      const screen = toScreen(e);
      const { viewport, onPointerUp } = optionsRef.current;

      pinchPointersRef.current.delete(e.pointerId);
      lastPinchDistRef.current = null;
      lastPinchMidRef.current = null;

      if (isPanningRef.current && (e.button === 1 || e.button === 0)) {
        isPanningRef.current = false;
        optionsRef.current.onPanEnd?.();
        return;
      }

      if (e.pointerId === activePointerIdRef.current) {
        activePointerIdRef.current = null;
        onPointerUp?.(screenToGrid(screen, viewport), e);
      }
    }

    function handleWheel(e: WheelEvent) {
      e.preventDefault();
      const { viewport, onZoom } = optionsRef.current;
      const rect = el!.getBoundingClientRect();
      const origin = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const normalized = normalizeWheelDelta(e);
      const newZoom = clampZoom(viewport.zoom * Math.pow(0.999, normalized));
      onZoom?.(newZoom, origin);
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.code === 'Space' && !e.repeat && !isPanningRef.current) {
        isSpaceDownRef.current = true;
        e.preventDefault();
      }
    }

    function handleKeyUp(e: KeyboardEvent) {
      if (e.code === 'Space') {
        isSpaceDownRef.current = false;
        if (isPanningRef.current) {
          isPanningRef.current = false;
          optionsRef.current.onPanEnd?.();
        }
      }
    }

    el.addEventListener('pointerdown', handlePointerDown);
    el.addEventListener('pointermove', handlePointerMove);
    el.addEventListener('pointerup', handlePointerUp);
    el.addEventListener('pointercancel', handlePointerUp);
    el.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      el.removeEventListener('pointerdown', handlePointerDown);
      el.removeEventListener('pointermove', handlePointerMove);
      el.removeEventListener('pointerup', handlePointerUp);
      el.removeEventListener('pointercancel', handlePointerUp);
      el.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  return ref;
}
