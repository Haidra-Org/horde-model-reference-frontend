#!/usr/bin/env node
/**
 * Generate API Client from OpenAPI Schema
 *
 * This script generates the TypeScript Angular API client from the OpenAPI schema.
 * It automatically discovers all SCREAMING_CASE enum names from the schema and
 * configures the generator to preserve their exact naming.
 *
 * Usage:
 *   node scripts/generate-api-client.js [options]
 *
 * Options:
 *   --url <url>      OpenAPI schema URL (default: http://localhost:19800/api/openapi.json)
 *   --local          Use local schema file (src/assets/openapi-schema.json)
 *   --help           Show this help message
 *
 * Examples:
 *   node scripts/generate-api-client.js
 *   node scripts/generate-api-client.js --local
 *   node scripts/generate-api-client.js --url https://api.example.com/openapi.json
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_SCHEMA_URL = 'http://localhost:19800/api/openapi.json';
const LOCAL_SCHEMA_PATH = './src/assets/openapi-schema.json';
const OUTPUT_DIR = './src/app/api-client';

// ============================================================================
// Argument Parsing
// ============================================================================

const args = process.argv.slice(2);
let schemaSource = DEFAULT_SCHEMA_URL;
let useLocal = false;
let forceGenerate = false;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];

  if (arg === '--help' || arg === '-h') {
    console.log(`
Generate API Client from OpenAPI Schema

Usage:
  node scripts/generate-api-client.js [options]

Options:
  --url <url>      OpenAPI schema URL (default: ${DEFAULT_SCHEMA_URL})
  --local          Use local schema file (${LOCAL_SCHEMA_PATH})
  --force          Bypass safety check for .generated marker file
  --help, -h       Show this help message

Examples:
  node scripts/generate-api-client.js
  node scripts/generate-api-client.js --local
  node scripts/generate-api-client.js --url https://api.example.com/openapi.json
  node scripts/generate-api-client.js --force

Notes:
  - The script automatically discovers SCREAMING_CASE enum names from the schema
  - Model name mappings are generated to preserve exact enum naming
  - Prettier is automatically run after generation
  - A .generated marker file must exist in the output directory (use --force to bypass)
`);
    process.exit(0);
  } else if (arg === '--local') {
    useLocal = true;
    schemaSource = LOCAL_SCHEMA_PATH;
  } else if (arg === '--url' && i + 1 < args.length) {
    schemaSource = args[i + 1];
    i++;
  } else if (arg === '--force') {
    forceGenerate = true;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Fetch OpenAPI schema from URL or local file
 */
