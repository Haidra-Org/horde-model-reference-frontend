# Horde Model Reference Frontend

A web-based CRUD interface for managing AI Horde model references, powered by Angular.

## Role in AI-Horde

The [AI-Horde](https://aihorde.net) ([github](https://github.com/Haidra-Org/AI-Horde)) is a free and open sourced, crowd-sourced distributed compute network for AI-generations. Currently, the following github repositories store the "legacy" model references still used by AI-Horde:

- [Haidra-Org/AI-Horde-image-model-reference](https://github.com/Haidra-Org/AI-Horde-image-model-reference)
- [Haidra-Org/AI-Horde-text-model-reference](https://github.com/Haidra-Org/AI-Horde-text-model-reference)

This frontend application provides a user-friendly interface to view, create, edit, and delete model references stored in a running instance of the [horde-model-reference](https://github.com/Haidra-Org/horde-model-reference) backend service.

The official version of this frontend is deployed at [models.aihorde.net](https://models.aihorde.net). However, anyone can run the built static webpage anywhere (e.g., GitHub Pages, Netlify, Vercel). Forks of the AI-Horde can also use it to manage their own model references by connecting to their own canonical instance of the [horde-model-reference](https://github.com/Haidra-Org/horde-model-reference) backend.

## Features

- View all models by category, with search/filter
- **Audit mode** allowing for detailed analysis of model metadata, usage, and history
- Create, edit, and delete models (when connected to PRIMARY backend and logged in)
- Backend capability detection (PRIMARY/REPLICA, writable/read-only)

## Installation

### Prerequisites

- Node.js (v18 or higher)
  - I recommend using [nvm](https://github.com/nvm-sh/nvm) to manage Node versions
- Angular CLI (`npm install -g @angular/cli`)
- Running instance of horde-model-reference backend service

### Setup

```bash
npm install
```

### Configuration

The API base URL is configured in `src/environments/environment.ts` for development:

```typescript
export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:19800/api/',
};
```

For production, update `src/environments/environment.prod.ts` accordingly.

### Development Server

Start the development server:

```bash
npm start
```

Navigate to `http://localhost:4200/`. The application will automatically reload when you change source files.

### Build

Build the project for production:

```bash
npm run build
```

Build artifacts will be stored in the `dist/` directory.

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

## Technologies

- **Angular 20** with standalone components
- **TypeScript** with strict mode
- **Signals** for reactive state management
- **Reactive Forms** for form handling
- **OnPush** change detection strategy
- **RxJS** for HTTP operations

## License

See LICENSE file in the repository root.
