/**
 * Test environment configuration
 *
 * This file exports configuration for test environments.
 * Values can be overridden through Vite env vars in CI/local runs:
 * - VITE_USE_REMOTE_SCHEMA
 * - VITE_REMOTE_API_URL
 * - VITE_LOCAL_SCHEMA_BASE_URL
 * - VITE_OPENAPI_TIMEOUT_MS
 */

const env =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};

function readBooleanEnv(name: string, fallback: boolean): boolean {
  const value = env[name];
  if (!value) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'yes') {
    return true;
  }
  if (normalized === '0' || normalized === 'false' || normalized === 'no') {
    return false;
  }

  return fallback;
}

function readNumberEnv(name: string, fallback: number): number {
  const value = env[name];
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

export const testEnvironment = {
  /**
   * Set to true to test against remote/live service (requires CORS to be enabled)
   * Set to false to test against local static file
   *
   * When true: Uses remoteApiUrl
   * When false: Uses localApiUrl
   */
  useRemoteSchema: readBooleanEnv('VITE_USE_REMOTE_SCHEMA', false),

  /**
   * Base URL for remote horde-model-reference API service
   * Used when useRemoteSchema = true
   *
   * Examples:
   * - Local service: 'http://localhost:19800'
   * - Production: 'https://api.aihorde.net/model-reference'
   * - Staging: 'https://staging-api.aihorde.net/model-reference'
   */
  remoteApiUrl: env['VITE_REMOTE_API_URL']?.trim() || 'http://localhost:19800',

  /**
   * Base URL for local static schema file
   * Used when useRemoteSchema = false
   *
   * Default: '/assets' (schema at /assets/openapi-schema.json)
   */
  localApiUrl: env['VITE_LOCAL_SCHEMA_BASE_URL']?.trim() || '/assets',

  /**
   * Timeout for API requests in milliseconds
   * Default: 10000 (10 seconds)
   */
  timeout: readNumberEnv('VITE_OPENAPI_TIMEOUT_MS', 10000),
};
