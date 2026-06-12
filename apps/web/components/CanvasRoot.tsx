'use client';

import dynamic from 'next/dynamic';

// GridPaper uses browser-only APIs (localStorage, pointer events, crypto.randomUUID).
// Disabling SSR avoids hydration mismatches from non-deterministic initial state.
const GridPaper = dynamic(() => import('@grid-paper/ui'), { ssr: false });

/** Next.js boundary that mounts <GridPaper /> without server-side rendering. */
export default function CanvasRoot() {
  return <GridPaper className="flex-1" />;
}
