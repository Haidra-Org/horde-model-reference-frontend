/**
 * Test environment configuration
 *
 * This file exports configuration for test environments.
 * Modify these values directly to test against different service instances.
 */

export const testEnvironment = {
  /**
   * Set to true to test against remote/live service (requires CORS to be enabled)
   * Set to false to test against local static file
   *
   * When true: Uses remoteApiUrl
   * When false: Uses localApiUrl
   */
  useRemoteSchema: true,

  /**
   * Base URL for remote horde-model-reference API service
   * Used when useRemoteSchema = true
   *
   * Examples:
   * - Local service: 'http://localhost:19800'
   * - Production: 'https://api.aihorde.net/model-reference'
   * - Staging: 'https://staging-api.aihorde.net/model-reference'
   */
  remoteApiUrl: 'http://localhost:19800',

  /**
   * Base URL for local static schema file
   * Used when useRemoteSchema = false
   *
   * Default: '/assets' (schema at /assets/openapi-schema.json)
   */
  localApiUrl: '/assets',

  /**
   * Timeout for API requests in milliseconds
   * Default: 10000 (10 seconds)
   */
  timeout: 10000,
};
