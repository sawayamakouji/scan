# Repository Guidelines

## Project Structure & Module Organization

Use a layered, domain-first layout to keep scanner logic portable across UI and Workers. Suggested layout:

- `src/domain/`: core entities, rules, and mapping logic (item JAN -> case JAN, quantity aggregation).
- `src/scanner/`: camera and barcode input implementations behind an interface.
- `src/storage/`: persistence (indexedDB/local storage) and sync adapters.
- `src/ui/`: PWA views, hooks, and state orchestration.
- `tests/`: unit and integration tests for domain and adapters.
- `e2e/`: end-to-end flows (scan, map, aggregate).
- `workers/` (optional): Cloudflare Workers API handlers.
- `migrations/` (optional): client data migrations for storage changes.

## Build, Test, and Development Commands

- `npm run dev`: start the Vite dev server for the PWA.
- `npm test`: run Vitest unit tests.
- `npm run build`: production build with TypeScript checks.

## Coding Style & Naming Conventions

- Indentation: 2 spaces; keep line length reasonable.
- TypeScript preferred over JS; avoid `any` unless documented.
- Naming: `PascalCase` for types/classes, `camelCase` for functions/vars, `kebab-case` for files.
- Keep scanning APIs behind a `Scanner` interface; do not call camera APIs directly in domain/UI.

## Testing Guidelines

- Framework: Vitest for unit/integration tests; e2e uses a browser runner as configured.
- Use `FakeScanner` in tests to simulate barcode input deterministically.
- Test names: `should <behavior> when <condition>`; cover mapping, aggregation (+/-), and storage.

## Commit & Pull Request Guidelines

- Commits: short, imperative subject (e.g., `add case-jan mapper`), optional body for rationale.
- PRs: include purpose, test evidence (`npm test`), and screenshots for UI changes.

## Security & Configuration Tips

- Gate camera access behind explicit user intent; avoid auto-start on load.
- Keep API endpoints and tokens in `.env` (do not commit secrets).