import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';

/**
 * Deterministic, mocked verification of the unified PendingQueueComponent —
 * the tabbed queue now wired to /pending-queue. Runs without a live backend or
 * any pending data, so it is CI-safe.
 *
 *   Diff inspection — expanding a change loads and renders its field-level diff.
 *   Apply confirmation — applying opens a confirmation modal first; the apply
 *     request fires ONLY after the user confirms, never on cancel.
 */

const API_KEY = 'mock-approver-key';
const BATCH_ID = 4242;

const changes = [
  {
    change_id: 801,
    category: 'image_generation',
    model_name: 'Juggernaut XL',
    operation: 'update',
    status: 'approved',
    requested_by: 'qa-approver',
    requested_username: 'qa-approver',
    requested_at: 1_700_000_500,
    batch_id: BATCH_ID,
    batch_title: 'June image additions',
  },
  {
    change_id: 802,
    category: 'image_generation',
    model_name: 'New Diffusion',
    operation: 'create',
    status: 'pending',
    requested_by: 'qa-approver',
    requested_username: 'qa-approver',
    requested_at: 1_700_000_600,
    batch_id: null,
  },
];

const diffsById: Record<number, unknown> = {
  801: {
    field_diffs: [
      {
        field_path: 'description',
        old_value: 'old text',
        new_value: 'new text',
        change_type: 'modified',
      },
    ],
  },
};

/** Number of times the apply-change endpoint was actually POSTed to. */
let applyCalls = 0;

async function mockBackend(page: Page): Promise<void> {
  applyCalls = 0;

  await page.route('**/replicate_mode', (route: Route) =>
    route.fulfill({ json: { replicate_mode: 'PRIMARY', canonical_format: 'v2', writable: true } }),
  );

  await page.route('https://aihorde.net/api/v2/find_user', (route: Route) =>
    route.fulfill({ json: { username: 'qa-approver' } }),
  );

  await page.route('**/model_references/v2/me/roles', (route: Route) =>
    route.fulfill({
      json: {
        user_id: 'qa-approver',
        username: 'qa-approver',
        roles: ['approver', 'requestor'],
        is_approver: true,
        is_requestor: true,
      },
    }),
  );

  // Broad change list first (covers the queue load and my-submissions poll).
  await page.route('**/model_references/v2/pending_queue/changes**', (route: Route) =>
    route.fulfill({ json: { items: changes, total: changes.length } }),
  );

  // Per-change diff — registered after the broad route so it wins for /changes/{id}/diff.
  await page.route('**/model_references/v2/pending_queue/changes/*/diff**', (route: Route) => {
    const match = /changes\/(\d+)\/diff/.exec(route.request().url());
    const id = match ? Number(match[1]) : 0;
    route.fulfill({ json: diffsById[id] ?? { field_diffs: [] } });
  });

  // Apply — registered last so it wins for /changes/{id}/apply; counts invocations.
  await page.route('**/model_references/v2/pending_queue/changes/*/apply**', (route: Route) => {
    applyCalls += 1;
    route.fulfill({
      json: {
        record: { ...changes[0], status: 'applied' },
        batch_split_occurred: false,
      },
    });
  });
}

async function login(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in' }).click();
  const modal = page.locator('.modal-dialog');
  await expect(modal).toBeVisible();
  await modal.locator('#api-key-input').fill(API_KEY);
  await modal.getByRole('button', { name: 'Login' }).click();
  await expect(modal).toHaveCount(0, { timeout: 20000 });
}

test.describe('pending queue — diff inspection & apply confirmation (mocked)', () => {
  test('expanding a change loads and renders its field-level diff', async ({ page }) => {
    await mockBackend(page);
    await login(page);
    await page.goto('/pending-queue');
    await page.getByRole('button', { name: 'Ready to apply' }).click();

    const row = page.locator('app-expandable-change-row', { hasText: 'Juggernaut XL' });
    await expect(row).toBeVisible({ timeout: 30000 });

    await row.locator('.change-row').click();
    const panel = row.locator('.expanded-panel');
    await expect(panel).toBeVisible();

    // The diff must resolve (not hang on the loading state) into a rendered diff.
    await expect(panel.getByText('Loading diff…')).toHaveCount(0, { timeout: 15000 });
    await expect(panel.locator('app-delta-diff')).toHaveCount(1);
  });

  test('applying an approved change requires explicit confirmation', async ({ page }) => {
    await mockBackend(page);
    await login(page);
    await page.goto('/pending-queue');
    await page.getByRole('button', { name: 'Ready to apply' }).click();

    const row = page.locator('app-expandable-change-row', { hasText: 'Juggernaut XL' });
    await expect(row).toBeVisible({ timeout: 30000 });

    await row.locator('.change-row').click();
    // The expanded, labeled apply control opens the confirmation modal — it must not apply yet.
    await row.getByRole('button', { name: 'Apply Change' }).click();
    const modal = page.locator('.modal-dialog--lg');
    await expect(modal).toBeVisible();
    await expect(modal.getByText('Apply Update Change')).toBeVisible();
    expect(applyCalls).toBe(0);

    // Cancelling closes the modal and still applies nothing.
    await modal.getByRole('button', { name: 'Cancel' }).click();
    await expect(modal).toHaveCount(0);
    expect(applyCalls).toBe(0);

    // Re-open and confirm — only now does the apply request fire (exactly once).
    await row.getByRole('button', { name: 'Apply Change' }).click();
    await expect(modal).toBeVisible();
    await modal.getByRole('button', { name: 'Apply Change' }).click();
    await expect.poll(() => applyCalls).toBe(1);
  });
});
