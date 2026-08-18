import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';

/**
 * The standalone "Audit Trail" page was unified into the pending-queue view, so
 * `/pending-queue/audit` is now a redirect into `/pending-queue` (the review
 * queue), guarded by `authenticatedGuard`. These mocked tests pin that current
 * contract: legacy audit links keep working, and unauthenticated visitors are
 * bounced out by the guard.
 */

const API_KEY = 'mock-approver-key';

async function mockBackend(page: Page): Promise<void> {
  await page.route('**/replicate_mode', (route: Route) =>
    route.fulfill({ json: { replicate_mode: 'PRIMARY', canonical_format: 'v2', writable: true } }),
  );

  await page.route('https://aihorde.net/api/v2/find_user', (route: Route) =>
    route.fulfill({ json: { username: 'qa-approver' } }),
  );

  await page.route('**/model_references/v2/me/roles', (route: Route) =>
    route.fulfill({
      json: {
        user_id: 'qa-approver',
        username: 'qa-approver',
        roles: ['approver', 'requestor'],
        is_approver: true,
        is_requestor: true,
      },
    }),
  );

  await page.route('**/model_references/v2/pending_queue/changes**', (route: Route) =>
    route.fulfill({ json: { items: [], total: 0 } }),
  );
}

async function login(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in' }).click();
  const modal = page.locator('.modal-dialog');
  await expect(modal).toBeVisible();
  await modal.locator('#api-key-input').fill(API_KEY);
  await modal.getByRole('button', { name: 'Login' }).click();
  await expect(modal).toHaveCount(0, { timeout: 20000 });
}

test('redirects unauthenticated visitors away from the (legacy) audit route', async ({
  page,
}: {
  page: Page;
}) => {
  await mockBackend(page);
  await page.goto('/pending-queue/audit');

  // The guard rejects the anonymous user and routes back to the app root, which
  // in turn lands on the default browse page — never the guarded queue.
  await expect(page).toHaveURL(/\/categories\//, { timeout: 15000 });
  await expect(page.getByText('Please log in to access this page.')).toBeVisible();
});

test('authenticated visitors land on the unified pending queue from the legacy audit route', async ({
  page,
}: {
  page: Page;
}) => {
  await mockBackend(page);
  await login(page);

  await page.goto('/pending-queue/audit');

  // Legacy /pending-queue/audit now redirects into the unified pending queue.
  await expect(page).toHaveURL(/\/pending-queue/, { timeout: 15000 });
  await expect(page.locator('.page-container')).toBeVisible();
});
