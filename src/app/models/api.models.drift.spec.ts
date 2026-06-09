/**
 * Drift guards for the generated API client — runs with NO backend.
 *
 * Why this exists: a prior regeneration silently produced a non-compiling client (union files
 * importing modules that no longer existed) because the generator's union handling drifted from the
 * backend schema, and the only check that would have caught it (`npm run type-check`) was a no-op at
 * the time. These guards are the cheap, always-on safety net the rest of the tooling now points at.
 *
 * Two layers:
 *  - Runtime: read the committed `src/assets/openapi-schema.json` and assert it still exposes the
 *    model-record union(s) the generator's structural detection relies on, with every member
 *    resolving to a real component schema. If the backend reshapes these so the generator would
 *    silently no-op, this fails.
 *  - Compile-time: the type assignments below fail `npm run type-check` if the seam
 *    (`src/app/models/api.models.ts`) stops re-exporting a generated record type, or if a category
 *    record leaves the `NewModelRecord` / `ResponseReadV2ReferenceValue` union.
 */
import openApiSchemaJson from '../../assets/openapi-schema.json';
import type { OpenApiSchema, OpenApiSchemaDefinition } from './test-helpers';
import { assertBidirectionalTypeCompatibility } from './test-helpers';
import type {
  ControlNetModelRecord,
  GenericModelRecord,
  ImageGenerationModelRecord,
  NewModelRecord,
  ResponseReadV2ReferenceValue,
  TextGenerationModelRecord,
} from './api.models';

const schema = openApiSchemaJson as unknown as OpenApiSchema;

// Mirror of MODEL_RECORD_REF_RE in scripts/generate-api-client.js — keep the two in sync.
const MODEL_RECORD_REF_RE = /\/[A-Za-z]*ModelRecord$/;

// Minimum members we expect in a real model-record union, as a floor against a degenerate schema.
const MIN_UNION_MEMBERS = 5;

interface OperationLike {
  requestBody?: { content?: Record<string, { schema?: OpenApiSchemaDefinition }> };
  responses?: Record<string, { content?: Record<string, { schema?: OpenApiSchemaDefinition }> }>;
}

/**
 * If `node` is a model-record union (an `anyOf`/`oneOf` whose members are all `*ModelRecord` refs),
 * return the member schema names; otherwise null. Accepts either `anyOf` (raw schema) or `oneOf`
 * (after the generator's pre-processing), matching the generator's own finders.
 */
function modelRecordUnionMembers(node: OpenApiSchemaDefinition | undefined): string[] | null {
  if (!node) return null;
  const members = node.oneOf ?? node.anyOf;
  if (!Array.isArray(members) || members.length < MIN_UNION_MEMBERS) return null;
  const refs = members
    .map((member) => (typeof member['$ref'] === 'string' ? member['$ref'] : null))
    .filter((ref): ref is string => ref !== null);
  if (refs.length !== members.length) return null;
  if (!refs.every((ref) => MODEL_RECORD_REF_RE.test(ref))) return null;
  return refs.map((ref) => ref.split('/').pop() as string);
}

function asDefinition(value: unknown): OpenApiSchemaDefinition | undefined {
  return value && typeof value === 'object' ? (value as OpenApiSchemaDefinition) : undefined;
}

/** Walk request bodies and responses (incl. dict-value `additionalProperties`) for record unions. */
function collectModelRecordUnions(): { location: string; members: string[] }[] {
  const found: { location: string; members: string[] }[] = [];
  for (const [routePath, pathItem] of Object.entries(schema.paths ?? {})) {
    const operations = pathItem as Record<string, OperationLike>;
    for (const [method, operation] of Object.entries(operations)) {
      if (!operation || typeof operation !== 'object') continue;
      const reqSchema = operation.requestBody?.content?.['application/json']?.schema;
      const reqMembers = modelRecordUnionMembers(reqSchema);
      if (reqMembers)
        found.push({
          location: `${method.toUpperCase()} ${routePath} (request)`,
          members: reqMembers,
        });

      for (const response of Object.values(operation.responses ?? {})) {
        const respSchema = response?.content?.['application/json']?.schema;
        const respMembers = modelRecordUnionMembers(respSchema);
        if (respMembers)
          found.push({
            location: `${method.toUpperCase()} ${routePath} (response)`,
            members: respMembers,
          });
        const mapMembers = modelRecordUnionMembers(asDefinition(respSchema?.additionalProperties));
        if (mapMembers)
          found.push({
            location: `${method.toUpperCase()} ${routePath} (response map)`,
            members: mapMembers,
          });
      }
    }
  }
  return found;
}

describe('API client drift guards', () => {
  describe('schema assumptions (runtime, no backend)', () => {
    it('loads the committed OpenAPI schema asset', () => {
      expect(schema.openapi).toBeTruthy();
      expect(schema.components?.schemas).toBeTruthy();
    });

    it('still exposes at least one model-record union the generator can detect', () => {
      // Guards the generator's core assumption. If this fails, the union post-processing in
      // scripts/generate-api-client.js would silently produce a wrong/merged type — update the
      // generator's detection (MODEL_RECORD_REF_RE / finders) to match the new schema shape.
      const unions = collectModelRecordUnions();
      expect(unions.length).toBeGreaterThan(0);
    });

    it('resolves every model-record union member to a component schema', () => {
      const schemas = schema.components?.schemas ?? {};
      const missing = collectModelRecordUnions().flatMap((union) =>
        union.members
          .filter((member) => !(member in schemas))
          .map((member) => `${union.location}: ${member}`),
      );
      expect(missing).toEqual([]);
    });
  });

  describe('generated type drift (compile-time)', () => {
    it('keeps each category record assignable to the write/read unions', () => {
      const imageInNew = assertBidirectionalTypeCompatibility<
        ImageGenerationModelRecord,
        NewModelRecord
      >();
      const textInNew = assertBidirectionalTypeCompatibility<
        TextGenerationModelRecord,
        NewModelRecord
      >();
      const controlInNew = assertBidirectionalTypeCompatibility<
        ControlNetModelRecord,
        NewModelRecord
      >();
      const genericInNew = assertBidirectionalTypeCompatibility<
        GenericModelRecord,
        NewModelRecord
      >();
      const imageInRead = assertBidirectionalTypeCompatibility<
        ImageGenerationModelRecord,
        ResponseReadV2ReferenceValue
      >();

      // Each assignment fails `npm run type-check` if the `.forward` type is `false` — i.e. the
      // record is no longer assignable to the union (renamed/dropped by a regeneration) or the
      // seam stopped re-exporting it.
      const imageOk: true = imageInNew.forward;
      const textOk: true = textInNew.forward;
      const controlOk: true = controlInNew.forward;
      const genericOk: true = genericInNew.forward;
      const imageReadOk: true = imageInRead.forward;

      expect([imageOk, textOk, controlOk, genericOk, imageReadOk]).toEqual([
        true,
        true,
        true,
        true,
        true,
      ]);
    });
  });
});
