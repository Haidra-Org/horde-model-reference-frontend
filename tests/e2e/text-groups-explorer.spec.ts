import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';

async function mockCapabilities(page: Page): Promise<void> {
  await page.route('**/replicate_mode', (route: Route) =>
    route.fulfill({
      json: { replicate_mode: 'REPLICA', canonical_format: 'legacy', writable: false },
    }),
  );
}

test('group explorer separates topology context from actionable catalog quality', async ({
  page,
}) => {
  let healthEndpointRequests = 0;
  await mockCapabilities(page);
  await page.route('**/model_references/v2/text_generation/groups/health', (route: Route) => {
    healthEndpointRequests += 1;
    return route.fulfill({
      json: {
        issues: [],
        total_groups_checked: 2,
        groups_with_issues: 0,
        issue_counts_by_type: {},
      },
    });
  });
  await page.route('**/model_references/v2/text_generation/groups/summary', (route: Route) =>
    route.fulfill({
      json: {
        groups: [
          {
            group_name: 'Llama-3',
            canonical_count: 1,
            backend_duplicate_count: 0,
            has_custom_schema: false,
            family_name: 'Llama',
            alias_canonical: null,
            aliases: ['llama3'],
            available_sizes: ['8B'],
            health_issues: [
              {
                group_name: 'Llama-3',
                issue_type: 'singleton_group',
                message: 'Group currently contains one canonical model',
                severity: 'info',
              },
            ],
          },
          {
            group_name: 'Mistral-Nemo',
            canonical_count: 4,
            backend_duplicate_count: 0,
            has_custom_schema: true,
            family_name: null,
            alias_canonical: null,
            aliases: [],
            available_sizes: ['0.5B', '1.8B', '8B', '100B'],
            health_issues: [
              {
                group_name: 'Mistral-Nemo',
                issue_type: 'inconsistent_baseline',
                message: 'Members have different baselines',
                severity: 'warning',
              },
            ],
          },
        ],
        total_groups: 2,
        total_models: 5,
        groups_with_families: 1,
        groups_with_aliases: 1,
        groups_with_issues: 2,
      },
    }),
  );

  await page.goto('/text-groups');

  const llamaGroupLink = page.getByRole('link', { name: 'Llama-3 Aliases: llama3' });
  await expect(llamaGroupLink).toBeVisible();
  await expect(page.getByRole('link', { name: 'Browse exact models in Llama-3' })).toHaveAttribute(
    'href',
    '/categories/text_generation?groups=Llama-3',
  );
  await expect(page.getByText('Informational')).toBeVisible();
  await expect(page.getByText('1 issue')).toBeVisible();
  expect(healthEndpointRequests).toBe(0);

  await page.getByRole('button', { name: /Needs attention 1/ }).click();
  await expect(page).toHaveURL(/view=attention/);
  await expect(page.getByRole('link', { name: 'Mistral-Nemo', exact: true })).toBeVisible();
  await expect(page.getByLabel('Parameter sizes for Mistral-Nemo')).toHaveText(
    /0\.5B\s*1\.8B\s*8B\s*\+1/,
  );
  await expect(page.getByRole('link', { name: 'Llama-3 Aliases: llama3' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Clear filters' }).click();
  await page.getByPlaceholder('Search group, family, or alias…').fill('llama3');
  await expect(page).toHaveURL(/q=llama3/);
  await expect(page.getByRole('link', { name: 'Llama-3 Aliases: llama3' })).toHaveAttribute(
    'href',
    '/text-groups/group?name=Llama-3',
  );
  await expect(page.getByRole('link', { name: 'Mistral-Nemo', exact: true })).toHaveCount(0);
});
