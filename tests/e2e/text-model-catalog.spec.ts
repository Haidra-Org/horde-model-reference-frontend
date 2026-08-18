import { expect, test, type Page, type Route } from '@playwright/test';

const textModels = {
  'publisher/atlas-7b': {
    name: 'publisher/atlas-7b',
    display_name: '',
    description: 'A compact Atlas chat model.',
    parameters: 7_000_000_000,
    baseline: 'llama',
    nsfw: false,
    tags: ['chat'],
    text_model_group: 'Atlas',
    context_window: { maximum_tokens: 32768, sources: [] },
    interaction_modes: { chat: { status: 'supported', sources: [] } },
    guidance: { status: 'published', primary_profile_id: 'chatml', supplemental_profile_ids: [] },
    licensing: {
      license_expression: 'MIT',
      commercial_use: 'allowed',
      redistribution: 'allowed',
    },
  },
  'publisher/atlas-13b': {
    name: 'publisher/atlas-13b',
    display_name: 'Atlas 13B',
    description: 'A larger Atlas chat model.',
    parameters: 13_000_000_000,
    baseline: 'llama',
    nsfw: false,
    tags: ['chat'],
    text_model_group: 'Atlas',
    guidance: { status: 'undocumented', supplemental_profile_ids: [] },
    licensing: {
      license_expression: 'NOASSERTION',
      commercial_use: 'unknown',
      redistribution: 'unknown',
    },
  },
};

const chatMlProfile = {
  profile_id: 'chatml',
  kind: 'prompt_contract',
  display_name: 'ChatML',
  aliases: ['chat-ml'],
  summary: 'Serialize messages with explicit role markers.',
  user: {
    overview: 'Use chat messages rather than a raw completion.',
    use_cases: ['Multi-turn chat'],
    tips: ['Keep the system message concise.'],
    caveats: [],
  },
  developer: {
    overview: 'Serialize roles before sending the prompt.',
    use_cases: ['API integrations'],
    tips: ['Preserve message order.'],
    caveats: ['Do not execute stored templates.'],
  },
  examples: [],
  recommended_settings: { temperature: 0.7 },
  sources: [],
  deprecated: false,
  interaction_modes: ['chat'],
  accepted_roles: ['system', 'user', 'assistant'],
  role_markers: {},
  stop_sequences: [],
  templates: [
    {
      template_id: 'primary',
      name: 'Chat messages',
      syntax: 'literal',
      template: '<|system|>{system}<|user|>{user}<|assistant|>',
      variables: [],
    },
  ],
};

async function mockCatalogApi(page: Page): Promise<void> {
  await page.route('**/replicate_mode', (route: Route) =>
    route.fulfill({
      json: { replicate_mode: 'PRIMARY', canonical_format: 'legacy', writable: true },
    }),
  );
  await page.route('**/model_references/v1', (route: Route) =>
    route.fulfill({ json: ['image_generation', 'text_generation'] }),
  );
  await page.route('**/model_references/v1/text_generation**', (route: Route) =>
    route.fulfill({ json: textModels }),
  );
  await page.route('**/model_references/v2/text_generation', (route: Route) =>
    route.fulfill({ json: textModels }),
  );
  await page.route('**/model_references/v2/text_generation/families', (route: Route) =>
    route.fulfill({
      json: { families: [{ family_name: 'Atlas family', members: ['Atlas'] }] },
    }),
  );
  await page.route('**/model_references/v2/text_generation/group?**', (route: Route) =>
    route.fulfill({
      json: {
        group_name: 'Atlas',
        members: [],
        common_fields: {},
        available_sizes: ['7B', '13B'],
        available_variants: [],
        available_quants: [],
        available_versions: [],
        size_usage: {},
        variant_usage: {},
        quant_usage: {},
        name_format: { template: '{name}' },
        canonical_count: 2,
        backend_duplicate_count: 0,
        related_family: { family_name: 'Atlas family', members: ['Atlas'] },
      },
    }),
  );
  await page.route('**/model_references/statistics/*/with-stats**', (route: Route) =>
    route.fulfill({
      json: {
        'publisher/atlas-7b': {
          worker_count: 2,
          observed_at: Math.floor(Date.now() / 1000),
          usage_stats: { day: 10, month: 100, total: 1000 },
          worker_summaries: {
            worker: {
              id: 'worker',
              name: 'public-worker',
              performance: '1',
              online: true,
              trusted: true,
              uptime: 100,
              max_length: 4096,
              max_context_length: 32768,
              bridge_agent: 'KoboldCpp:1',
              nsfw: false,
            },
          },
        },
        'publisher/atlas-13b': {
          worker_count: 0,
          observed_at: Math.floor(Date.now() / 1000),
          usage_stats: { day: 20, month: 200, total: 2000 },
        },
      },
    }),
  );
  await page.route('**/model_references/statistics/*', (route: Route) =>
    route.fulfill({ json: { total_models: 2, baseline_distribution: {}, top_tags: [] } }),
  );
  await page.route('**/pending_queue/my/changes**', (route: Route) =>
    route.fulfill({ json: { items: [], total: 0, offset: 0, limit: 100 } }),
  );
  await page.route(/\/text_generation\/guidance\/profiles(?:\?.*)?$/, (route: Route) =>
    route.fulfill({
      json: {
        items: [
          {
            profile_id: 'chatml',
            kind: 'prompt_contract',
            display_name: 'ChatML',
            summary: chatMlProfile.summary,
            aliases: ['chat-ml'],
            deprecated: false,
            assigned_model_count: 1,
          },
        ],
        total: 1,
        metadata: { schema_version: 1, revision: 3 },
      },
    }),
  );
  await page.route('**/text_generation/guidance/assignments', (route: Route) =>
    route.fulfill({
      json: {
        items: [
          {
            model_name: 'publisher/atlas-7b',
            primary_profile_id: 'chatml',
            supplemental_profile_ids: [],
            metadata: { revision: 2 },
          },
        ],
        total: 1,
        metadata: { schema_version: 1, revision: 3 },
      },
    }),
  );
  await page.route('**/text_generation/guidance/profiles/chatml', (route: Route) =>
    route.fulfill({ json: chatMlProfile }),
  );
  await page.route('**/text_generation/guidance/model**', (route: Route) =>
    route.fulfill({
      json: {
        model_name: 'publisher/atlas-7b',
        summary: {
          status: 'published',
          primary_profile_id: 'chatml',
          supplemental_profile_ids: [],
        },
        primary_profile: chatMlProfile,
        supplemental_profiles: [],
        catalog_metadata: { schema_version: 1, revision: 3 },
      },
    }),
  );
}

