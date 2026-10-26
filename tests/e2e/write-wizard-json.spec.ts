import { expect, test } from '@playwright/test';

for (const format of ['legacy', 'v2']) {
  test(`${format}: unknown JSON is preserved, blocked by default and sent literally only by explicit override`, async ({
    page,
  }) => {
    const requests: { body: string | null; contentType: string | undefined }[] = [];
    await page.addInitScript(() => localStorage.setItem('hordeAuthApiKey', 'json-test-key'));
    await page.route('**/api/**', async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (request.method() === 'POST' && path.endsWith('/image_generation')) {
        requests.push({ body: request.postData(), contentType: request.headers()['content-type'] });
        if (requests.length === 1)
          return route.fulfill({
            status: 422,
            json: {
              detail: [
                {
                  loc: ['body', 'config', 'download', 0, 'future'],
                  type: 'extra_forbidden',
                  msg: 'Future file metadata is not supported by this deployment',
                },
              ],
            },
          });
        const payload = JSON.parse(request.postData()!);
        delete payload.config.download[0].future;
        return route.fulfill({ json: { change_id: 123, payload } });
      }
      if (path.endsWith('/me/roles'))
        return route.fulfill({
          json: {
            user_id: 'test',
            username: 'JSON tester',
            roles: ['requestor'],
            is_requestor: true,
            is_approver: false,
            is_license_editor: false,
          },
        });
      if (path.endsWith('/replicate_mode'))
        return route.fulfill({
          json: { replicate_mode: 'PRIMARY', canonical_format: format, writable: true },
        });
      if (path.includes('pending_queue')) return route.fulfill({ json: { items: [], total: 0 } });
      return route.fulfill({ json: {} });
    });
    await page.goto('/categories/image_generation/create');
    await page.getByRole('textbox', { name: /^Model name/ }).fill('json-model');
    await page.getByRole('button', { name: 'Show advanced API payload' }).click();
    const editor = page.getByRole('textbox', { name: 'Request body JSON editor', exact: true });
    const input = JSON.parse(await editor.inputValue());
    input.config.download = [
      {
        file_name: 'model.safetensors',
        file_url: 'https://example.com/model',
        future: { schema: 'next', integer: 'RAW_INTEGER' },
      },
    ];
    const draft = JSON.stringify(input, null, 4).replace('"RAW_INTEGER"', '9007199254740993');
    await editor.fill(draft);
    await editor.press('Tab');
    await expect(editor).toHaveValue(draft);
    await page.getByRole('button', { name: 'Hide advanced API payload' }).click();
    const summary = page.getByTestId('json-validation-summary');
    await expect(summary).toContainText('JSON_UNKNOWN_FIELD');
    await expect(summary).toContainText('$.config.download[0].future');
    await page.getByRole('button', { name: '5. Review' }).click();
    const submit = page.getByRole('button', { name: 'Submit for review', exact: true });
    await expect(submit).toBeDisabled();
    expect(requests).toHaveLength(0);
    await page.getByRole('button', { name: 'Show advanced API payload' }).click();
    await page.getByRole('checkbox', { name: 'Submit JSON as written', exact: true }).check();
    await expect(editor).toHaveValue(draft);
    await page.getByRole('button', { name: '1. Identity' }).click();
    await expect(page.getByRole('textbox', { name: /^Model name/ })).toBeDisabled();
    await page.getByRole('button', { name: '5. Review' }).click();
    await page.getByRole('button', { name: 'Hide advanced API payload' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Submitting JSON' })).toBeVisible();
    await expect(
      page.getByRole('checkbox', { name: 'Submit JSON as written', exact: true }),
    ).toHaveCount(0);
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect(page.locator('[data-validation-code="SERVER_REJECTED_REQUEST"]')).toContainText(
      'Future file metadata is not supported',
    );
    await expect(page.getByText('config.download[0].future', { exact: true })).toBeVisible();
    expect(requests[0]).toEqual({ body: draft, contentType: 'application/json' });
    await submit.click();
    await expect(page.locator('[data-validation-code="SERVER_PAYLOAD_CHANGED"]')).toContainText(
      '$.config.download[0].future',
    );
    expect(requests[1].body).toBe(draft);
  });
}
