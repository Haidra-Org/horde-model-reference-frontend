/**
 * Utility functions for OpenAPI schema validation in tests
 */

export interface OpenApiSchemaDefinition {
  type?: string;
  properties?: Record<string, OpenApiSchemaDefinition>;
  required?: string[];
  enum?: unknown[];
  items?: OpenApiSchemaDefinition;
  anyOf?: OpenApiSchemaDefinition[];
  allOf?: OpenApiSchemaDefinition[];
  oneOf?: OpenApiSchemaDefinition[];
  additionalProperties?: boolean | OpenApiSchemaDefinition;
  [key: string]: unknown;
}

export interface OpenApiSchema {
  openapi: string;
  info: {
    title: string;
    version: string;
  };
  paths: Record<string, unknown>;
  components?: {
    schemas?: Record<string, OpenApiSchemaDefinition>;
  };
}

/**
 * Fetch the OpenAPI schema from a service instance or local file
 * @param baseUrl The base URL of the service (e.g., 'http://localhost:19800' or '/assets' for local file)
 * @param timeout Timeout in milliseconds
 * @returns The OpenAPI schema
 */
export async function fetchOpenApiSchema(baseUrl: string, timeout = 10000): Promise<OpenApiSchema> {
  // Determine the URL based on whether it's a local file or remote service
  const url = baseUrl.startsWith('/')
    ? `${baseUrl}/openapi-schema.json` // Local file in assets
    : `${baseUrl}/api/openapi.json`; // Remote service

  const response = await fetch(url, {
    signal: AbortSignal.timeout(timeout),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch OpenAPI schema: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as OpenApiSchema;
}

/**
 * Get a specific schema definition by name
 * @param openApiSchema The full OpenAPI schema
 * @param schemaName The name of the schema to retrieve
 * @returns The schema definition or undefined if not found
 */
export function getSchemaDefinition(
  openApiSchema: OpenApiSchema,
  schemaName: string,
): OpenApiSchemaDefinition | undefined {
  return openApiSchema.components?.schemas?.[schemaName];
}

/**
 * Check if a schema has a required field
 * @param schema The schema definition
 * @param fieldName The field name to check
 * @returns true if the field is required
 */
export function isFieldRequired(schema: OpenApiSchemaDefinition, fieldName: string): boolean {
  return schema.required?.includes(fieldName) ?? false;
}

/**
 * Get the type of a field from a schema
 * @param schema The schema definition
 * @param fieldName The field name
 * @returns The type of the field or undefined if not found
 */
export function getFieldType(
  schema: OpenApiSchemaDefinition,
  fieldName: string,
): string | undefined {
  const fieldSchema = schema.properties?.[fieldName];
  if (!fieldSchema) {
    return undefined;
  }
  return fieldSchema.type;
}

/**
 * Check if a value is in a schema's enum
 * @param schema The schema definition (should be an enum schema)
 * @param value The value to check
 * @returns true if the value is in the enum
 */
export function isInEnum(schema: OpenApiSchemaDefinition, value: unknown): boolean {
  return schema.enum?.includes(value) ?? false;
}

/**
 * Get all enum values from a schema
 * @param schema The schema definition (should be an enum schema)
 * @returns Array of enum values or empty array if not an enum
 */
export function getEnumValues(schema: OpenApiSchemaDefinition): unknown[] {
  return schema.enum ?? [];
}

/**
 * Validate that an object matches the required fields of a schema
 * @param obj The object to validate
 * @param schema The schema definition
 * @returns An array of missing required fields, or empty array if all present
 */
export function validateRequiredFields(
  obj: Record<string, unknown>,
  schema: OpenApiSchemaDefinition,
): string[] {
  const required = schema.required ?? [];
  return required.filter((field) => !(field in obj));
}

/**
 * Get a list of all paths in the OpenAPI schema
 * @param openApiSchema The full OpenAPI schema
 * @returns Array of path strings
 */
export function getAllPaths(openApiSchema: OpenApiSchema): string[] {
  return Object.keys(openApiSchema.paths);
}

/**
 * Check if an endpoint exists in the schema
 * @param openApiSchema The full OpenAPI schema
 * @param path The path to check (e.g., '/api/v1/models')
 * @returns true if the path exists
 */
export function hasEndpoint(openApiSchema: OpenApiSchema, path: string): boolean {
  return path in openApiSchema.paths;
}

/**
 * Get all schema names from the components section
 * @param openApiSchema The full OpenAPI schema
 * @returns Array of schema names
 */
export function getAllSchemaNames(openApiSchema: OpenApiSchema): string[] {
  return Object.keys(openApiSchema.components?.schemas ?? {});
}

/**
 * Check if a schema name exists in the components
 * @param openApiSchema The full OpenAPI schema
 * @param schemaName The schema name to check
 * @returns true if the schema exists
 */
export function hasSchema(openApiSchema: OpenApiSchema, schemaName: string): boolean {
  return schemaName in (openApiSchema.components?.schemas ?? {});
}
