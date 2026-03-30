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
 * Pre-process the OpenAPI schema to fix patterns that openapi-generator handles incorrectly.
 *
 * Fixes two issues:
 * 1. Inline `anyOf` unions (e.g. NewModelRecord, ResponseReadV2ReferenceValue) get flattened
 *    into a single merged interface with ALL fields required simultaneously. We convert these
 *    to `oneOf` with a discriminator so the generator emits a proper discriminated union.
 * 2. Field-level `anyOf: [{$ref: SomeEnum}, {type: string}]` produces empty interfaces
 *    (Baseline {}, ControlnetStyle {}, etc.). We collapse these to `{type: string}` since
 *    the enum values are a subset of valid strings.
 */
function preprocessSchema(schema) {
  console.log('\n🔧 Pre-processing OpenAPI schema...');
  let fixCount = 0;

  // Fix 1: Convert inline anyOf unions to oneOf with discriminator
  fixCount += fixInlineAnyOfUnions(schema);

  // Fix 2: Collapse field-level anyOf enum+string patterns to string
  fixCount += collapseEnumStringAnyOf(schema);

  console.log(`✅ Schema pre-processing complete (${fixCount} fixes applied)`);
  return schema;
}

/**
 * Find inline `anyOf` arrays in request/response bodies that reference multiple model record
 * schemas and convert them to `oneOf` with a `record_type` discriminator. This produces proper
 * TypeScript discriminated unions instead of a single flat merged interface.
 */
function fixInlineAnyOfUnions(schema) {
  let fixCount = 0;
  const DISCRIMINATOR_FIELD = 'record_type';

  // Model record $ref patterns that indicate a union of category-specific types
  const INPUT_REFS = new Set([
    '#/components/schemas/ImageGenerationModelRecord-Input',
    '#/components/schemas/TextGenerationModelRecord-Input',
    '#/components/schemas/ControlNetModelRecord-Input',
    '#/components/schemas/GenericModelRecord-Input',
  ]);
  const OUTPUT_REFS = new Set([
    '#/components/schemas/ImageGenerationModelRecord-Output',
    '#/components/schemas/TextGenerationModelRecord-Output',
    '#/components/schemas/ControlNetModelRecord-Output',
    '#/components/schemas/GenericModelRecord-Output',
  ]);

  function isModelRecordUnion(anyOfArray) {
    if (!Array.isArray(anyOfArray) || anyOfArray.length < 3) return false;
    const refs = anyOfArray.filter((e) => e.$ref).map((e) => e.$ref);
    if (refs.length !== anyOfArray.length) return false;
    const allInput = refs.every((r) => INPUT_REFS.has(r));
    const allOutput = refs.every((r) => OUTPUT_REFS.has(r));
    return allInput || allOutput;
  }

  function convertAnyOfToOneOf(obj) {
    obj.oneOf = obj.anyOf;
    delete obj.anyOf;
    obj.discriminator = { propertyName: DISCRIMINATOR_FIELD };
    fixCount++;
  }

  // Walk all paths looking for anyOf in request bodies and response schemas
  if (schema.paths) {
    for (const [, pathItem] of Object.entries(schema.paths)) {
      for (const [, operation] of Object.entries(pathItem)) {
        if (typeof operation !== 'object' || operation === null) continue;

        // Request body
        const reqSchema =
          operation.requestBody?.content?.['application/json']?.schema;
        if (reqSchema?.anyOf && isModelRecordUnion(reqSchema.anyOf)) {
          console.log(`   Fixed request body union: ${reqSchema.title || '(inline)'}`);
          convertAnyOfToOneOf(reqSchema);
        }

        // Response bodies — check additionalProperties (dict values) and direct schemas
        const responses = operation.responses;
        if (responses) {
          for (const [, resp] of Object.entries(responses)) {
            const respSchema = resp?.content?.['application/json']?.schema;
            if (!respSchema) continue;

            if (respSchema.anyOf && isModelRecordUnion(respSchema.anyOf)) {
              console.log(`   Fixed response union: ${respSchema.title || '(inline)'}`);
              convertAnyOfToOneOf(respSchema);
            }
            if (
              respSchema.additionalProperties?.anyOf &&
              isModelRecordUnion(respSchema.additionalProperties.anyOf)
            ) {
              console.log(`   Fixed response dict value union: ${respSchema.title || '(inline)'}`);
              convertAnyOfToOneOf(respSchema.additionalProperties);
            }
          }
        }
      }
    }
  }

  return fixCount;
}

