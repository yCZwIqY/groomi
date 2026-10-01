# Repository Guidelines

## Project Structure & Module Organization

Groomi is a local manuscript editor built with Electron, React, TypeScript, Tiptap, SQLite, and Ollama. The React Router application runs in SPA mode.

- `app/`: routes, feature screens, shared components, hooks, Zustand stores, and renderer API wrappers.
- `electron/`: main process, preload bridge, IPC handlers, services, repositories, and database schema.
- `types/` and `utils/`: shared declarations and utility functions.
- `assets/` and `public/`: icons, local fonts, and static resources.
- `tests/`: release safety tests and Electron UI checks; `scripts/`: packaging helpers.
- `build/`, `dist-electron/`, and `release/`: generated outputs; edit their source files instead.

## Build, Test, and Development Commands

- `pnpm install`: install dependencies using `pnpm-lock.yaml`.
- `pnpm dev`: compile Electron code and start Vite with the desktop app.
- `pnpm typecheck`: generate route types and check renderer and Electron TypeScript.
- `pnpm build`: compile Electron and build the frontend.
- `pnpm test:release`: compile Electron and run Node release safety tests.
- `pnpm test:ui`: build the app and run Electron UI checks.
- `pnpm dist:win`: build a Windows NSIS installer in `release/`.

Run Ollama locally when validating AI generation features.

## Coding Style & Naming Conventions

Use TypeScript with two-space indentation, semicolons, and single quotes. Follow `.prettierrc`, including its 100-character print width and single JSX attribute per line. Format changed files with `pnpm exec prettier --write <paths>`.

Use kebab-case filenames, PascalCase component and type names, and camelCase functions and variables. Hooks follow the `use-*` filename pattern. Keep renderer interactions behind `app/lib/electron-api.ts`; place filesystem and database operations in Electron services and repositories.

Define only one React component per file. Place each component, including shared UI components, in its own kebab-case file named after the component. Keep shared styles, constants, and utilities in separate non-component modules when reused across components.

## Testing Guidelines

Release safety tests use `node:test` and strict assertions in `tests/*.test.mjs`. Cover persistence, recovery, rollback, and workspace operations with temporary fixtures. No coverage threshold is configured. Run type checks and relevant tests before submitting changes; manually verify editor interactions and Ollama flows affected by UI changes.

## Commit & Pull Request Guidelines

History uses prefixes such as `feat:`, `fix:`, and `chore:`, often with Korean descriptions. Keep commits focused and describe the resulting behavior. PRs should explain the change, link related issues when applicable, list validation commands and results, and include screenshots for visible UI changes.

## Data Safety & Security

Preserve IPC sender checks and input validation. Maintain atomic saves and recovery behavior when changing persistence. Use disposable workspaces for tests, and never commit personal manuscripts, local databases, or `.env` secrets.
