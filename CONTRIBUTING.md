# Contributing to Horde Model Reference Frontend

## Getting Started

```bash
# Prerequisites: Node.js (v18+)
npm install

# Start dev server (http://localhost:4200)
npm start
```

## Code Conventions

### Angular Patterns

- **Standalone components** — All components are standalone. Do NOT set `standalone: true` in decorators (it's the default).
- **OnPush change detection** — Every component must set `changeDetection: ChangeDetectionStrategy.OnPush`.
- **Signal-based state** — Use `signal()`, `computed()`, and `input()` / `output()` functions.
- **`inject()` function** — Use `inject()` instead of constructor injection.
- **Native control flow** — Use `@if`, `@for`, `@switch` instead of `*ngIf`, `*ngFor`, `*ngSwitch`.
- **Host bindings** — Put host bindings in the `host` object of `@Component`, not `@HostBinding`/`@HostListener`.

### Styling

All styles are centralized in `src/styles/` and `src/shared/design-system/`. Component CSS files must be empty (with three documented exceptions).

Key rules:

- **Use semantic CSS classes** (`.alert--danger`, `.status-badge-success`) over inline Tailwind utility chains.
- **Use theme color tokens** (`primary-*`, `success-*`, `danger-*`, `warning-*`, `info-*`, `gray-*`). Never use raw Tailwind color names (`red-*`, `blue-*`, `emerald-*`, `amber-*`, etc.) in templates.
- **No inline `style=` attributes** in templates.
- **No `styles:` or `styleUrl:`** in component decorators (except json-editor, json-display, delta-diff).
- **No hardcoded `rgb()`/`rgba()`/hex** values in component code.
- **Always include `dark:` variants** for colors and backgrounds.

See [STYLING.md](STYLING.md) for the complete styling guide and class reference.

### TypeScript

- Strict type checking enabled — avoid `any`, use `unknown` when uncertain.
- Import generated types from `api-client/`, custom types from `models/`.
- Generated code under `src/app/api-client/` is auto-generated — **do not edit manually**.

## Linting

This project uses ESLint for linting. To run the linter:

```bash
npm run lint
```

## Pre-Commit Checks

This repository uses Husky pre-commit hooks (`.husky/pre-commit`) with lint-staged for fast staged-file checks.

The hook runs:

- `npm run precommit:quick` (lint-staged: ESLint/Prettier on staged files)
- `npm run type-check`

Husky is installed automatically on `npm install` via the `prepare` script.

You can run the same checks manually:

```bash
npm run precommit:verify
```

## CI Parity (Local)

Use the same gates CI uses for lint, types, unit tests, and production build:

```bash
npm run ci:local
```

To reproduce the OpenAPI contract checks locally (same backend service used in CI):

```bash
docker run -d --rm --name hmr-service -p 19800:19800 \
  -e HORDE_MODEL_REFERENCE_REPLICATE_MODE=PRIMARY \
  -e HORDE_MODEL_REFERENCE_CANONICAL_FORMAT=LEGACY \
  -e HORDE_MODEL_REFERENCE_MAKE_FOLDERS=true \
  -e HORDE_MODEL_REFERENCE_GITHUB_SEED_ENABLED=false \
  ghcr.io/haidra-org/horde-model-reference:main

VITE_USE_REMOTE_SCHEMA=true VITE_REMOTE_API_URL=http://localhost:19800 \
  npm test -- --watch=false --include='**/api.models.spec.ts'

npm run ci:openapi

docker rm -f hmr-service
```

## API Client Generation

The TypeScript Angular API client is automatically generated from the OpenAPI schema.

Install the OpenAPI Generator CLI globally if you haven't already:

```bash
npm install @openapitools/openapi-generator-cli -g
```

... or as a dev dependency:

```bash
npm install @openapitools/openapi-generator-cli --save-dev
```

To regenerate:

```bash
# Generate from backend service (must be running)
npm run generate-client

# Or use cached local schema (offline)
npm run generate-client:local
```

The generation script automatically:

- Discovers all SCREAMING_CASE enum names
- Preserves exact enum naming (e.g., `MODEL_REFERENCE_CATEGORY.ts`)
- Runs openapi-generator-cli with proper configuration
- Formats generated code with Prettier

**Documentation:**

- [Generation Scripts](./scripts/README.md) - Script documentation
- [API Models](./src/app/models/README.md) - Using generated types

**When to regenerate:**

- After backend API changes (new endpoints, schemas, enums)
- After pulling backend updates that affect the API
- To update generated types to match latest OpenAPI spec

## Backend Requirements

This frontend requires a running horde-model-reference backend service in PRIMARY mode with `canonical_format='legacy'` to enable write operations (create, update, delete).

### Backend Modes

- **PRIMARY (Writable)**: Full CRUD operations available
- **PRIMARY (Read-only)**: Connected but canonical_format is not 'legacy'
- **REPLICA (Read-only)**: Only viewing operations available

The UI automatically detects the backend mode and adjusts available features accordingly.

## API Endpoints Used

- `GET /info` - Backend capability detection
- `GET /model_categories` - List all categories
- `GET /{category}` - Get all models in category
- `POST /{category}/{model_name}` - Create new model
- `PUT /{category}/{model_name}` - Update/upsert model
- `DELETE /{category}/{model_name}` - Delete model

## Project Structure

```bash
src/
├── app/
│   ├── components/
│   │   ├── home/                # Welcome screen
│   │   ├── sidebar/             # Category navigation sidebar
│   │   ├── model-list/          # View and manage models
│   │   ├── model-form/          # Create/edit forms
│   │   ├── navigation/          # Header with status
│   │   └── notification-display/ # Toast notifications
│   ├── services/
│   │   ├── model-reference-api.service.ts  # API client
│   │   └── notification.service.ts         # User notifications
│   └── models/
│       └── api.models.ts        # TypeScript interfaces
└── environments/                # Environment configs
```

## Project Documentation

- [STYLING.md](STYLING.md) — Styling conventions, color system, class reference
- [.claude/CLAUDE.md](.claude/CLAUDE.md) — Full architecture reference
- [scripts/README.md](scripts/README.md) — API client generation scripts
- [src/app/models/README.md](src/app/models/README.md) — Type system and generated types
- [docs/style-cleanup-and-glass-migration/](docs/style-cleanup-and-glass-migration/) — Styling roadmap
