# API Client Generation Scripts

This directory contains scripts for generating the TypeScript Angular API client from the OpenAPI schema.

## Scripts

### `generate-api-client.js`

Main Node.js script that handles the generation process. It automatically:

1. **Discovers SCREAMING_CASE enum names** from the OpenAPI schema
2. **Generates model name mappings** to preserve exact enum naming
3. **Runs openapi-generator-cli** with proper configuration
4. **Formats generated code** with Prettier
5. **Saves schema locally** for offline use

### `generate-api-client.sh` (Bash)

Bash wrapper script for Unix/Linux/macOS systems.

### `generate-api-client.ps1` (PowerShell)

PowerShell wrapper script for Windows systems.

## Usage

### Using npm scripts (Recommended)

```bash
# Generate from default URL (http://localhost:19800/api/openapi.json)
npm run generate-client

# Generate from local schema file
npm run generate-client:local

# Generate from custom URL
npm run generate-client -- --url https://api.example.com/openapi.json
```

### Using Node.js directly

```bash
# Generate from default URL
node scripts/generate-api-client.js

# Generate from local schema file
node scripts/generate-api-client.js --local

# Generate from custom URL
node scripts/generate-api-client.js --url https://api.example.com/openapi.json

# Show help
node scripts/generate-api-client.js --help
```

### Using shell scripts

#### Bash (Unix/Linux/macOS)

```bash
# Make executable (first time only)
chmod +x scripts/generate-api-client.sh

# Run
./scripts/generate-api-client.sh
./scripts/generate-api-client.sh --local
./scripts/generate-api-client.sh --url https://api.example.com/openapi.json
```

#### PowerShell (Windows)

```powershell
# Run
.\scripts\generate-api-client.ps1
.\scripts\generate-api-client.ps1 -local
.\scripts\generate-api-client.ps1 -url https://api.example.com/openapi.json
```

## Options

