/**
 * Authentication and authorization models for the Horde Model Reference frontend.
 *
 * This module defines the role system and user types used throughout the application.
 * Roles are hierarchical: higher roles inherit permissions from lower roles.
 */

/**
 * User roles in order of increasing privilege.
 * - anonymous: Not logged in
 * - user: Valid AI Horde API key but no special permissions
 * - requestor: Can submit model change requests to the pending queue
 * - approver: Can approve/reject pending queue items (superset of requestor)
 * - admin: Future use - full administrative access
 */
export const USER_ROLES = ['anonymous', 'user', 'requestor', 'approver', 'admin'] as const;

export type UserRole = (typeof USER_ROLES)[number];

/**
 * Ordered list of roles for hierarchy comparison.
 * Index represents privilege level (higher = more privileged).
 */
export const ROLE_HIERARCHY: readonly UserRole[] = USER_ROLES;

/**
 * Response from the /me/roles endpoint.
 * Matches the backend UserRolesResponse model.
 */
export interface UserRolesResponse {
  user_id: string;
  username: string;
  roles: string[];
  is_approver: boolean;
  is_requestor: boolean;
}

/**
 * Authenticated user with role information.
 */
export interface AuthenticatedUser {
  /** The unique Horde user ID (e.g., '6572'). */
  userId: string;

  /** The full Horde username including discriminator (e.g., 'Tazlin#6572'). */
  username: string;

  /** Set of roles assigned to the user. */
  roles: Set<string>;

  /** The highest role the user has in the hierarchy. */
  highestRole: UserRole;

  /** Whether the user has approver privileges. */
  isApprover: boolean;

  /** Whether the user has requestor privileges. */
  isRequestor: boolean;
}

/**
 * Get the privilege level of a role (higher = more privileged).
 */
export function getRoleLevel(role: UserRole): number {
  return ROLE_HIERARCHY.indexOf(role);
}

/**
 * Check if a role meets or exceeds the minimum required role.
 */
export function meetsMinimumRole(userRole: UserRole, minimumRole: UserRole): boolean {
  return getRoleLevel(userRole) >= getRoleLevel(minimumRole);
}

/**
 * Determine the highest role from a set of role strings.
 */
export function determineHighestRole(roles: Set<string> | string[]): UserRole {
  const roleSet = roles instanceof Set ? roles : new Set(roles);

  // Check from highest to lowest
  for (let i = ROLE_HIERARCHY.length - 1; i >= 0; i--) {
    const role = ROLE_HIERARCHY[i];
    if (roleSet.has(role)) {
      return role;
    }
  }

  // If no recognized roles, check for specific backend roles
  if (roleSet.has('approver')) {
    return 'approver';
  }
  if (roleSet.has('requestor')) {
    return 'requestor';
  }

  return 'user';
}

/**
 * Create an AuthenticatedUser from a UserRolesResponse.
 */
export function createAuthenticatedUser(response: UserRolesResponse): AuthenticatedUser {
  const roles = new Set(response.roles);

  // Map backend roles to our role hierarchy
  let highestRole: UserRole = 'user';
  if (response.is_approver) {
    highestRole = 'approver';
  } else if (response.is_requestor) {
    highestRole = 'requestor';
  }

  return {
    userId: response.user_id,
    username: response.username,
    roles,
    highestRole,
    isApprover: response.is_approver,
    isRequestor: response.is_requestor,
  };
}

/**
 * Storage key for persisting auth state.
 */
export const AUTH_STORAGE_KEY = 'hordeAuthApiKey';
