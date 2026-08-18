import { expect, test } from '@playwright/test';

const fixtureApiUrl = process.env.HMR_FULL_STACK_API_URL;
const fixtureApiKey = 'full-stack-test-key';

test.describe('real pending-change lifecycle', () => {
  test.skip(!fixtureApiUrl, 'Set HMR_FULL_STACK_API_URL to run the isolated full-stack lifecycle.');
  test.describe.configure({ mode: 'serial' });

  test('submits, focuses, approves, applies, and reads back a licensed legacy model', async ({
    page,
    request,
  }) => {
    const modelName = `playwright-license-${Date.now()}`;

    await page.route('http://localhost:19800/api/**', async (route) => {
      const redirectedUrl = route
        .request()
        .url()
        .replace('http://localhost:19800/api', fixtureApiUrl!);
      await route.continue({ url: redirectedUrl });
    });
    await page.route('https://aihorde.net/api/v2/find_user', (route) =>
      route.fulfill({ json: { username: 'full-stack-maintainer#1' } }),
    );

    await page.goto('/');
    await page.getByRole('button', { name: 'Sign in' }).click();
    const loginDialog = page.locator('.modal-dialog');
    await loginDialog.locator('#api-key-input').fill(fixtureApiKey);
    await loginDialog.getByRole('button', { name: 'Login' }).click();
    await expect(loginDialog).toHaveCount(0);

    await page.goto('/categories/image_generation/create');
    await page.getByLabel('Model name (identifier)').fill(modelName);
    await page
      .getByLabel('Description')
      .fill('Created by the real browser-to-FastAPI lifecycle test.');
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Next' }).click();

    await expect(page.getByLabel('License expression *')).toHaveValue('NOASSERTION');
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByText('Commercial use')).toBeVisible();
    await page.getByRole('button', { name: 'Submit for review' }).click();

    await expect(
      page.getByRole('status').getByText(/Change #\d+ submitted for review/),
    ).toBeVisible();
    await page.getByRole('button', { name: 'View in queue' }).click();

    const focusedRow = page.locator('app-expandable-change-row', { hasText: modelName });
    await expect(focusedRow).toBeVisible();
    await expect(focusedRow.locator('.change-row')).toHaveAttribute('aria-expanded', 'true');
    await focusedRow.getByRole('button', { name: 'Approve' }).click();
    const approveDialog = page.getByRole('dialog');
    await expect(approveDialog.getByText('Approve Create Change')).toBeVisible();
    await approveDialog.getByRole('button', { name: 'Approve', exact: true }).click();

    await page.getByRole('button', { name: 'Ready to apply' }).click();
    const applyBatchButton = page.getByRole('button', { name: 'Apply Batch' }).first();
    await expect(applyBatchButton).toBeVisible();
    await applyBatchButton.click();
    const applyDialog = page.getByRole('dialog');
    await applyDialog.getByRole('button', { name: 'Apply Batch', exact: true }).click();

    const appliedRow = page.locator('app-expandable-change-row', { hasText: modelName });
    await expect(appliedRow.getByText('Applied', { exact: true }).first()).toBeVisible();

    const persistedResponse = await request.get(
      `${fixtureApiUrl}/model_references/v1/image_generation`,
      { headers: { apikey: fixtureApiKey } },
    );
    expect(persistedResponse.ok()).toBe(true);
    const persistedModels = (await persistedResponse.json()) as Record<
      string,
      { licensing?: { license_expression?: string; commercial_use?: string } }
    >;
    expect(persistedModels[modelName]?.licensing).toMatchObject({
      license_expression: 'NOASSERTION',
      commercial_use: 'unknown',
    });

    await page.goto(`/categories/image_generation/model/${encodeURIComponent(modelName)}`);
    await page.getByRole('button', { name: 'Propose removal' }).click();
    const removalDialog = page.getByRole('dialog');
    await expect(
      removalDialog.getByRole('button', { name: 'Submit removal proposal' }),
    ).toBeDisabled();
    await removalDialog.getByLabel(`Type ${modelName} to confirm`).fill(modelName);
    await removalDialog.getByRole('button', { name: 'Submit removal proposal' }).click();

    const removalRow = page.locator('app-expandable-change-row', { hasText: modelName });
    await expect(removalRow.locator('.change-row')).toHaveAttribute('aria-expanded', 'true');
    await expect(removalRow.getByText('Delete', { exact: true }).first()).toBeVisible();
    await removalRow.getByRole('button', { name: 'Approve' }).click();
    const removalApprovalDialog = page.getByRole('dialog');
    await removalApprovalDialog.getByRole('button', { name: 'Approve', exact: true }).click();

    await page.getByRole('button', { name: 'Ready to apply' }).click();
    await page.getByRole('button', { name: 'Apply Batch' }).first().click();
    const removalApplyDialog = page.getByRole('dialog');
    await removalApplyDialog.getByRole('button', { name: 'Apply Batch', exact: true }).click();
    await expect(removalRow.getByText('Applied', { exact: true }).first()).toBeVisible();

    const afterRemovalResponse = await request.get(
      `${fixtureApiUrl}/model_references/v1/image_generation`,
      { headers: { apikey: fixtureApiKey } },
    );
    // The v1 legacy read answers 404 for an empty category, which is the expected state
    // once the only model in the disposable fixture root has been removed.
    expect([200, 404]).toContain(afterRemovalResponse.status());
    if (afterRemovalResponse.ok()) {
      const modelsAfterRemoval = (await afterRemovalResponse.json()) as Record<string, unknown>;
      expect(modelsAfterRemoval[modelName]).toBeUndefined();
    }
  });
});
