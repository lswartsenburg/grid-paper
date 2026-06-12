# 🗺️ Project Implementation Plan: Paper Grid Graphing Tool

This roadmap focuses entirely on building a highly modular, decoupled frontend first, while putting the architecture in place to easily slide in a standalone backend layer down the road.

---

## Phase 1: Core Framework Setup & Architecture Base

**Goal:** Establish a robust project foundation with strict TypeScript definitions, local state infrastructure, and decoupled storage abstractions.

- [x] **Next.js & Workspace Initialization**
  - Scaffold a fresh Next.js project using App Router, Tailwind CSS, and `pnpm`.
  - Configure `tsconfig.json` for strict type-checking and path aliases (e.g., `@/*`).
  - Add the `CLAUDE.md` and `CONTRIBUTING.md` files to the repository root.
- [x] **Data Model & Type Definitions (`/types/canvas.ts`)**
  - Define completely flat, JSON-serializable TypeScript interfaces for a `Point`, `VectorShape`, `Annotation`, and `Layer`.
  - Added `GroupShape` + `LayerItem` union to support shape grouping and z-order reordering.
  - Create a structured `DrawingDocument` state schema containing metadata (ID, title, timestamps), viewport status (zoom, pan offset), and an ordered `layers` array.
- [x] **State & Persistence Abstraction Layer**
  - Build a custom hook wrapper (`useDrawingState`) that operates completely in RAM using standard React `useReducer` or context.
  - Implement a secondary service layer wrapper (`useStorageAdapter`) that mirrors state snapshots to browser `localStorage` using a decoupled interface.

---

## Phase 2: Visual Grid & Render Pipeline

**Goal:** Render a high-fidelity, performance-optimized visual graph paper layer that dynamically scales and tracks interactions.

- [x] **Infinite Paper Grid Rendering Component**
  - SVG `<pattern>`-based grid (`components/canvas/GridBackground.tsx`) with heavy major lines every 5 units and lighter minor lines; minor lines hidden when zoom < 0.4 to prevent moiré.
  - Dynamic panning (middle-click or space+drag) and mouse-wheel zooming relative to cursor implemented in `GridCanvas.tsx`.
- [x] **Coordinate Math & Snapping Utilities**
  - `lib/canvas/coordinates.ts`: `screenToGrid`, `gridToScreen`, `snapToGrid` (configurable step), `zoomAround`, `clampZoom`.
- [x] **Unified Input Tracker Hook**
  - `lib/canvas/useCanvasPointer.ts`: unifies mouse, stylus, and touch (including pinch-to-zoom + two-finger pan) via PointerEvents API.

---

## Phase 3: Layered Creation & Data Engine

**Goal:** Build the engine that lets users draw separate elements on explicit layers and update them immutably.

- [x] **Multi-Layer State Composition Stack**
  - `components/layers/LayerManager.tsx`: add/delete/visibility toggle/lock toggle/reorder (▲▼ buttons; DnD deferred to Phase 4).
  - `components/canvas/ShapeRenderer.tsx`: iterates visible layers bottom-to-top, renders `LayerItem` tree (groups recurse) via SVG `<g transform>` in grid-space with `vector-effect="non-scaling-stroke"`.
- [x] **Core Vector Drawing Tools**
  - `lib/tools/useActiveTool.ts`: line, circle, rect, freehand (press-drag-release) + polyline (click to add points, double-click to finish).
  - `components/canvas/PreviewLayer.tsx`: in-progress shape rendered dashed at 65% opacity.
  - `components/toolbar/Toolbar.tsx`: icon buttons for all 6 tool types; active tool highlighted.
  - Tools respect snap-to-grid and skip locked/hidden layers. Shapes committed with `crypto.randomUUID()` IDs.

---

## Phase 4: Object Selection, Interaction & Manipulation

**Goal:** Allow users to cleanly select existing items on any unlocked layer, modify them in real-time, and undo changes.

- [ ] **Vector Proximity & Bounding-Box Hit Testing**
  - Implement optimized mathematical ray/point-to-line proximity logic to detect when a user clicks on or near a vector path.
  - Calculate a dynamic geometric bounding box for every drawn layer or selected group.
- [ ] **Visual Selection Handles & Real-Time Manipulation**
  - Render an interactive overlay around selected items containing corner transformation handles.
  - Implement translation (dragging to move elements), vertex adjustment (dragging single path nodes), and layer attribute updates (color, stroke thickness).
- [ ] **Undo / Redo History Snapshotting Engine**
  - Build a localized history wrapper (`useCanvasHistory`) that keeps an array stack of prior layer states to enable clean multi-step undo and redo.

---

## Phase 5: Export Systems & Contributor Guardrails

**Goal:** Package the standalone frontend tool for production distribution and verify it is completely open-source ready.

- [ ] **Standalone Compilation & Static Exporters**
  - Configure `next.config.js` to build via `output: 'export'` so the entire build outputs a zero-dependency static folder (`/out`).
  - Write client-side canvas-to-blob utilities to let users export their graphics locally as crisp `.svg` vectors or high-resolution `.png` files.
- [ ] **Prettier & Code Quality Enforcement**
  - Add `format` (`prettier --write .`) and `format:check` (`prettier --check .`) scripts to `package.json`.
  - Configure a `.prettierrc` and `.prettierignore` (exclude `.next/`, `node_modules/`, `out/`).
  - Install `husky` + `lint-staged` and wire a pre-commit hook that runs `prettier --write` on staged files so every local commit is auto-formatted.
  - Add a `format-check` job to `.github/workflows/ci.yml` (trigger: `push` and `pull_request`) that runs `pnpm format:check` and fails the build if any file is not formatted.
- [ ] **Open-Source CI/CD Verification Workflows**
  - Add ESLint validation and canvas event unit tests to the same CI pipeline.
  - Configure `next build` as a CI gate to catch type and build errors on every PR.

---

## Phase 6: Future Backend Hookup (Post-Launch Roadmap Preview)

**Goal:** Seamlessly upgrade the tool to support user management and remote cloud file versioning without refactoring the frontend core.

- [ ] **API Service Layer Injection**
  - Swap out the internal `useStorageAdapter` engine to check for an authenticated user session.
  - Redirect saves from local browser data to asynchronous `fetch()` API calls hitting a decoupled, external REST/GraphQL backend database.
