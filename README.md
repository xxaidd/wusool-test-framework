# Wusool Testing Framework

A web-based testing and simulation framework that exercises the real Wusool backend through Passenger, Driver, and Bus actors. It supports manual actions, map movement, workflows, session investigation, and read-only session-file viewing.

Read `AGENTS.md` before modifying the codebase — it defines the architecture, conventions, and engineering rules for this project.

## Prerequisites

- Node.js **24 LTS** (see `.nvmrc`). Other versions are not supported.
- npm (the lockfile is `package-lock.json`; the supported package manager is npm).

## Getting started

```bash
npm ci        # install exactly what the lockfile declares
npm run dev   # start the development server
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the app.

## Verification

Every pull request must pass these checks (they also run in CI via `.github/workflows/ci.yml`):

```bash
npm run lint        # Biome
npm run typecheck   # tsc --noEmit
npm test            # Vitest unit tests
npm run build       # Next.js production build
```

Additional commands:

```bash
npm run test:coverage   # unit tests with coverage report
npm run lint:fix        # auto-fix lint issues
npm run format          # format code with Biome
```

If `npm ci` is not used, `npm install` may produce a different dependency tree — always keep `package-lock.json` in sync and commit it.

## Documentation

- `docs/plans/longterm_plan.md` — implementation roadmap.
- `docs/fr/wusool_testing_framework_functional_requirements.md` — authoritative functional requirements.
- `design_tokens.md` — visual token reference.