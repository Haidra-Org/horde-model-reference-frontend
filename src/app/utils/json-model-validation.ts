import schemasJson from '../../assets/model-input-schemas.json';
import type { ModelReferenceCategory } from '../models/api.models';
import { editFormFromRecord, formToRecord } from './write-record';
import { prepareWriteRequest } from './write-request';

interface Schema {
  $ref?: string;
  type?: string;
  properties?: Record<string, Schema>;
  items?: Schema;
  anyOf?: Schema[];
  oneOf?: Schema[];
  allOf?: Schema[];
  additionalProperties?: Schema | boolean;
  propertyNames?: Schema;
  required?: string[];
  enum?: unknown[];
  const?: unknown;
}
const catalog = schemasJson as unknown as {
  roots: Record<'v2' | 'legacy', Record<string, Schema>>;
  components: Record<string, Schema>;
};
export interface JsonModelIssue {
  code:
    | 'JSON_UNKNOWN_FIELD'
    | 'JSON_SCHEMA_MISMATCH'
    | 'JSON_UNSUPPORTED_SCHEMA'
    | 'JSON_FORM_CONVERSION';
  path: string;
  message: string;
}
function fieldPath(path: string, key: string): string {
  return /^[a-zA-Z_]\w*$/.test(key) ? `${path}.${key}` : `${path}[${JSON.stringify(key)}]`;
}
function resolve(schema: Schema): Schema | undefined {
  if (!schema.$ref) return schema;
  return catalog.components[schema.$ref.split('/').pop()!];
}
function requestSchema(category: string, format: string): Schema | undefined {
  const root = catalog.roots[format === 'legacy' ? 'legacy' : 'v2'][category];
  if (!root) return undefined;
  const schema = resolve(root);
  if (!schema || format !== 'legacy') return schema;
  // The legacy API accepts canonical record/download metadata through explicit
  // extension fields. Dictionaries (requirements/settings/etc.) stay open.
  const canonical = catalog.roots.v2[category] ? resolve(catalog.roots.v2[category]) : undefined;
  const properties = { ...canonical?.properties, ...schema.properties };
  const config = resolve(properties['config'] ?? {});
  if (config?.properties?.['download']) {
    const download = config.properties['download'];
    const legacyFile = resolve(download.items ?? {});
    const canonicalFile = catalog.components['DownloadRecord'];
    properties['config'] = {
      ...config,
      properties: {
        ...config.properties,
        download: {
          ...download,
          items: {
            ...legacyFile,
            properties: { ...canonicalFile?.properties, ...legacyFile?.properties },
          },
        },
      },
    };
  }
  return { ...schema, properties };
}

