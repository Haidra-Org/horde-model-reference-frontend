const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

// Keep runtime validation small and regenerate it with the API client.
function writeModelInputSchemas(schema) {
  const source = schema.components.schemas;
  const roots = { v2: {}, legacy: {} };
  for (const [name, definition] of Object.entries(source)) {
    if (name.endsWith('ModelRecord') && definition.properties?.record_type?.default) {
      roots.v2[definition.properties.record_type.default] = {
        $ref: `#/components/schemas/${name}`,
      };
    }
  }
  for (const [route, item] of Object.entries(schema.paths)) {
    const match = route.match(/^\/model_references\/v1\/([^/]+)$/);
    const input = item.post?.requestBody?.content?.['application/json']?.schema;
    if (match && input) roots.legacy[match[1]] = input;
  }
  const allowed = new Set([
    '$ref',
    'type',
    'properties',
    'items',
    'anyOf',
    'oneOf',
    'allOf',
    'additionalProperties',
    'propertyNames',
    'required',
    'enum',
    'const',
  ]);
  function compact(value) {
    if (Array.isArray(value)) return value.map(compact);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => allowed.has(key))
        .map(([key, entry]) => [
          key,
          key === 'properties'
            ? Object.fromEntries(Object.entries(entry).map(([prop, def]) => [prop, compact(def)]))
            : compact(entry),
        ]),
    );
  }
  const components = {};
  function visit(value) {
    if (!value || typeof value !== 'object') return;
    if (value.$ref) {
      const name = value.$ref.split('/').pop();
      if (!(name in components)) {
        components[name] = compact(source[name]);
        visit(components[name]);
      }
    }
    for (const entry of Object.values(value)) visit(entry);
  }
  visit(roots);
  const output = { roots, components };
  const destination = path.resolve(__dirname, '../src/assets/model-input-schemas.json');
  fs.writeFileSync(destination, JSON.stringify(output, null, 2) + '\n');
  execFileSync(
    process.execPath,
    [
      path.resolve(__dirname, '../node_modules/prettier/bin/prettier.cjs'),
      destination,
      '--write',
      '--log-level',
      'silent',
    ],
    { stdio: 'inherit' },
  );
}
module.exports = { writeModelInputSchemas };
if (require.main === module) {
  writeModelInputSchemas(
    JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '../src/assets/openapi-schema.json'), 'utf8'),
    ),
  );
}