async function fetchSchema(source) {
  console.log(`📥 Fetching OpenAPI schema from: ${source}`);

  if (source.startsWith('http://') || source.startsWith('https://')) {
    // Fetch from URL
    try {
      const https = require('https');
      const http = require('http');
      const client = source.startsWith('https://') ? https : http;

      return new Promise((resolve, reject) => {
        client
          .get(source, (res) => {
            let data = '';

            res.on('data', (chunk) => {
              data += chunk;
            });

            res.on('end', () => {
              try {
                resolve(JSON.parse(data));
              } catch (e) {
                reject(new Error(`Failed to parse JSON: ${e.message}`));
              }
            });
          })
          .on('error', (e) => {
            reject(new Error(`Failed to fetch schema: ${e.message}`));
          });
      });
    } catch (error) {
      throw new Error(`Failed to fetch schema from ${source}: ${error.message}`);
    }
  } else {
    // Read from local file
    try {
      const content = fs.readFileSync(source, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to read local schema from ${source}: ${error.message}`);
    }
  }
}

/**
 * Extract all SCREAMING_CASE enum names from OpenAPI schema
 */
function extractEnumNames(schema) {
  const enumNames = new Set();

  if (schema.components && schema.components.schemas) {
    Object.keys(schema.components.schemas).forEach((name) => {
      // Check if name is SCREAMING_CASE (all uppercase with underscores)
      if (/^[A-Z][A-Z0-9_]*$/.test(name)) {
        const schemaObj = schema.components.schemas[name];
        // Verify it's actually an enum
        if (schemaObj.enum || schemaObj.type === 'string') {
          enumNames.add(name);
        }
      }
    });
  }

  return Array.from(enumNames).sort();
}

/**
 * Generate model name mappings for openapi-generator
 */
function generateModelNameMappings(enumNames) {
  // Map each SCREAMING_CASE name to itself to preserve the naming
  return enumNames.map((name) => `${name}=${name}`).join(',');
}

/**
 * Run openapi-generator-cli
 */
function runGenerator(schemaSource, modelNameMappings) {
  console.log(`\n🔧 Running openapi-generator-cli...`);
  console.log(`   Schema: ${schemaSource}`);
  console.log(`   Output: ${OUTPUT_DIR}`);
  console.log(`   Mappings: ${modelNameMappings.split(',').length} enum name mappings\n`);

  const command = [
    'npx openapi-generator-cli generate',
    `-i ${schemaSource}`,
    `-g typescript-angular`,
    `-o ${OUTPUT_DIR}`,
    `--model-name-mappings "${modelNameMappings}"`,
  ].join(' ');

  try {
    execSync(command, { stdio: 'inherit', shell: true });
    console.log('\n✅ API client generated successfully!');
  } catch (error) {
    console.error('\n❌ Failed to generate API client');
    throw error;
  }
}

/**
 * Run prettier on generated files
 */
function runPrettier() {
  console.log('\n🎨 Running prettier on generated files...');

  try {
    // Format only the generated API client directory for speed
    const prettierCommand = `npx prettier "${OUTPUT_DIR}" --write --log-level warn`;
    execSync(prettierCommand, { stdio: 'inherit', shell: true });
    console.log('✅ Formatting complete!');
  } catch (error) {
    console.error('⚠️  Prettier failed (non-fatal):', error.message);
    // Don't throw - this is non-fatal
  }
}

/**
 * Save schema to local file (if fetched from URL)
 */
function saveSchemaLocally(schema) {
  if (!useLocal && schemaSource !== LOCAL_SCHEMA_PATH) {
    console.log(`\n💾 Saving schema to ${LOCAL_SCHEMA_PATH}...`);
    try {
      const dir = path.dirname(LOCAL_SCHEMA_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(LOCAL_SCHEMA_PATH, JSON.stringify(schema, null, 2), 'utf8');
      console.log('✅ Schema saved locally');
    } catch (error) {
      console.error('⚠️  Failed to save schema locally:', error.message);
    }
  }
}

/**
 * Validates that the output directory has the .generated marker file
 * to prevent accidental execution in the wrong directory.
 * @throws {Error} If marker file is not found and --force flag is not set
 */
function validateOutputDirectory() {
  const markerPath = path.join(OUTPUT_DIR, '.generated');
  const markerExists = fs.existsSync(markerPath);

  if (!markerExists && !forceGenerate) {
    console.error('\n❌ Safety check failed!');
    console.error(`\nThe marker file '${markerPath}' was not found.`);
    console.error('This usually means the script is being run in the wrong directory.');
    console.error('\nTo proceed anyway, use the --force flag:');
    console.error('  npm run generate-client -- --force');
    console.error('  node scripts/generate-api-client.js --force\n');
    throw new Error('Missing .generated marker file');
  }

  if (!markerExists && forceGenerate) {
    console.log(
      '⚠️  Warning: .generated marker file not found, but --force flag is set. Proceeding...',
    );
  } else {
    console.log('✅ Output directory validated (.generated marker found)');
  }
}

// ============================================================================
// Main Execution
// ============================================================================

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║         Generate API Client from OpenAPI Schema               ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  try {
    // Step 0: Validate output directory
    validateOutputDirectory();

    // Step 1: Fetch OpenAPI schema
    const schema = await fetchSchema(schemaSource);
    console.log(`✅ Schema loaded successfully`);
    console.log(`   OpenAPI version: ${schema.openapi}`);
    console.log(`   Title: ${schema.info?.title || 'N/A'}`);
    console.log(`   Version: ${schema.info?.version || 'N/A'}`);

    // Step 2: Extract SCREAMING_CASE enum names
    console.log(`\n🔍 Discovering SCREAMING_CASE enum names...`);
    const enumNames = extractEnumNames(schema);
    console.log(`✅ Found ${enumNames.length} SCREAMING_CASE enums:`);
    enumNames.forEach((name) => console.log(`   - ${name}`));

    // Step 3: Generate model name mappings
    const modelNameMappings = generateModelNameMappings(enumNames);

    // Step 4: Run openapi-generator
    runGenerator(schemaSource, modelNameMappings);

    // Step 5: Run prettier
    runPrettier();

    // Step 6: Save schema locally (if fetched from URL)
    saveSchemaLocally(schema);

    console.log('\n╔═══════════════════════════════════════════════════════════════╗');
    console.log('║                  ✅ Generation Complete!                      ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝\n');

    console.log('Next steps:');
    console.log(
      '  1. Run drift detection tests: npm test -- --include=src/app/models/api.models.drift.spec.ts',
    );
    console.log('  2. Review generated files in: ' + OUTPUT_DIR);
    console.log('  3. Update any code that uses changed types\n');
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { fetchSchema, extractEnumNames, generateModelNameMappings };
