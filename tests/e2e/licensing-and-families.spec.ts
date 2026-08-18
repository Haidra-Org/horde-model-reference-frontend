import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';

const summary = {
  total_assets: 10,
  commercial_use: {
    allowed: 2,
    allowed_with_conditions: 1,
    prohibited: 1,
    unknown: 6,
  },
  redistribution: {
    allowed: 1,
    allowed_with_conditions: 2,
    prohibited: 1,
    unknown: 6,
  },
  licenses: { MIT: 2 },
};

const modelAsset = {
  asset_kind: 'model',
  asset_identifier: 'image_generation:Example Model',
  display_name: 'Example Model',
  category: 'image_generation',
  source_url: 'https://example.test/model',
  locations: [],
  related_assets: [],
  licensing: {
    license_expression: 'MIT',
    license_ids: ['MIT'],
    commercial_use: 'allowed',
    redistribution: 'allowed_with_conditions',
    obligations: ['include_license'],
    evidence: [],
    files: {},
  },
  definition_urls: { MIT: 'https://spdx.org/licenses/MIT.html' },
};

async function mockCapabilities(page: Page): Promise<void> {
  await page.route('**/replicate_mode', (route: Route) =>
    route.fulfill({
      json: { replicate_mode: 'PRIMARY', canonical_format: 'legacy', writable: true },
    }),
  );
}

test('licensing explains uncertainty and applies activity filters to API results', async ({
  page,
}) => {
  await mockCapabilities(page);
  await page.route('**/model_references/v2/licensing/summary', (route: Route) =>
    route.fulfill({ json: summary }),
  );
  await page.route('**/model_references/v2/licensing/licenses**', (route: Route) =>
    route.fulfill({ json: { items: [], total: 0, offset: 0, limit: 100, metadata: {} } }),
  );
  await page.route('**/model_references/v2/licensing/assets**', (route: Route) => {
    const url = new URL(route.request().url());
    const selectedAllowed = url.searchParams.get('commercial_use') === 'allowed';
    route.fulfill({
      json: {
        items: selectedAllowed ? [modelAsset] : [],
        total: selectedAllowed ? 1 : 0,
        offset: 0,
        limit: 50,
        metadata: {},
      },
    });
  });

  await page.goto('/licensing');

  await expect(page.getByText('Unknown does not mean permitted.')).toBeVisible();
  await expect(
    page.locator('.license-stat', { hasText: 'Commercially reviewed' }).locator('strong'),
  ).toHaveText('4');
  await expect(page.getByText('No assets match these filters.')).toBeVisible();

  await page.locator('select[formcontrolname="commercialUse"]').selectOption('allowed');
  const filteredRequest = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return (
      url.pathname.endsWith('/licensing/assets') &&
      url.searchParams.get('commercial_use') === 'allowed'
    );
  });
  await page.getByRole('button', { name: 'Apply filters' }).click();
  await filteredRequest;

  const result = page.getByRole('link', { name: 'Example Model' });
  await expect(result).toBeVisible();
  await expect(result).toHaveAttribute(
    'href',
    '/categories/image_generation/model/Example%20Model',
  );
  await expect(
    page.getByLabel('Licensed assets').getByText('Allowed with conditions'),
  ).toBeVisible();
});

test('family detection remains useful when no family metadata has been persisted', async ({
  page,
}) => {
  await mockCapabilities(page);
  await page.route('**/model_references/v2/text_generation/families/detect', (route: Route) =>
    route.fulfill({
      json: {
        suggestions: [
          { family_name: 'Mistral', members: ['Mistral-7B', 'Mistral-Nemo'] },
          { family_name: 'Llama', members: ['Llama-2', 'Llama-3'] },
        ],
        total_groups_analyzed: 4,
        groups_in_families: 4,
        standalone_groups: 0,
      },
    }),
  );
  await page.route('**/model_references/v2/text_generation/families', (route: Route) =>
    route.fulfill({ json: { families: [] } }),
  );
  await page.route('**/model_references/v2/text_generation/aliases', (route: Route) =>
    route.fulfill({ json: { entries: [] } }),
  );

  await page.goto('/text-groups/families');

  await expect(page.getByRole('heading', { name: 'No families defined yet' })).toBeVisible();
  await expect(page.getByText('Mistral', { exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: /Suggestions 2/ }).click();
  await expect(page).toHaveURL(/\/text-groups\/families\?view=suggestions$/);
  await expect(page.getByRole('heading', { name: 'Heuristic family suggestions' })).toBeVisible();
  await expect(page.getByText('not catalog metadata until approved')).toBeVisible();
  await expect(page.getByText('Mistral', { exact: true })).toBeVisible();

  await page.getByPlaceholder('Search family or group…').fill('nemo');
  await expect(page.getByText('Mistral', { exact: true })).toBeVisible();
  await expect(page.getByText('Llama', { exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: /Mistral-Nemo/ }).click();
  await expect(page).toHaveURL(/\/text-groups\/group\?name=Mistral-Nemo$/);
});