- `--url <url>` - Specify OpenAPI schema URL (default: http://localhost:19800/api/openapi.json)
- `--local` - Use local schema file (src/assets/openapi-schema.json)
- `--force` - Bypass safety check for `.generated` marker file (⚠️ use with caution)
- `--help, -h` - Show help message

## Safety Features

### Directory Validation

The script includes a safety check to prevent accidental execution in the wrong directory:

1. **Marker File**: A `.generated` marker file must exist in `src/app/api-client/`
2. **Validation**: Before running, the script verifies this marker file exists
3. **Protection**: If the marker is missing, the script refuses to run unless `--force` is used

This prevents contamination of unrelated directories if the script is accidentally run with an incorrect working directory.

**Example error when marker is missing:**

```
❌ Safety check failed!

The marker file './src/app/api-client/.generated' was not found.
This usually means the script is being run in the wrong directory.

To proceed anyway, use the --force flag:
  npm run generate-client -- --force
  node scripts/generate-api-client.js --force
```

## How It Works

### 1. Schema Discovery

The script fetches the OpenAPI schema from the specified source (URL or local file) and parses it to discover all SCREAMING_CASE enum names.

**SCREAMING_CASE detection**: Names matching the pattern `^[A-Z][A-Z0-9_]*$` (e.g., `MODEL_REFERENCE_CATEGORY`, `KNOWN_IMAGE_GENERATION_BASELINE`)

### 2. Model Name Mapping

For each discovered enum, the script generates a model name mapping:

```
MODEL_REFERENCE_CATEGORY=MODEL_REFERENCE_CATEGORY
CONTROLNET_STYLE=CONTROLNET_STYLE
MODEL_DOMAIN=MODEL_DOMAIN
MODEL_PURPOSE=MODEL_PURPOSE
MODEL_STYLE=MODEL_STYLE
KNOWN_IMAGE_GENERATION_BASELINE=KNOWN_IMAGE_GENERATION_BASELINE
```

**Why?** Without these mappings, openapi-generator-cli transforms SCREAMING_CASE names into:

- Type names: `MODELREFERENCECATEGORY` (removes underscores)
- File names: `mODELREFERENCECATEGORY.ts` (weird casing)

With mappings, the exact names are preserved:

- Type names: `MODEL_REFERENCE_CATEGORY`
- File names: `MODEL_REFERENCE_CATEGORY.ts`

### 3. Code Generation

The script runs openapi-generator-cli with:

```bash
npx openapi-generator-cli generate \
  -i <schema-source> \
  -g typescript-angular \
  -o ./src/app/api-client \
  --model-name-mappings "<mappings>"
```

### 4. Code Formatting

After generation, Prettier is automatically run to format all generated files according to project style:

```bash
npx prettier . --write
```

### 5. Schema Caching

If fetched from a URL, the schema is saved to `src/assets/openapi-schema.json` for:

- Offline development
- Faster subsequent generations
- Version control tracking

## Prerequisites

- **Node.js** (v16 or higher)
- **npm** packages (installed automatically):
  - `@openapitools/openapi-generator-cli`
  - `prettier`

## Generated Files

The script generates files in `src/app/api-client/`:

```
src/app/api-client/
├── api/                              # API service classes
│   ├── api.ts                       # Service exports
│   ├── default.service.ts           # Default API service
│   └── modelReferenceV1.service.ts  # Model reference services
├── model/                            # Type definitions
│   ├── models.ts                    # Model exports
│   ├── MODEL_REFERENCE_CATEGORY.ts  # Enums (SCREAMING_CASE preserved!)
│   ├── CONTROLNET_STYLE.ts
│   ├── MODEL_STYLE.ts
│   ├── imageGenerationModelRecordOutput.ts
│   └── ...
├── api.module.ts                     # Angular module
├── configuration.ts                  # API configuration
├── encoder.ts                        # Request encoding
├── index.ts                          # Main exports
└── README.md                         # Generated documentation
```

## Troubleshooting

### Missing .generated Marker File

**Error**:

```text
❌ Safety check failed!

The marker file './src/app/api-client/.generated' was not found.
This usually means the script is being run in the wrong directory.
```

**Solution**:

1. Verify you're in the correct project directory (`horde-model-reference-frontend`)
2. Check that `src/app/api-client/.generated` exists
3. If you're certain you're in the right place, use `--force`:
   ```bash
   npm run generate-client -- --force
   ```

### Backend Service Not Running

**Error**: `Failed to fetch schema: connect ECONNREFUSED`

**Solution**: Start the backend service first:

```bash
# In the backend repository
cd ../horde-model-reference
python -m horde_model_reference.api
```

### Permission Denied (Bash Script)

**Error**: `Permission denied: ./scripts/generate-api-client.sh`

**Solution**: Make the script executable:

```bash
chmod +x scripts/generate-api-client.sh
```

### openapi-generator-cli Not Found

**Error**: `openapi-generator-cli: command not found`

**Solution**: Install dependencies:

```bash
npm install
```

### Schema Parse Error

**Error**: `Failed to parse JSON: Unexpected token`

**Solution**: Check that the backend is returning valid JSON:

```bash
curl http://localhost:19800/api/openapi.json | jq .
```

## Examples

### Standard Workflow

```bash
# 1. Start backend service
cd ../horde-model-reference
python -m horde_model_reference.api

# 2. Generate client (in frontend directory)
cd ../horde-model-reference-frontend
npm run generate-client

# 3. Run drift tests
npm test -- --include=src/app/models/api.models.drift.spec.ts

# 4. Review and commit changes
git diff src/app/api-client/
```

### Using Local Schema

```bash
# Generate from local schema (no backend needed)
npm run generate-client:local

# Or with Node.js directly
node scripts/generate-api-client.js --local
```

### Custom Backend URL

```bash
# Generate from staging server
npm run generate-client -- --url https://staging-api.example.com/openapi.json

# Generate from production
npm run generate-client -- --url https://api.example.com/openapi.json
```

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: Update API Client

on:
  workflow_dispatch:
  schedule:
    - cron: '0 0 * * 0' # Weekly

jobs:
  update-client:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Generate API client
        run: npm run generate-client -- --url ${{ secrets.API_URL }}

      - name: Run drift tests
        run: npm test -- --include=src/app/models/api.models.drift.spec.ts

      - name: Create Pull Request
        uses: peter-evans/create-pull-request@v5
        with:
          title: 'Update API client from OpenAPI schema'
          body: 'Automated update of API client types'
          branch: update-api-client
```

## Maintenance

### Updating openapi-generator Version

Edit `openapitools.json`:

```json
{
  "generator-cli": {
    "version": "7.16.0" // Update this
  }
}
```

### Adding Custom Template Modifications

If you need to customize generated code beyond model name mappings, consider:

1. Using [openapi-generator template files](https://openapi-generator.tech/docs/templating/)
2. Post-processing generated files with a custom script
3. Using `--additional-properties` flag for generator options

## Related Documentation

- [OpenAPI Generator Documentation](https://openapi-generator.tech/)
- [TypeScript Angular Generator](https://openapi-generator.tech/docs/generators/typescript-angular/)
- [Model Name Mappings](https://openapi-generator.tech/docs/customization/#model-name-mapping)
- [API Models README](../src/app/models/README.md) - Usage of generated types
- [Migration Guide](../src/app/models/MIGRATION_GUIDE.md) - Migrating to generated types
