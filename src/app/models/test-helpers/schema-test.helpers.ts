/**
 * Helper utilities for OpenAPI schema-based tests
 */

/**
 * Check if schema is unavailable and should skip test
 * Use this at the start of tests that depend on schema availability
 *
 * @example
 * if (isSchemaUnavailable(schemaFetchError)) return;
 *
 * @param schemaFetchError The error from fetching the schema, or null if successful
 * @returns true if schema is unavailable and test should be skipped
 */
export function isSchemaUnavailable(schemaFetchError: Error | null): boolean {
  return schemaFetchError !== null;
}
