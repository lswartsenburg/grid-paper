<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# Project Context: Paper Grid Graphing Tool

A Next.js standalone frontend application that digitizes traditional paper grids for easy graphing. The codebase is fully open-source, highly modular, and optimized for easy community contributions.

## Tech Stack & Architecture

- **Framework:** Next.js (App Router, Static Export enabled)
- **Styling:** Tailwind CSS + CSS Grid for visual grid rendering
- **State:** Local React State / Context (Keep it simple and standalone; no external database or heavy backend)
- **Deployment:** Fully client-side standalone build (`next export`)
- **Future Roadmap:** A completely independent backend will eventually be introduced for storing, managing, sharing, and versioning drawings.

## Repository Structure (monorepo)

```
grid-paper/
├── apps/web/          @grid-paper/web  — Next.js demo app
└── packages/ui/       @grid-paper/ui   — publishable React library
```

Always run commands from the **workspace root** unless a task is specific to one package.

## Essential Commands

- `pnpm install` - Install all workspace dependencies
- `pnpm dev` - Start the Next.js demo app (runs `apps/web`)
- `pnpm build` - Build the demo app
- `pnpm lint` - Run ESLint across all packages
- `pnpm format` - Run Prettier across all files
- `pnpm test` - Execute unit and integration tests

## Contributor & Documentation Standards

- **Self-Documenting Code:** Always write descriptive variable, function, and component names. Avoid obscure abbreviations.
- **JSDoc Requirements:** Every utility function, hook, and exported component must have explicit JSDoc comments explaining parameters, return types, and usage.
- **Inline Explanations:** Comment complex math formulas, coordinate mapping math, or canvas/grid intersection logic inline.
- **Onboarding Focus:** Keep code highly modular and isolated. Group features (e.g., drawing tools, grid configurations, export utilities) so new contributors can modify parts without breaking the whole system.

## Layered Canvas & Interaction Architecture

- **Layer-Based Rendering:** All user elements (graphs, annotations, shapes, backgrounds) must be stored in a deterministic, ordered array of layers. Render elements using a strictly controlled top-down composition stack.
- **Object Selection:** Maintain an active hit-testing mechanism (e.g., bounding-box checks or vector proximity formulas) so individual layers or geometric objects within a layer can be independently targeted and highlighted.
- **Dynamic Object Editing:** Once selected, elements must expose an interface for real-time mutations (e.g., updating coordinates, modifying line stroke weights, altering geometric dimensions, or deleting layers completely).

## Backend-Ready Architecture Rules

- **Serializable Data Structures:** Model all graph/drawing data structures explicitly as flat, JSON-serializable objects (including ordered layer arrays, IDs, coordinates, and metadata). This ensures zero friction when migrating to an external database schema later.
- **Decoupled State Management:** Keep the code for rendering/drawing logic entirely separate from data persistence logic. Abstract all local storage/session handling behind a single interface or service layer (e.g., custom hooks). This will allow contributors to cleanly swap local browser storage for API fetch requests down the road.
- **Immutable Drawing States:** Design drawing data structures to support snapshotting and history tracking (undo/redo). This foundation is required to cleanly support backend versioning later.

## npm Package Exportability

This project must be publishable as a standalone React package (à la [Excalidraw](https://github.com/excalidraw/excalidraw)), so other apps can embed `<GridPaper />` with a single import.

### Hard rules for all contributors

- **No `next/*` imports outside `app/`**: The drawing core (`components/`, `lib/`, `types/`) must not import from `next/*`. Next.js-specific code belongs only in `app/` and thin bridge files (e.g. `components/canvas/CanvasRoot.tsx`). This keeps the library runnable in Vite, CRA, Remix, and other React environments.
- **Single embeddable entry point**: The file `components/GridPaper.tsx` is the library's public API root. It must accept props that control the initial document and surface change callbacks (`onDocumentChange`), so embedders can integrate with their own state.
- **All public types exported from `types/index.ts`**: Every type an embedder might need (`DrawingDocument`, `Layer`, `VectorShape`, etc.) must be re-exported from this barrel so consumers get one clean import path.
- **Peer dependencies only**: `react` and `react-dom` must never be bundled — they must remain peer dependencies in the published `package.json`.
- **CSS shipped separately**: Tailwind output must be built to `dist/style.css` so embedders can opt in with `import '@grid-paper/ui/style.css'` and the package never pollutes the host app's global styles.

### Package build target (future)

When the package build is wired up (Phase 5), add **tsup** to `packages/ui` to produce:

- `dist/index.mjs` — ESM bundle
- `dist/index.cjs` — CJS bundle
- `dist/index.d.ts` — TypeScript declarations
- `dist/style.css` — Tailwind output

Update `packages/ui/package.json`'s `exports` field to point to `dist/` targets with separate `import` / `require` / `types` conditions. During development, the `exports` field points to TypeScript source directly (`./index.ts`) so no build step is needed to iterate.

## YAML as the Canonical Document Format

Every element that can appear on the canvas **must be expressible in YAML**. YAML is the primary serialization format for drawings — used for import/export, LLM authoring, testing, and future backend storage.

### Hard rules

- **Full round-trip parity:** Every shape type, layer property, group, annotation, and grid setting that exists in the data model (`DrawingDocument`) must have a corresponding YAML representation. If you can draw it, you must be able to write it in YAML and get an identical result.
- **Update the spec when you add features:** Any time a new shape type, shape property, layer field, or grid setting is added, the following files must be updated in the same PR:
  - `packages/ui/lib/yaml/schema.ts` — TypeScript types for the YAML format
  - `packages/ui/lib/yaml/parse.ts` — deserializer (YAML → `DrawingDocument`)
  - `packages/ui/lib/yaml/serialize.ts` — serializer (`DrawingDocument` → YAML)
  - `packages/ui/lib/yaml/yaml.test.ts` — round-trip tests for the new field
- **Omit-defaults convention:** Fields at their default value must be omitted from serialized output so YAML stays human-readable and LLM-friendly. Parsers must always fall back to the documented default when a field is absent.
- **Coordinates in grid units:** All spatial values in YAML are in grid units, never in canvas pixels. This keeps documents resolution-independent and backend-portable.

### Reference

The YAML schema is documented in `packages/ui/lib/yaml/schema.ts`. A minimal valid document:

```yaml
layers:
  - name: Layer 1
    shapes:
      - type: line
        from: [0, 0]
        to: [5, 3]
```

## UI/UX & Technical Directives

- **Grid Snapping:** Handle crisp coordinate alignment to simulated graph paper lines during creation and transformation.
- **Input Parity:** Support high-precision mouse tracking alongside responsive touch/stylus inputs for drawing and selection.
