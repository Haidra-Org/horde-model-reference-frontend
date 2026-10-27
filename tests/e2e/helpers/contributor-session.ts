import type { Page } from '@playwright/test';

/** Restore a contributor session without contacting the live authentication service. */
export async function mockContributorSession(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.setItem('hordeAuthApiKey', 'test-contributor'));
  await page.route('https://aihorde.net/api/v2/find_user', (route) =>
    route.fulfill({ json: { username: 'Test contributor' } }),
  );
  await page.route('**/model_references/v2/me/roles', (route) =>
    route.fulfill({
      json: {
        user_id: 'test-contributor',
        username: 'Test contributor',
        roles: ['requestor'],
        is_requestor: true,
        is_approver: false,
        is_license_editor: false,
      },
    }),
  );
}
