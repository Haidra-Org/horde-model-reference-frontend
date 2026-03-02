import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
  preprocessSchema,
  fixInlineAnyOfUnions,
  collapseEnumStringAnyOf,
} = require('../generate-api-client');

describe('preprocessSchema', () => {
  describe('fixInlineAnyOfUnions', () => {
    it('converts request body anyOf to oneOf with discriminator', () => {
      const schema = {
        paths: {
          '/v2/{category}/{model_name}': {
            put: {
              requestBody: {
                content: {
                  'application/json': {
                    schema: {
                      anyOf: [
                        { $ref: '#/components/schemas/ImageGenerationModelRecord-Input' },
                        { $ref: '#/components/schemas/TextGenerationModelRecord-Input' },
                        { $ref: '#/components/schemas/ControlNetModelRecord-Input' },
                        { $ref: '#/components/schemas/GenericModelRecord-Input' },
                      ],
                      title: 'New Model Record',
                    },
                  },
                },
              },
            },
          },
        },
      };

      const count = fixInlineAnyOfUnions(schema);
      const result = schema.paths['/v2/{category}/{model_name}'].put.requestBody
        .content['application/json'].schema;

      expect(count).toBe(1);
      expect(result.anyOf).toBeUndefined();
      expect(result.oneOf).toHaveLength(4);
      expect(result.discriminator).toEqual({ propertyName: 'record_type' });
    });

    it('converts response additionalProperties anyOf (dict value union)', () => {
      const schema = {
        paths: {
          '/v2/{category}': {
            get: {
              responses: {
                200: {
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        additionalProperties: {
                          anyOf: [
                            { $ref: '#/components/schemas/ImageGenerationModelRecord-Output' },
                            { $ref: '#/components/schemas/TextGenerationModelRecord-Output' },
                            { $ref: '#/components/schemas/ControlNetModelRecord-Output' },
                            { $ref: '#/components/schemas/GenericModelRecord-Output' },
                          ],
                        },
                        title: 'Response Read V2 Reference',
                      },
                    },
                  },
                },
              },
            },
          },
        },
      };

      const count = fixInlineAnyOfUnions(schema);
      const result = schema.paths['/v2/{category}'].get.responses[200]
        .content['application/json'].schema.additionalProperties;

      expect(count).toBe(1);
      expect(result.anyOf).toBeUndefined();
      expect(result.oneOf).toHaveLength(4);
      expect(result.discriminator).toEqual({ propertyName: 'record_type' });
    });

    it('does not touch non-model-record anyOf patterns', () => {
      const schema = {
        paths: {
          '/some/endpoint': {
            get: {
              parameters: [
                {
                  schema: {
                    anyOf: [
                      { $ref: '#/components/schemas/PendingChangeStatus' },
                      { type: 'null' },
                    ],
                  },
                },
              ],
            },
          },
        },
      };

      const count = fixInlineAnyOfUnions(schema);
      expect(count).toBe(0);
    });

    it('does not touch anyOf with fewer than 3 $ref entries', () => {
      const schema = {
        paths: {
          '/v2/endpoint': {
            post: {
              requestBody: {
                content: {
                  'application/json': {
                    schema: {
                      anyOf: [
                        { $ref: '#/components/schemas/ImageGenerationModelRecord-Input' },
                        { type: 'null' },
                      ],
                    },
                  },
                },
              },
            },
          },
        },
      };

      const count = fixInlineAnyOfUnions(schema);
      expect(count).toBe(0);
    });
  });

  describe('collapseEnumStringAnyOf', () => {
    it('collapses anyOf[enum_ref, string] to just string', () => {
      const schema = {
        components: {
          schemas: {
            'ImageGenerationModelRecord-Input': {
              properties: {
                baseline: {
                  anyOf: [
                    { $ref: '#/components/schemas/KNOWN_IMAGE_GENERATION_BASELINE' },
                    { type: 'string' },
                  ],
                },
              },
            },
          },
        },
      };

      const count = collapseEnumStringAnyOf(schema);
      const result = schema.components.schemas['ImageGenerationModelRecord-Input']
        .properties.baseline;

      expect(count).toBe(1);
      expect(result.anyOf).toBeUndefined();
      expect(result.type).toBe('string');
    });

    it('collapses 3-entry anyOf[string, enum_ref, null] — removes $ref, keeps [string, null]', () => {
      const schema = {
        components: {
          schemas: {
            'ImageGenerationModelRecord-Input': {
              properties: {
                style: {
                  anyOf: [
                    { type: 'string' },
                    { $ref: '#/components/schemas/MODEL_STYLE' },
                    { type: 'null' },
                  ],
                },
              },
            },
          },
        },
      };

      const count = collapseEnumStringAnyOf(schema);
      const result = schema.components.schemas['ImageGenerationModelRecord-Input']
        .properties.style;

      expect(count).toBe(1);
      expect(result.anyOf).toEqual([{ type: 'string' }, { type: 'null' }]);
      expect(result.type).toBeUndefined();
    });

    it('does not collapse nullable anyOf[string, null]', () => {
      const schema = {
        components: {
          schemas: {
            'SomeSchema': {
              properties: {
                description: {
                  anyOf: [{ type: 'string' }, { type: 'null' }],
                },
              },
            },
          },
        },
      };

      const count = collapseEnumStringAnyOf(schema);
      expect(count).toBe(0);
    });

    it('correctly processes the real schema pattern for controlnet_style', () => {
      const schema = {
        components: {
          schemas: {
            'ControlNetModelRecord-Input': {
              properties: {
                controlnet_style: {
                  anyOf: [
                    { $ref: '#/components/schemas/CONTROLNET_STYLE' },
                    { type: 'string' },
                  ],
                },
              },
            },
          },
        },
      };

      const count = collapseEnumStringAnyOf(schema);
      expect(count).toBe(1);
      expect(schema.components.schemas['ControlNetModelRecord-Input']
        .properties.controlnet_style.type).toBe('string');
    });

    it('correctly processes the real schema pattern for record_type', () => {
      const schema = {
        components: {
          schemas: {
            'GenericModelRecord-Input': {
              properties: {
                record_type: {
                  anyOf: [
                    { $ref: '#/components/schemas/MODEL_REFERENCE_CATEGORY' },
                    { type: 'string' },
                  ],
                },
              },
            },
          },
        },
      };

      const count = collapseEnumStringAnyOf(schema);
      expect(count).toBe(1);
      expect(schema.components.schemas['GenericModelRecord-Input']
        .properties.record_type.type).toBe('string');
    });
  });

  describe('preprocessSchema (integration)', () => {
    it('applies both fixes to a schema with mixed patterns', () => {
      const schema = {
        paths: {
          '/v2/{category}/add': {
            post: {
              requestBody: {
                content: {
                  'application/json': {
                    schema: {
                      anyOf: [
                        { $ref: '#/components/schemas/ImageGenerationModelRecord-Input' },
                        { $ref: '#/components/schemas/TextGenerationModelRecord-Input' },
                        { $ref: '#/components/schemas/ControlNetModelRecord-Input' },
                        { $ref: '#/components/schemas/GenericModelRecord-Input' },
                      ],
                      title: 'New Model Record',
                    },
                  },
                },
              },
            },
          },
        },
        components: {
          schemas: {
            'ImageGenerationModelRecord-Input': {
              properties: {
                baseline: {
                  anyOf: [
                    { $ref: '#/components/schemas/KNOWN_IMAGE_GENERATION_BASELINE' },
                    { type: 'string' },
                  ],
                },
                description: {
                  anyOf: [{ type: 'string' }, { type: 'null' }],
                },
              },
            },
          },
        },
      };

      preprocessSchema(schema);

      // Union was converted
      const reqSchema = schema.paths['/v2/{category}/add'].post.requestBody
        .content['application/json'].schema;
      expect(reqSchema.oneOf).toBeDefined();
      expect(reqSchema.anyOf).toBeUndefined();

      // Enum+string was collapsed
      const baseline = schema.components.schemas['ImageGenerationModelRecord-Input']
        .properties.baseline;
      expect(baseline.type).toBe('string');
      expect(baseline.anyOf).toBeUndefined();

      // Nullable string was NOT collapsed
      const desc = schema.components.schemas['ImageGenerationModelRecord-Input']
        .properties.description;
      expect(desc.anyOf).toBeDefined();
    });
  });
});