test('text browsing distinguishes exact records from the grouped comparison', async ({ page }) => {
  await mockCatalogApi(page);
  await page.goto('/categories/text_generation');

  const table = page.getByLabel('Model catalog results');
  await expect(table.getByRole('button', { name: 'Open atlas-7b' })).toBeVisible();
  await expect(table.getByText('publisher/atlas-7b', { exact: true })).toBeVisible();
  await expect(table.getByText('publisher/atlas-13b', { exact: true })).toBeVisible();
  await expect(table.getByRole('link', { name: 'Atlas', exact: true }).first()).toHaveAttribute(
    'href',
    '/text-groups/group?name=Atlas',
  );
  await expect(table.getByRole('link', { name: 'Atlas family' }).first()).toHaveAttribute(
    'href',
    '/text-groups?families=Atlas%20family',
  );

  const nameHeader = table.getByRole('button', { name: /Model/ });
  await nameHeader.click();
  await expect(nameHeader.locator('xpath=..')).toHaveAttribute('aria-sort', 'ascending');
  await nameHeader.click();
  await expect(nameHeader.locator('xpath=..')).toHaveAttribute('aria-sort', 'descending');

  await page.getByRole('radio', { name: 'Grouped' }).click();
  await expect(page.getByText('Groups organize related records')).toBeVisible();
  await expect(page.getByRole('rowheader', { name: /Atlas/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'atlas-7b' })).toBeVisible();
  await expect(page.getByText('Usage guide')).toBeVisible();
  await expect(page.getByText('Guidance needed')).toBeVisible();
});

test('guidance changes audience without losing the reusable contract context', async ({ page }) => {
  await mockCatalogApi(page);
  await page.goto('/text-guidance');

  await expect(page.getByRole('heading', { name: 'Usage guidance catalog' })).toBeVisible();
  const selectedProfileHeading = page.getByRole('heading', { name: 'ChatML' });
  await expect(selectedProfileHeading).toBeVisible();
  await expect(
    selectedProfileHeading
      .locator('..')
      .getByText('Serialize messages with explicit role markers.', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Use chat messages rather than a raw completion.')).toBeVisible();

  await page.getByRole('button', { name: 'For developers' }).click();
  await expect(page.getByText('Serialize roles before sending the prompt.')).toBeVisible();
  await expect(page.getByText('Do not execute stored templates.')).toBeVisible();
  await expect(page.getByText('Catalog revision 3')).toBeVisible();
  await expect(page.getByRole('link', { name: 'publisher/atlas-7b' })).toHaveAttribute(
    'href',
    '/categories/text_generation/model/publisher%2Fatlas-7b',
  );
});

test('an exact model detail separates durable guidance from live worker ceilings', async ({
  page,
}) => {
  await mockCatalogApi(page);
  await page.goto('/categories/text_generation/model/publisher%2Fatlas-7b');

  await expect(page.getByText('maximum context observed')).toBeVisible();
  await expect(page.getByText('32,768 tokens')).toBeVisible();
  await expect(page.getByText('Live worker limits can change')).toBeVisible();
  const hierarchy = page.getByRole('navigation', { name: 'Text model hierarchy' });
  await expect(hierarchy.getByRole('link', { name: /Family Atlas family/ })).toHaveAttribute(
    'href',
    '/text-groups?families=Atlas%20family',
  );
  await expect(hierarchy.getByRole('link', { name: /Group Atlas/ })).toHaveAttribute(
    'href',
    '/text-groups/group?name=Atlas',
  );
  await expect(hierarchy.getByRole('link', { name: 'Compare group models' })).toHaveAttribute(
    'href',
    '/categories/text_generation?groups=Atlas',
  );

  await page.getByRole('tab', { name: 'Usage guidance' }).click();
  await expect(page.getByRole('heading', { name: 'How to use this model' })).toBeVisible();
  await expect(page.getByText('Serialize messages with explicit role markers.')).toBeVisible();
  await expect(page.getByText('Shared by this model')).toBeVisible();
});

test('grouped comparison remains contained at a mobile breakpoint', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockCatalogApi(page);
  await page.goto('/categories/text_generation?layout=grouped');

  const scroller = page.getByLabel('Text models grouped for comparison');
  await expect(scroller).toBeVisible();
  const measurements = await scroller.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(measurements.scrollWidth).toBeGreaterThan(measurements.clientWidth);
  expect(measurements.documentWidth).toBeLessThanOrEqual(measurements.viewportWidth);
});