/** Check declared record keys and shapes, while permitting schema-defined dictionaries. */
export function validateJsonModel(
  value: unknown,
  category: string,
  format: string,
): JsonModelIssue[] {
  const root = requestSchema(category, format);
  if (!root)
    return [
      {
        code: 'JSON_UNSUPPORTED_SCHEMA',
        path: '$',
        message: `JSON validation is unavailable for ${category} in ${format} format. Select “Submit JSON as written” to use API validation.`,
      },
    ];
  return walk(value, root, '$', 0);
}
function walk(value: unknown, definition: Schema, path: string, depth: number): JsonModelIssue[] {
  const schema = resolve(definition);
  if (!schema || depth > 128)
    return [
      {
        code: 'JSON_UNSUPPORTED_SCHEMA',
        path,
        message: 'This JSON structure is not supported by the form.',
      },
    ];
  const variants = schema.anyOf ?? schema.oneOf;
  if (variants) {
    const compatible = variants.filter((variant) => {
      const item = resolve(variant);
      const type = item?.type ?? (item?.properties ? 'object' : item?.items ? 'array' : undefined);
      return (
        !type ||
        (type === 'null'
          ? value === null
          : type === 'array'
            ? Array.isArray(value)
            : type === 'object'
              ? value !== null && typeof value === 'object' && !Array.isArray(value)
              : type === 'integer'
                ? typeof value === 'number' && Number.isInteger(value)
                : typeof value === type)
      );
    });
    const candidates = (compatible.length ? compatible : variants).map((variant) =>
      walk(value, variant, path, depth + 1),
    );
    return candidates.sort((a, b) => score(a) - score(b))[0] ?? [];
  }
  if (schema.allOf) return schema.allOf.flatMap((entry) => walk(value, entry, path, depth + 1));
  const type = schema.type ?? (schema.properties ? 'object' : schema.items ? 'array' : undefined);
  const matches =
    !type ||
    (type === 'null'
      ? value === null
      : type === 'array'
        ? Array.isArray(value)
        : type === 'object'
          ? value !== null && typeof value === 'object' && !Array.isArray(value)
          : type === 'integer'
            ? typeof value === 'number' && Number.isInteger(value)
            : type === 'number'
              ? typeof value === 'number'
              : typeof value === type);
  if (!matches) return [{ code: 'JSON_SCHEMA_MISMATCH', path, message: `Expected ${type}.` }];
  if (schema.enum && !schema.enum.includes(value))
    return [
      {
        code: 'JSON_SCHEMA_MISMATCH',
        path,
        message: `Expected one of: ${schema.enum.map(String).join(', ')}.`,
      },
    ];
  if (Object.hasOwn(schema, 'const') && schema.const !== value)
    return [{ code: 'JSON_SCHEMA_MISMATCH', path, message: `Expected ${String(schema.const)}.` }];
  if (Array.isArray(value))
    return schema.items
      ? value.flatMap((item, i) => walk(item, schema.items!, `${path}[${i}]`, depth + 1))
      : [];
  if (!value || typeof value !== 'object') return [];
  const object = value as Record<string, unknown>;
  const issues: JsonModelIssue[] = [];
  for (const key of schema.required ?? [])
    if (!Object.hasOwn(object, key)) {
      issues.push({
        code: 'JSON_SCHEMA_MISMATCH',
        path: fieldPath(path, key),
        message: 'Required field is missing.',
      });
    }
  for (const [key, entry] of Object.entries(object)) {
    const at = fieldPath(path, key);
    if (schema.propertyNames) issues.push(...walk(key, schema.propertyNames, at, depth + 1));
    if (schema.properties && Object.hasOwn(schema.properties, key)) {
      issues.push(...walk(entry, schema.properties[key], at, depth + 1));
    } else if (schema.properties || schema.additionalProperties === false) {
      issues.push({
        code: 'JSON_UNKNOWN_FIELD',
        path: at,
        message:
          'Unrecognized field. Remove it or select “Submit JSON as written” to use API validation.',
      });
    } else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
      issues.push(...walk(entry, schema.additionalProperties, at, depth + 1));
    }
  }
  return issues;
}
function score(issues: JsonModelIssue[]): number {
  return issues.reduce(
    (total, issue) => total + (issue.code === 'JSON_SCHEMA_MISMATCH' ? 100 : 1),
    0,
  );
}

/** Paths supplied by the author that conversion would remove or change; additions are harmless. */
export function changedJsonPaths(before: unknown, after: unknown, path = '$'): string[] {
  if (Object.is(before, after)) return [];
  if (Array.isArray(before)) {
    if (!Array.isArray(after)) return [path];
    const changed = before.flatMap((entry, i) =>
      changedJsonPaths(entry, after[i], `${path}[${i}]`),
    );
    return before.length !== after.length && !changed.length ? [path] : changed;
  }
  if (before !== null && typeof before === 'object') {
    if (after === null || typeof after !== 'object' || Array.isArray(after)) return [path];
    return Object.entries(before).flatMap(([key, entry]) =>
      changedJsonPaths(entry, (after as Record<string, unknown>)[key], fieldPath(path, key)),
    );
  }
  return [path];
}
export function inspectJsonModel(
  record: Record<string, unknown>,
  category: ModelReferenceCategory,
  format: string,
): JsonModelIssue[] {
  const issues = validateJsonModel(record, category, format);
  if (issues.length) return issues;
  try {
    const projected = prepareWriteRequest(
      formToRecord(editFormFromRecord(category, record), category),
      category,
      format,
    );
    return changedJsonPaths(record, projected).map((path) => ({
      code: 'JSON_FORM_CONVERSION',
      path,
      message:
        'This value is not supported by the form. Update it or select “Submit JSON as written”.',
    }));
  } catch {
    return [
      {
        code: 'JSON_FORM_CONVERSION',
        path: '$',
        message:
          'This JSON structure is not supported by the form. Update it or select “Submit JSON as written”.',
      },
    ];
  }
}