/**
 * Collapse field-level `anyOf: [{$ref: SomeEnum}, {type: string}]` patterns down to
 * `{type: string}`. The generator creates empty interfaces for these (e.g. `Baseline {}`)
 * because it can't represent "enum OR string" as a TypeScript type. Since the enum values
 * are a valid subset of strings, collapsing to string is safe and eliminates dead types.
 *
 * Also handles nullable variants like `[{type: string}, {$ref: SomeEnum}, {type: null}]`
 * by removing the $ref and keeping `[{type: string}, {type: null}]`.
 */
function collapseEnumStringAnyOf(schema) {
  let fixCount = 0;

  function hasEnumRef(anyOfArray) {
    return anyOfArray.some((e) => e.$ref);
  }

  function hasStringType(anyOfArray) {
    return anyOfArray.some((e) => e.type === 'string');
  }

  function isEnumPlusString(anyOfArray) {
    if (!Array.isArray(anyOfArray) || anyOfArray.length < 2) return false;
    return hasEnumRef(anyOfArray) && hasStringType(anyOfArray);
  }

  function collapseField(obj) {
    const remaining = obj.anyOf.filter((e) => !e.$ref);
    if (remaining.length === 1 && remaining[0].type === 'string') {
      // Simple case: just enum + string → string
      delete obj.anyOf;
      obj.type = 'string';
    } else {
      // Nullable or multi-entry: remove $ref entries, keep the rest as anyOf
      obj.anyOf = remaining;
    }
    fixCount++;
  }

  // Walk all component schema properties
  if (schema.components?.schemas) {
    for (const [schemaName, schemaDef] of Object.entries(schema.components.schemas)) {
      if (!schemaDef.properties) continue;
      for (const [propName, propDef] of Object.entries(schemaDef.properties)) {
        if (propDef.anyOf && isEnumPlusString(propDef.anyOf)) {
          console.log(`   Collapsed ${schemaName}.${propName}: anyOf[enum, string] → string`);
          collapseField(propDef);
        }
      }
    }
  }

  return fixCount;
}

/**
 * Clean *.ts files from api and model folders before generation
 */
