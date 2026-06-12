# Contributing to Paper Grid Graphing Tool

Thank you for your interest in contributing to the Paper Grid Graphing Tool! We want this project to be highly approachable, robust, and easy to maintain.

Please follow these guidelines to ensure a smooth contribution process for everyone.

---

## 🚀 Getting Started

### 1. Prerequisites

Make sure you have Node.js (v18+) and **pnpm** installed on your local machine.

### 2. Fork and Clone

1. Fork the repository on GitHub.
2. Clone your fork locally:
   ```bash
   git clone https://github.com
   cd paper-grid
   ```

### 3. Installation & Local Development

Install dependencies and spin up the standalone Next.js development server:

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000` in your browser to view the application.

---

## 🛠 Architectural Principles

To ensure our standalone frontend can smoothly integrate with a decoupled backend down the road, please adhere to these strict architectural rules:

### 1. Layered Canvas & Interaction

- **Ordered Array Structure:** All elements (lines, grids, annotations) live in a deterministic, z-indexed layer system.
- **Hit Testing:** Any new shapes or graph elements must implement an optimized bounding-box or vector-proximity hit-test function so they can be accurately selected and highlighted.
- **Mutation Immutability:** Do not mutate the drawing state directly. Always use functional state updates or reducers to preserve history states (making undo/redo and future backend versioning possible).

### 2. Backend Readiness

- **Strictly Serializable:** Every property inside a layer or drawing object must be flat JSON-serializable (strings, numbers, booleans, arrays, flat objects). Do not store live HTML elements or functions inside the state.
- **Isolated Storage:** Abstract browser local storage or session tracking behind custom React hooks. Never call `localStorage` directly inside presentation components.

---

## 📝 Code & Documentation Standards

We place a massive emphasis on readable, self-documenting code to lower the barrier of entry for new open-source contributors.

### 1. Documentation Requirements

- **JSDoc Comments:** Every single exported React component, custom hook, and utility math function must feature explicit JSDoc blocks detailing parameters, return values, and behavior.
- **Inline Coordinate Math:** When writing grid line intersection formulas, coordinate transformations, scaling factors, or hit-detection code, add step-by-step inline comments explaining the logic.
- **No Vague Names:** Use expressive, descriptive names (`activeSelectedLayerId` instead of `selId`; `calculateGridIntersection` instead of `calcInt`).

### 2. Code Formatting (Prettier)

This project uses **Prettier** for consistent code formatting. Formatting is enforced automatically — you do not need to run it manually before committing.

- A **pre-commit hook** (husky + lint-staged) auto-formats all staged files when you run `git commit`. Just write your code and commit; the hook handles formatting for you.
- To format the entire project manually:
  ```bash
  pnpm format
  ```
- To check formatting without writing changes (the same check CI runs):
  ```bash
  pnpm format:check
  ```
- Do **not** bypass the pre-commit hook with `--no-verify`. CI will reject any commit that contains unformatted code.

### 3. Component Isolation

- Keep features grouped by logical concern (`/components/grid`, `/components/toolbar`, `/hooks/canvas`).
- Extract heavy canvas drawing computations or event listeners out of components and into modular custom hooks.

---

## 📦 Pull Request Process

### 1. Quality Check Checklist

Before pushing your changes and opening a Pull Request, always run the local verification suite:

```bash
# Check formatting (CI will run this too)
pnpm format:check

# Run linting check
pnpm lint

# Run unit and interaction tests
pnpm test

# Verify the static export compiles successfully
pnpm build
```

### 2. Submitting the PR

1. Create a descriptive feature branch (`git checkout -b feature/layered-selection-handles`).
2. Commit your changes using clear, semantic messages.
3. Push your branch and open a Pull Request against our `main` branch.
4. Provide a clear summary in your PR description detailing what was changed, visual before/after snapshots (if UI related), and validation that tests are passing.
