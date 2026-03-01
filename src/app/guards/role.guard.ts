import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { NotificationService } from '../services/notification.service';
import { UserRole } from '../models/auth.models';

/**
 * Messages shown to users when access is denied for each minimum role level.
 */
const ROLE_MESSAGES: Record<UserRole, string> = {
  anonymous: '', // No message needed for anonymous access
  user: 'Please log in to access this page.',
  requestor: 'Please log in with an API key that has requestor privileges.',
  approver: 'Please log in with an approver API key to access this page.',
  admin: 'This page requires administrator privileges.',
};

/**
 * Creates a route guard that requires the user to have at least the specified role.
 *
 * @param minimumRole The minimum role required to access the route.
 * @returns A CanActivateFn guard function.
 *
 * @example
 * ```typescript
 * // In app.routes.ts
 * {
 *   path: 'pending-queue',
 *   component: PendingQueueComponent,
 *   canActivate: [createRoleGuard('approver')],
 * }
 * ```
 */
export function createRoleGuard(minimumRole: UserRole): CanActivateFn {
  return (): boolean | UrlTree => {
    const authService = inject(AuthService);
    const router = inject(Router);
    const notifications = inject(NotificationService);

    // If session is being restored, allow access temporarily
    // The auth interceptor will handle redirects if the session is invalid
    if (authService.isRestoringSession()) {
      return true;
    }

    // Check if user meets the minimum role requirement
    if (authService.hasMinimumRole(minimumRole)) {
      return true;
    }

    // Show appropriate message based on what's missing
    const message = ROLE_MESSAGES[minimumRole] || 'You do not have permission to access this page.';
    notifications.info(message);

    return router.createUrlTree(['/']);
  };
}

/**
 * Guard that requires any authenticated user (role >= 'user').
 */
export const authenticatedGuard: CanActivateFn = createRoleGuard('user');

/**
 * Guard that requires requestor privileges (role >= 'requestor').
 */
export const requestorGuard: CanActivateFn = createRoleGuard('requestor');

/**
 * Guard that requires approver privileges (role >= 'approver').
 */
export const approverGuard: CanActivateFn = createRoleGuard('approver');

/**
 * Guard that requires admin privileges (role >= 'admin').
 */
export const adminGuard: CanActivateFn = createRoleGuard('admin');