function cleanOutputFolders() {
  console.log('\n🧹 Cleaning *.ts files from output folders...');

  const apiDir = path.join(OUTPUT_DIR, 'api');
  const modelDir = path.join(OUTPUT_DIR, 'model');

  let deletedCount = 0;

  try {
    // Clean *.ts files from api directory (only at this depth, not recursive)
    if (fs.existsSync(apiDir)) {
      const apiFiles = fs.readdirSync(apiDir);
      for (const file of apiFiles) {
        if (file.endsWith('.ts')) {
          const filePath = path.join(apiDir, file);
          const stats = fs.statSync(filePath);
          if (stats.isFile()) {
            fs.unlinkSync(filePath);
            deletedCount++;
          }
        }
      }
      console.log(`   ✅ Cleaned ${apiDir}`);
    }

    // Clean *.ts files from model directory (only at this depth, not recursive)
    if (fs.existsSync(modelDir)) {
      const modelFiles = fs.readdirSync(modelDir);
      for (const file of modelFiles) {
        if (file.endsWith('.ts')) {
          const filePath = path.join(modelDir, file);
          const stats = fs.statSync(filePath);
          if (stats.isFile()) {
            fs.unlinkSync(filePath);
            deletedCount++;
          }
        }
      }
      console.log(`   ✅ Cleaned ${modelDir}`);
    }

    console.log(`✅ Cleanup complete! (${deletedCount} .ts files removed)`);
  } catch (error) {
    console.error('⚠️  Failed to clean output folders:', error.message);
    throw error;
  }
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
 * Fix imports broken by openapi-generator's case-insensitive collision renaming.
 *
 * On case-insensitive filesystems (Windows/macOS), the generator detects that e.g.
 * "controlnetStyle.ts" collides with "cONTROLNETSTYLE.ts" and renames the former to
 * "controlnetStyle0.ts". However, it does NOT update the import paths in other generated
 * files, leaving them pointing at the non-existent "./controlnetStyle".
 *
 * This function finds all such renamed files (ending in a digit before .ts) and rewrites
 * any stale imports/exports across the model directory.
 */
function fixCaseCollisionImports() {
  const modelDir = path.join(OUTPUT_DIR, 'model');
  if (!fs.existsSync(modelDir)) return;

  console.log('\n🔧 Checking for case-insensitive filename collision fixups...');

  const allFiles = fs.readdirSync(modelDir).filter((f) => f.endsWith('.ts'));
  const basenames = new Map(); // lowercase stem → [actual stems]

  for (const file of allFiles) {
    const stem = file.replace(/\.ts$/, '');
    const lower = stem.toLowerCase();
    if (!basenames.has(lower)) basenames.set(lower, []);
    basenames.get(lower).push(stem);
  }

  // Find groups where a numeric-suffixed file exists alongside a SCREAMING_CASE file
  const renames = new Map(); // oldStem (without suffix) → newStem (with suffix)
  for (const [lower, stems] of basenames) {
    if (stems.length < 2) continue;
    for (const stem of stems) {
      // Detect names like "controlnetStyle0" — ends with digit, and removing it
      // would collide case-insensitively with another file in the group
      const suffixMatch = stem.match(/^(.+?)(\d+)$/);
      if (!suffixMatch) continue;
      const baseStem = suffixMatch[1];
      if (baseStem.toLowerCase() === lower.replace(/\d+$/, '') || stems.some((s) => s !== stem && s.toLowerCase() === baseStem.toLowerCase())) {
        renames.set(baseStem, stem);
      }
    }
  }

  if (renames.size === 0) {
    console.log('   No collision fixups needed.');
    return;
  }

  let fixCount = 0;
  for (const [oldStem, newStem] of renames) {
    console.log(`   Fixing: ./${oldStem} → ./${newStem}`);

    // Rewrite imports/exports in all .ts files under the model directory
    for (const file of allFiles) {
      const filePath = path.join(modelDir, file);
      let content = fs.readFileSync(filePath, 'utf8');
      // Match import/export from './oldStem' (exact stem, not prefix)
      const pattern = new RegExp(`(from\\s+['\"]\\.\\/)(${oldStem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(['"])`, 'g');
      const replaced = content.replace(pattern, `$1${newStem}$3`);
      if (replaced !== content) {
        fs.writeFileSync(filePath, replaced, 'utf8');
        fixCount++;
      }
    }
  }

  console.log(`✅ Fixed ${fixCount} import references across ${renames.size} collision(s).`);
}

/**
 * Post-process generated TypeScript files to fix types that openapi-generator produced
 * incorrectly despite schema preprocessing. The generator flattens oneOf/anyOf unions
 * into a single merged interface regardless of schema structure.
 *
 * This rewrites:
 * 1. `NewModelRecord` interface → union type alias of category-specific Input types
 * 2. `ResponseReadV2ReferenceValue` interface → union type alias of Output types
 * 3. Empty interfaces (Baseline, Style, ControlnetStyle, RecordType) → `string` aliases
 */
function postProcessGeneratedTypes() {
  console.log('\n🔧 Post-processing generated types...');
  const modelDir = path.join(OUTPUT_DIR, 'model');
  let fixCount = 0;

  fixCount += rewriteUnionType(modelDir, 'newModelRecord.ts', 'NewModelRecord', [
    { type: 'ImageGenerationModelRecordInput', from: './imageGenerationModelRecordInput' },
    { type: 'TextGenerationModelRecordInput', from: './textGenerationModelRecordInput' },
    { type: 'ControlNetModelRecordInput', from: './controlNetModelRecordInput' },
    { type: 'GenericModelRecordInput', from: './genericModelRecordInput' },
  ]);

  fixCount += rewriteUnionType(modelDir, 'responseReadV2ReferenceValue.ts', 'ResponseReadV2ReferenceValue', [
    { type: 'ImageGenerationModelRecordOutput', from: './imageGenerationModelRecordOutput' },
    { type: 'TextGenerationModelRecordOutput', from: './textGenerationModelRecordOutput' },
    { type: 'ControlNetModelRecordOutput', from: './controlNetModelRecordOutput' },
    { type: 'GenericModelRecordOutput', from: './genericModelRecordOutput' },
  ]);

  fixCount += rewriteEmptyInterfaceToString(modelDir, 'baseline.ts', 'Baseline');
  fixCount += rewriteEmptyInterfaceToString(modelDir, 'style.ts', 'Style');
  fixCount += rewriteEmptyInterfaceToString(modelDir, 'recordType.ts', 'RecordType');

  // controlnetStyle may have been renamed by fixCaseCollisionImports
  const controlnetFile = fs.existsSync(path.join(modelDir, 'controlnetStyle0.ts'))
    ? 'controlnetStyle0.ts'
    : 'controlnetStyle.ts';
  fixCount += rewriteEmptyInterfaceToString(modelDir, controlnetFile, 'ControlnetStyle');

  console.log(`✅ Post-processing complete (${fixCount} types rewritten)`);
  return fixCount;
}

/**
 * Rewrite a flat merged interface into a union type alias.
 */
function rewriteUnionType(modelDir, filename, typeName, members) {
  const filePath = path.join(modelDir, filename);
  if (!fs.existsSync(filePath)) {
    console.log(`   ⚠️  ${filename} not found, skipping`);
    return 0;
  }

  const imports = members
    .map((m) => `import { ${m.type} } from '${m.from}';`)
    .join('\n');
  const union = members.map((m) => m.type).join('\n  | ');

  const content = [
    '/**',
    ' * FastAPI',
    ' *',
    ' * NOTE: This class is auto generated by OpenAPI Generator (https://openapi-generator.tech).',
    ' * https://openapi-generator.tech',
    ' *',
    ` * Post-processed by generate-api-client.js to produce a proper union type.`,
    ' */',
    imports,
    '',
    `export type ${typeName} =`,
    `  | ${union};`,
    '',
  ].join('\n');

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`   Rewrote ${filename}: interface → union type`);
  return 1;
}

