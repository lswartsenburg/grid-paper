'use client';

import { useEffect } from 'react';
import type { DrawingDocument } from '../../types/canvas';

const STORAGE_KEY = 'grid-paper:document';

export function loadFromStorage(): DrawingDocument | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DrawingDocument;
  } catch {
    return null;
  }
}

export function useStorageAdapter(document: DrawingDocument): void {
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(document));
    } catch {
      // localStorage may be unavailable (private browsing quota exceeded)
    }
  }, [document]);
}
