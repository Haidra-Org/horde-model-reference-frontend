import { expect, test } from '@playwright/test';

const pending = {
  change_id: 302,
  category: 'image_generation',
  model_name: 'Pending-Anima',
  operation: 'create',
  status: 'pending',
  requested_by: 'test',
  requested_username: 'Test curator',
  requested_at: 1780000000,
  payload: {
    name: 'Pending-Anima',
    baseline: 'anima',
    nsfw: false,
    description: 'A proposed model with shared component files.',
    config: {
      files: [{ path: 'vae.safetensors', file_type: 'vae', sha256sum: 'abc' }],
      download: [{ file_name: 'vae.safetensors', file_url: 'https://example.com/vae' }],
    },
  },
};

for (const view of ['Table', 'Cards', 'Gallery']) {
  test(`${view}: pending model opens details; pending pill opens review`, async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('hordeAuthApiKey', 'navigation-test-key'));
    await page.route('**/api/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/me/roles'))
        return route.fulfill({
          json: {
            user_id: 'test',
            username: 'Test curator',
            roles: ['approver', 'requestor'],
            is_requestor: true,
            is_approver: true,
            is_license_editor: false,
          },
        });
      if (path.endsWith('/replicate_mode'))
        return route.fulfill({
          json: { replicate_mode: 'PRIMARY', canonical_format: 'legacy', writable: true },
        });
      if (path.endsWith('/model_categories')) return route.fulfill({ json: ['image_generation'] });
      if (path.endsWith('/pending_queue/changes'))
        return route.fulfill({ json: { items: [pending], total: 1, offset: 0, limit: 200 } });
      if (path.endsWith('/pending_queue/changes/302/diff'))
        return route.fulfill({ json: { change_id: 302, field_diffs: [] } });
      if (path.includes('pending_queue')) return route.fulfill({ json: { items: [], total: 0 } });
      return route.fulfill({ json: {} });
    });
    await page.goto('/categories/image_generation');
    await page.getByRole('radio', { name: view, exact: true }).click();
    const model = page.getByRole('button', { name: 'Open Pending-Anima', exact: true });
    await expect(model).toBeVisible();
    await model.click();
    await expect(page).toHaveURL(/image_generation\/model\/Pending-Anima$/);
    await expect(page.getByRole('heading', { name: 'Pending-Anima', exact: true })).toBeVisible();
    await expect(page.getByText('A proposed model with shared component files.')).toBeVisible();
    await expect(page.getByText(/pending addition/)).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Pending-Anima', exact: true })).toBeVisible();
    await page.goto('/categories/image_generation');
    await page.getByRole('radio', { name: view, exact: true }).click();
    const pill = page.getByRole('button', { name: /Pending add/ });
    await expect(pill).toBeVisible();
    await pill.click();
    await expect(page).toHaveURL(/pending-queue\?focus=302$/);
  });
}