/**
 * Rewrite an empty interface (e.g. `export interface Baseline {}`) into a string type alias.
 */
function rewriteEmptyInterfaceToString(modelDir, filename, typeName) {
  const filePath = path.join(modelDir, filename);
  if (!fs.existsSync(filePath)) {
    console.log(`   ⚠️  ${filename} not found, skipping`);
    return 0;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  if (!content.includes(`export interface ${typeName} {}`)) {
    console.log(`   ⚠️  ${filename} doesn't contain empty interface, skipping`);
    return 0;
  }

  const newContent = [
    '/**',
    ' * FastAPI',
    ' *',
    ' * NOTE: This class is auto generated by OpenAPI Generator (https://openapi-generator.tech).',
    ' * https://openapi-generator.tech',
    ' *',
    ` * Post-processed by generate-api-client.js to use string instead of empty interface.`,
    ' */',
    '',
    `export type ${typeName} = string;`,
    '',
  ].join('\n');

  fs.writeFileSync(filePath, newContent, 'utf8');
  console.log(`   Rewrote ${filename}: empty interface → string type alias`);
  return 1;
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
    // Verify openapi-generator-cli is installed. Note that this "error" ('You're trying to run a package that should be provided by a local binary, but isn't') is simply returned 
    
    generation_cli_return_string = execSync('npx openapi-generator-cli version', { shell: true }).toString().trim();

    if (generation_cli_return_string.includes('You\'re trying to run a package that should be provided by a local binary, but isn\'t')) {
      console.error('\n❌ openapi-generator-cli is not installed!');
      console.error('Please install it globally with: npm install -g @openapitools/openapi-generator-cli');
      process.exit(1);
    }

    

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

    // Step 4: Clean output folders
    cleanOutputFolders();

    // Step 5: Pre-process schema to fix generator issues
    preprocessSchema(schema);

    // Step 6: Write preprocessed schema to temp file for generator input
    // Uses relative path — the Java-based generator chokes on absolute Windows paths
    const preprocessedSchemaPath = './preprocessed-schema.json';
    fs.writeFileSync(preprocessedSchemaPath, JSON.stringify(schema, null, 2), 'utf8');

    // Step 7: Run openapi-generator (using preprocessed schema)
    runGenerator(preprocessedSchemaPath, modelNameMappings);

    // Clean up temp file
    if (fs.existsSync(preprocessedSchemaPath)) {
      fs.unlinkSync(preprocessedSchemaPath);
    }

    // Step 7: Fix case-insensitive filename collision imports
    fixCaseCollisionImports();

    // Step 8: Post-process generated types (rewrite unions and empty interfaces)
    postProcessGeneratedTypes();

    // Step 9: Run prettier
    runPrettier();

    // Step 10: Save schema locally (if fetched from URL)
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

module.exports = {
  fetchSchema,
  extractEnumNames,
  generateModelNameMappings,
  preprocessSchema,
  fixInlineAnyOfUnions,
  collapseEnumStringAnyOf,
  postProcessGeneratedTypes,
  rewriteUnionType,
  rewriteEmptyInterfaceToString,
};
