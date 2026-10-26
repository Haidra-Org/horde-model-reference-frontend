import { expect, test, type Page } from '@playwright/test';

async function prepareWizard(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.setItem('hordeAuthApiKey', 'layout-test-key'));
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/me/roles'))
      return route.fulfill({
        json: {
          user_id: 'test',
          username: 'Test contributor',
          roles: ['requestor'],
          is_requestor: true,
          is_approver: false,
          is_license_editor: false,
        },
      });
    if (path.endsWith('/replicate_mode'))
      return route.fulfill({
        json: { replicate_mode: 'PRIMARY', canonical_format: 'legacy', writable: true },
      });
    if (path.includes('pending_queue'))
      return route.fulfill({ json: { items: [], total: 0, offset: 0, limit: 100 } });
    return route.fulfill({ json: {} });
  });
}

test('file suggestions stay anchored and entry widths fit their content on desktop and mobile', async ({
  page,
}) => {
  await prepareWizard(page);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/categories/image_generation/create');
  await page.getByRole('button', { name: '3. Files' }).click();
  const purpose = page.getByRole('combobox', { name: 'File type / purpose', exact: true });
  const fileName = page.getByRole('textbox', { name: 'File name', exact: true });
  const size = page.getByRole('spinbutton', { name: 'File size (bytes)' });
  for (const width of [1600, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await purpose.click();
    const options = page.getByRole('listbox', { name: 'File type / purpose suggestions' });
    await expect(options).toBeVisible();
    await expect
      .poll(async () =>
        Math.abs((await options.boundingBox())!.width - (await purpose.boundingBox())!.width),
      )
      .toBeLessThan(2);
    const inputBox = (await purpose.boundingBox())!;
    const optionsBox = (await options.boundingBox())!;
    expect(Math.abs(optionsBox.x - inputBox.x)).toBeLessThan(2);
    const belowGap = Math.abs(optionsBox.y - inputBox.y - inputBox.height - 4);
    const aboveGap = Math.abs(inputBox.y - optionsBox.y - optionsBox.height - 4);
    expect(Math.min(belowGap, aboveGap)).toBeLessThan(2);
    expect(Math.abs(optionsBox.width - inputBox.width)).toBeLessThan(2);
    expect(inputBox.x + inputBox.width).toBeLessThanOrEqual(width);
    expect(inputBox.width).toBeLessThan(300);
    expect((await size.boundingBox())!.width).toBeLessThan(230);
    if (width === 1600) expect((await fileName.boundingBox())!.width).toBeLessThan(650);
    await purpose.press('Escape');
  }
  await purpose.fill('vae');
  await page.getByRole('option', { name: 'vae', exact: true }).click();
  await expect(purpose).toHaveValue('vae');
  for (const width of [1600, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    const clear = page.getByRole('button', { name: 'Clear File type / purpose', exact: true });
    await expect
      .poll(async () => {
        const input = (await purpose.boundingBox())!;
        const button = (await clear.boundingBox())!;
        return Math.abs(button.x - input.x - input.width - 6);
      })
      .toBeLessThan(2);
    const input = (await purpose.boundingBox())!;
    const button = (await clear.boundingBox())!;
    expect(Math.abs(button.y + button.height / 2 - input.y - input.height / 2)).toBeLessThan(2);
    expect(button.x + button.width).toBeLessThanOrEqual(width);
  }
  await page.getByRole('button', { name: 'Clear File type / purpose', exact: true }).click();
  await expect(purpose).toHaveValue('');
});

test('clearing one field or section preserves other model and file data', async ({ page }) => {
  await prepareWizard(page);
  await page.goto('/categories/image_generation/create');
  await page
    .getByRole('textbox', { name: /^Model name \(identifier\)/ })
    .fill('Scoped-clear-model');
  await page.getByRole('textbox', { name: /^Display name/ }).fill('Display name');
  await page.getByRole('textbox', { name: /^Description/ }).fill('A description');
  await page.getByLabel('Version', { exact: true }).fill('2.0');
  await page.getByRole('button', { name: 'Clear Description', exact: true }).click();
  await expect(page.getByRole('textbox', { name: /^Description/ })).toHaveValue('');
  await expect(page.getByLabel('Version', { exact: true })).toHaveValue('2.0');
  await page
    .getByRole('button', { name: 'Clear Catalog presentation section', exact: true })
    .click();
  await expect(page.getByRole('textbox', { name: /^Display name/ })).toHaveValue('');
  await expect(page.getByLabel('Version', { exact: true })).toHaveValue('');
  await expect(page.getByRole('textbox', { name: /^Model name \(identifier\)/ })).toHaveValue(
    'Scoped-clear-model',
  );

  await page.getByRole('button', { name: '2. Image' }).click();
  await page.getByRole('textbox', { name: /^Homepage/ }).fill('https://example.com/model');
  await page
    .getByRole('spinbutton', { name: 'Total size on disk (bytes)', exact: true })
    .fill('1000');
  await page.getByRole('textbox', { name: /^Tags/ }).fill('anime');
  await page.getByRole('textbox', { name: /^Trigger words/ }).fill('trigger');
  await page
    .getByRole('button', { name: 'Clear Discovery & examples section', exact: true })
    .click();
  await expect(page.getByRole('textbox', { name: /^Tags/ })).toHaveValue('');
  await expect(page.getByRole('textbox', { name: /^Trigger words/ })).toHaveValue('');
  await expect(page.getByRole('textbox', { name: /^Homepage/ })).toHaveValue(
    'https://example.com/model',
  );
  await page.getByLabel('Min Steps', { exact: true }).fill('8');
  await page.getByLabel('Min CFG', { exact: true }).fill('1');
  await page.getByLabel('Min Steps', { exact: true }).click();
  await page.getByRole('button', { name: 'Clear Min Steps', exact: true }).click();
  await expect(page.getByLabel('Min Steps', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Min CFG', { exact: true })).toHaveValue('1');
  await page
    .getByRole('button', { name: 'Clear Runtime requirements section', exact: true })
    .click();
  await expect(page.getByLabel('Min CFG', { exact: true })).toHaveValue('');
  await expect(
    page.getByRole('spinbutton', { name: 'Total size on disk (bytes)', exact: true }),
  ).toHaveValue('1000');

  const custom = page.locator('app-model-requirements-editor');
  await custom.locator('#new-key').fill('draft_key');
  await custom.locator('#new-value').fill('unfinished value');
  await page
    .getByRole('button', { name: 'Clear Runtime requirements section', exact: true })
    .click();
  await expect(custom.locator('#new-key')).toHaveValue('');
  await expect(custom.locator('#new-value')).toHaveValue('');
  await page.locator('app-wizard-step-attributes summary').click();
  const attribute = page.getByRole('textbox', { name: /^Fine-tune series/ });
  await attribute.fill('{');
  await page.getByRole('button', { name: 'Clear Fine-tune series', exact: true }).click();
  await expect(attribute).toHaveValue('');
  await attribute.fill('{');
  await page
    .getByRole('button', { name: 'Clear additional model attributes section', exact: true })
    .click();
  await expect(attribute).toHaveValue('');
  await expect(page.locator('app-wizard-step-attributes .form-error')).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Clear Architecture & content section', exact: true })
    .click();
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeDisabled();
  await expect(page.getByRole('textbox', { name: /^Homepage/ })).toHaveValue(
    'https://example.com/model',
  );

  await page.getByRole('button', { name: '3. Files' }).click();
  const first = page.locator('.download-card').first();
  await first.getByRole('textbox', { name: 'File name', exact: true }).fill('main.safetensors');
  await first
    .getByRole('textbox', { name: 'File URL', exact: true })
    .fill('https://example.com/main');
  await first.getByRole('combobox', { name: 'File type / purpose', exact: true }).fill('unet');
  await first.getByRole('combobox', { name: 'File type / purpose', exact: true }).press('Escape');
  await first.getByRole('textbox', { name: /Component content hash/ }).fill('component-hash');
  await first.getByRole('spinbutton', { name: 'File size (bytes)' }).fill('500');
  await first
    .getByRole('button', { name: 'Clear Additional file metadata section', exact: true })
    .click();
  await expect(first.getByRole('spinbutton', { name: 'File size (bytes)' })).toHaveValue('');
  await expect(
    first.getByRole('combobox', { name: 'File type / purpose', exact: true }),
  ).toHaveValue('unet');
  await first.getByRole('button', { name: 'Clear File URL', exact: true }).click();
  await expect(first.getByRole('textbox', { name: 'File URL', exact: true })).toHaveValue('');
  await expect(first.getByRole('textbox', { name: 'File name', exact: true })).toHaveValue(
    'main.safetensors',
  );
  await page.getByRole('button', { name: 'Add file', exact: true }).click();
  const second = page.locator('.download-card').nth(1);
  await second.getByRole('textbox', { name: 'File name', exact: true }).fill('vae.safetensors');
  await first.getByRole('button', { name: 'Clear file 1', exact: true }).click();
  await expect(first.getByRole('textbox', { name: 'File name', exact: true })).toHaveValue('');
  await expect(
    first.getByRole('combobox', { name: 'File type / purpose', exact: true }),
  ).toHaveValue('');
  await expect(second.getByRole('textbox', { name: 'File name', exact: true })).toHaveValue(
    'vae.safetensors',
  );

  const embedded = page.locator('app-key-value-editor');
  await embedded.locator('#new-key').fill('vae');
  await embedded.locator('#new-value').fill('unfinished-hash');
  await page
    .getByRole('button', { name: 'Clear Embedded components section', exact: true })
    .click();
  await expect(embedded.locator('#new-key')).toHaveValue('');
  await expect(embedded.locator('#new-value')).toHaveValue('');
  await expect(second.getByRole('textbox', { name: 'File name', exact: true })).toHaveValue(
    'vae.safetensors',
  );

  await page.getByRole('button', { name: '4. Licensing' }).click();
  await page.getByRole('textbox', { name: /^License expression/ }).fill('MIT');
  await page.getByRole('textbox', { name: /^Referenced license IDs/ }).fill('MIT');
  await page
    .getByRole('textbox', { name: /^Evidence URL/ })
    .first()
    .fill('https://example.com/LICENSE');
  await page
    .getByRole('button', { name: 'Clear Permissions & obligations section', exact: true })
    .click();
  await expect(page.getByRole('textbox', { name: /^Referenced license IDs/ })).toHaveValue('');
  await expect(page.getByRole('textbox', { name: /^License expression/ })).toHaveValue('MIT');
  await expect(page.getByRole('textbox', { name: /^Evidence URL/ }).first()).toHaveValue(
    'https://example.com/LICENSE',
  );
  await page.getByRole('button', { name: 'Clear Primary evidence section', exact: true }).click();
  await expect(page.getByRole('textbox', { name: /^Evidence URL/ }).first()).toHaveValue('');
  await expect(page.getByRole('textbox', { name: /^License expression/ })).toHaveValue('MIT');
});
