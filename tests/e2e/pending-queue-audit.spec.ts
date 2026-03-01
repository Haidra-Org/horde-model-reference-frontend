import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';

const API_BASE = process.env.E2E_API_BASE ?? 'http://localhost:19800/api';
const AUDIT_BASE = `${API_BASE}/model_references/v2/pending_queue/audit`;

const pendingSnapshot = {
  domain: 'legacy',
  pending_changes: [
    {
      change_id: 501,
      status: 'PENDING',
      operation: 'update',
      category: 'image_generation',
      model_name: 'Test Model',
      requested_by: 'user-123',
      requested_at: 1_700_000_500,
      events: [{ event_id: 1, timestamp: 1_700_000_500, action: 'enqueue', payload: {} }],
    },
  ],
  total_pending: 1,
  generated_at: 1_700_000_900,
};

const batchSummaries = {
  domain: 'legacy',
  batches: [
    {
      batch_id: 9001,
      batch_title: 'Release 42',
      approved_by: 'moderator',
      approved_at: 1_700_001_200,
      applied_at: 1_700_001_800,
      approved_change_count: 2,
      rejected_change_count: 0,
      applied_change_count: 2,
      total_change_count: 2,
      last_event_id: 99,
    },
  ],
  next_cursor: null,
};

const batchDetail = {
  ...batchSummaries.batches[0],
  changes: [
    {
      change_id: 501,
      status: 'APPLIED',
      operation: 'update',
      category: 'image_generation',
      model_name: 'Test Model',
      requested_by: 'user-123',
      requested_at: 1_700_000_500,
      approved_by: 'moderator',
      approved_at: 1_700_001_200,
      applied_by: 'queue-worker',
      applied_at: 1_700_001_800,
      events: [
        { event_id: 1, timestamp: 1_700_000_500, action: 'enqueue', payload: {} },
        { event_id: 2, timestamp: 1_700_001_200, action: 'approve', payload: { batch_id: 9001 } },
        { event_id: 3, timestamp: 1_700_001_800, action: 'apply', payload: { batch_id: 9001 } },
      ],
    },
  ],
};

async function mockReplicateMode(page: Page): Promise<void> {
  await page.route(`${API_BASE}/replicate_mode`, (route: Route) => {
    route.fulfill({ body: '"PRIMARY"', contentType: 'application/json' });
  });
}

async function ensureApiKey(route: Route, apiKey: string): Promise<void> {
  const headers = route.request().headers();
  expect(headers['apikey']).toBe(apiKey);
}

async function mockAuditEndpoints(page: Page, apiKey: string): Promise<void> {
  await page.route('**/model_references/v2/pending_queue/audit/current**', async (route: Route) => {
    await ensureApiKey(route, apiKey);
    const url = new URL(route.request().url());
    expect(url.href.startsWith(`${AUDIT_BASE}/current`)).toBe(true);
    await route.fulfill({ json: pendingSnapshot });
  });

  await page.route(
    '**/model_references/v2/pending_queue/audit/batches?**',
    async (route: Route) => {
      await ensureApiKey(route, apiKey);
      const url = new URL(route.request().url());
      expect(url.href.startsWith(`${AUDIT_BASE}/batches`)).toBe(true);
      await route.fulfill({ json: batchSummaries });
    },
  );

  await page.route(
    '**/model_references/v2/pending_queue/audit/batches/9001**',
    async (route: Route) => {
      await ensureApiKey(route, apiKey);
      const url = new URL(route.request().url());
      expect(url.href.startsWith(`${AUDIT_BASE}/batches/9001`)).toBe(true);
      await route.fulfill({ json: batchDetail });
    },
  );
}

async function loginAsApprover(page: Page, apiKey: string): Promise<void> {
  await page.route('https://aihorde.net/api/v2/find_user', async (route: Route) => {
    const headers = route.request().headers();
    expect(headers['apikey']).toBe(apiKey);
    await route.fulfill({ json: { username: 'qa-user' } });
  });

  await page.getByRole('button', { name: 'Login', exact: true }).click();
  const modal = page.locator('.modal-dialog');
  await modal.locator('#api-key-input').fill(apiKey);
  await modal.getByRole('button', { name: 'Login' }).click();
  await expect(page.getByText('qa-user')).toBeVisible();
}

test('redirects unauthenticated visitors away from the audit trail', async ({
  page,
}: {
  page: Page;
}) => {
  await mockReplicateMode(page);
  await page.goto('/pending-queue/audit');
  await expect(page).toHaveURL('/');
  await expect(
    page.getByText('Please log in with an approver API key to view the audit trail.'),
  ).toBeVisible();
});

test('shows pending queue data once an approver is authenticated', async ({
  page,
}: {
  page: Page;
}) => {
  const apiKey = 'test-key-123';
  await mockReplicateMode(page);
  await mockAuditEndpoints(page, apiKey);

  await page.goto('/');
  await loginAsApprover(page, apiKey);

  await page.getByRole('link', { name: 'Audit Trail' }).click();
  await expect(page).toHaveURL(/pending-queue\/audit/);

  await expect(page.getByRole('cell', { name: '#501' })).toBeVisible();
  await expect(page.getByText('Batch #9001 · Release 42')).toBeVisible();

  await page.getByRole('button', { name: /Batch #9001/ }).click();
  const drawer = page.getByRole('dialog', { name: 'Pending queue batch detail' });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole('heading', { name: /Batch #9001/ })).toBeVisible();
  await expect(drawer.getByText('Change #501 · Test Model')).toBeVisible();
  await expect(drawer.getByText('3 timeline events')).toBeVisible();
});
