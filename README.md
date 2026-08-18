# Wusool Testing Framework

A web-based testing and simulation framework that exercises the real Wusool backend through Passenger, Driver, and Bus actors. It supports manual actions, map movement, workflows, session investigation, and read-only session-file viewing.

Read `AGENTS.md` before modifying the codebase — it defines the architecture, conventions, and engineering rules for this project.

## Prerequisites

- [Bun](https://bun.sh) (the lockfile is `bun.lock`; the supported package manager is Bun).

## Getting started

```bash
bun install   # install exactly what the lockfile declares
bun run dev   # start the development server
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the app.

## Verification

Every pull request must pass these checks (they also run in CI via `.github/workflows/ci.yml`):

```bash
bun run lint        # Biome
bun run typecheck   # tsc --noEmit
bun run test          # Vitest unit tests (via `bun run test`)
bun run build         # Next.js production build
```

Additional commands:

```bash
bun run test:coverage   # unit tests with coverage report
bun run lint:fix        # auto-fix lint issues
bun run format          # format code with Biome
```

Always keep `bun.lock` in sync and commit it.

## Documentation

- `docs/plans/longterm_plan.md` — implementation roadmap.
- `docs/fr/wusool_testing_framework_functional_requirements.md` — authoritative functional requirements.
- `design_tokens.md` — visual token reference.