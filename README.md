# Horde Model Reference Frontend

A web-based CRUD interface for managing AI Horde model references using Angular.

## Features

- **Persistent sidebar** with all model categories always visible
- **Active category highlighting** shows currently selected category
- View all models within a category with search/filter
- Create, edit, and delete models (when connected to PRIMARY backend)
- Backend capability detection (PRIMARY/REPLICA, writable/read-only)
- Real-time status indicator showing backend mode in header
- Form validation and error handling
- Clean, responsive design

## Prerequisites

- Node.js (v18 or higher)
- Angular CLI (`npm install -g @angular/cli`)
- Running instance of horde-model-reference backend service

## Installation

```bash
npm install
```

## Configuration

The API base URL is configured in `src/environments/environment.ts`:

```typescript
export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:19800/api/model_references/v1',
};
```

For production, update `src/environments/environment.prod.ts` accordingly.

## Development Server

Start the development server:

```bash
npm start
```

Navigate to `http://localhost:4200/`. The application will automatically reload when you change source files.

## Build

Build the project for production:

```bash
npm run build
```

Build artifacts will be stored in the `dist/` directory.

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

```
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

## Usage

### Browsing Models

1. Start the application
2. Categories are displayed in the left sidebar
3. Click on a category to view all models in that category
4. The selected category is highlighted in the sidebar
5. Use the search box to filter models by name or description

### Creating Models

1. Navigate to a category
2. Click "Create Model" (only visible if backend is writable)
3. Enter model name (alphanumeric, hyphens, underscores)
4. Add model data as JSON
5. Submit

### Editing Models

1. Navigate to a category
2. Click "Edit" on a model
3. Update the JSON data (name field is read-only)
4. Submit

### Deleting Models

1. Navigate to a category
2. Click "Delete" on a model
3. Confirm deletion

## Error Handling

The application provides user-friendly error messages for:

- 400: Invalid request format or name mismatch
- 404: Model or category not found
- 409: Model already exists (use edit instead)
- 422: Validation errors from backend
- 503: Backend doesn't support write operations

## Technologies

- **Angular 20** with standalone components
- **TypeScript** with strict mode
- **Signals** for reactive state management
- **Reactive Forms** for form handling
- **OnPush** change detection strategy
- **RxJS** for HTTP operations

## Contributing

Follow the Angular style guide and project conventions:

- Use signals for state management
- Use `computed()` for derived state
- Use native control flow (`@if`, `@for`)
- Use `inject()` function instead of constructor injection
- Set `changeDetection: ChangeDetectionStrategy.OnPush`
- Avoid `any` type, prefer strict typing

## License

See LICENSE file in the repository root.
