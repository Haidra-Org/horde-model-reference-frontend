# Contributing to Horde Model Reference Frontend

## Linting

This project uses ESLint for linting. To run the linter:

```bash
npm run lint
```

## API Client Generation

The TypeScript Angular API client is automatically generated from the OpenAPI schema. To regenerate:

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
