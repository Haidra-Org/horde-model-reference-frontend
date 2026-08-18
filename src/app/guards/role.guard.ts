import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { filter, map, Observable, take } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { NotificationService } from '../services/notification.service';
import { UserRole } from '../models/auth.models';

/**
 * Messages shown to users when access is denied for each minimum role level.
 *
 * Contribution is allowlist-controlled on the backend (`pending_queue.requestor_ids` /
 * `approver_ids`), so a valid key is necessary but not sufficient. The wording avoids
 * implying that signing in alone will grant access.
 */
const ROLE_MESSAGES: Record<UserRole, string> = {
  anonymous: '', // No message needed for anonymous access
  user: 'Sign in with your AI Horde API key to view this page.',
  requestor: 'This page is available to contributors. Your key does not currently have access.',
  approver: 'This page is available to curators. Your key does not currently have access.',
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
  return (): boolean | UrlTree | Observable<boolean | UrlTree> => {
    const authService = inject(AuthService);
    const router = inject(Router);
    const notifications = inject(NotificationService);

    const decide = (): boolean | UrlTree => {
      if (authService.hasMinimumRole(minimumRole)) {
        return true;
      }

      const message =
        ROLE_MESSAGES[minimumRole] || 'You do not have permission to access this page.';
      notifications.info(message);

      return router.createUrlTree(['/']);
    };

    if (!authService.isRestoringSession()) {
      return decide();
    }

    // A stored key is still being validated. Deciding now would admit the viewer on the
    // strength of a role we have not confirmed yet, which on a hard refresh of a gated
    // route means rendering curation surfaces to whoever holds the browser. Wait for the
    // restore to settle, then decide against the real role.
    return toObservable(authService.isRestoringSession).pipe(
      filter((restoring) => !restoring),
      take(1),
      map(decide),
    );
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
