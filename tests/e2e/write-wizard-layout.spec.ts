import { expect, test } from '@playwright/test';

test('file suggestions stay anchored and entry widths fit their content on desktop and mobile', async ({
  page,
}) => {
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
    expect(Math.abs(optionsBox.y - inputBox.y - inputBox.height - 4)).toBeLessThan(2);
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
});
