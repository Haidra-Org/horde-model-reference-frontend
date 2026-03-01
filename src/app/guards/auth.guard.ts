import { CanActivateFn } from '@angular/router';
import { approverGuard } from './role.guard';

/**
 * Legacy auth guard that requires approver privileges.
 *
 * @deprecated Use `approverGuard` from `./role.guard` directly, or use
 * `createRoleGuard('approver')` for explicit role requirements.
 */
export const authGuard: CanActivateFn = approverGuard;
