# Repository Guidelines

## Project Structure & Module Organization
- `deshboard/`: React + Vite TypeScript dashboard.
  - `src/App.tsx`: main UI, file ingestion, summaries.
  - `src/types.ts`: shared types for parsed rows.
  - `src/index.css`: Tailwind utility composition.
- `gradebook_cleaner_browser.html`: browser-only cleaner for XLSX → normalized rows.
- `docs/`: data extraction and processing notes (`extraction.md`, `processing_guide.md`).
- `data/`: sample or working datasets (keep large files out of git).

## Build, Test, and Development Commands
- Dashboard dev: `cd deshboard && npm install && npm run dev`
  - Starts Vite dev server; open printed URL.
- Dashboard build: `cd deshboard && npm run build`
  - Type-checks (TS `strict`) and builds production assets.
- Dashboard preview: `cd deshboard && npm run preview`
  - Serves the production build locally.
- Cleaner (HTML): open `gradebook_cleaner_browser.html` in a browser and upload XLSX files.

## Coding Style & Naming Conventions
- Language: TypeScript (`strict: true`). Prefer explicit types for public props/returns.
- React: functional components + hooks; avoid mutation, keep pure helpers in `src/`.
- CSS: Tailwind utilities via `src/index.css` (`@apply` for small design tokens).
- Indentation: 2 spaces; single quotes or consistent existing style.
- Naming: `PascalCase` React components (e.g., `StudentTable.tsx`), `camelCase` functions/vars, `types.ts` for shared types.

## Testing Guidelines
- No automated test setup yet. Validate locally with representative files in `data/`.
- If adding tests, prefer Vitest + React Testing Library; co-locate as `*.test.ts(x)` next to source.
- Target behaviors: row parsing, KPI aggregation, group normalization (`canonGroup`), level parsing (`parseHierLevel`).

## Commit & Pull Request Guidelines
- Commits: concise, imperative subject (e.g., "add KPI for credits"). Group related changes.
- PRs: include a clear description, screenshots/GIFs for UI changes, and repro steps for data parsing changes.
- Link issues when applicable; note any schema or file-format assumptions (see `docs/`).

## Security & Configuration Tips
- Do not commit student-identifiable data; sanitize or use synthetic samples in `data/`.
- The cleaner uses a CDN for SheetJS; if offline, replace with a local bundle.
- Avoid secrets in code or `.env`; none are required for local dev.

