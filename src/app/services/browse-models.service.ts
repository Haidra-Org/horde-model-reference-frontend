import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, forkJoin, map, Observable, of } from 'rxjs';
import { ModelReferenceApiService } from './model-reference-api.service';
import { HordeApiService, BackendStatisticsResponse } from './horde-api.service';
import { StatisticsService } from '../api-client/api/statistics.service';
import { PendingQueueSummaryService } from './pending-queue-summary.service';
import type {
  BackendCombinedModelStatistics,
  ResponseReadV2ReferenceValue,
} from '../models/api.models';
import type { LegacyRecordUnion } from '../models';
import type { PendingChangeOverlay } from '../models/pending-change-overlay';
import type { PendingChangeRecord } from '../api-client/model/models';
import { MODEL_REFERENCE_CATEGORY } from '../api-client';
import type { ModelLicensing } from '../api-client';
import { HordeModelType } from '../models/horde-api.models';
import { domainOf } from '../shared/domain';
import { DEFAULT_CATEGORY } from '../shared/constants';
import { prettyBaseline } from '../models/maps';

// ---------------------------------------------------------------------------
// Public type exports
// ---------------------------------------------------------------------------

export type SortKey = 'usage' | 'workers' | 'name' | 'size' | 'params';
export type SortDirection = 'asc' | 'desc';
export type ViewMode = 'table' | 'grouped' | 'cards' | 'gallery';
export type NsfwFilter = 'all' | 'sfw' | 'nsfw';

/** Flat model shape used throughout the browse view. */
export interface BrowseModel {
  name: string;
  display_name?: string | null;
  description?: string | null;
  version?: string | null;
  style?: string | null;
  nsfw?: boolean | null;
  baseline?: string | null;
  tags?: string[] | null;
  family?: string | null;
  size_on_disk_bytes?: number | null;
  parameters_count?: number | null;
  context_window?: { maximum_tokens?: number | null } | null;
  interaction_modes?: string[] | null;
  capabilities?: Record<string, { status?: string }> | null;
  guidance?: {
    status?: 'published' | 'legacy_label' | 'undocumented';
    primary_profile_id?: string | null;
    supplemental_profile_ids?: string[];
  } | null;
  category?: string | null;
  /** Canonical comparison group containing this exact text-model record. */
  text_model_group?: string | null;
  /** Persisted family containing the model's text group. */
  text_group_family?: string | null;
  /** Reviewed model-level licensing conclusion returned by the v2 read API. */
  licensing?: ModelLicensing;
  /** True when an aggregate text row contains members with different conclusions. */
  _licensingMixed?: boolean;
  _raw?: LegacyRecordUnion;
  _ghost?: boolean;
  _pending?: PendingChangeOverlay;
  _stats?: BackendCombinedModelStatistics;
  /** Present when a compatibility view aggregates several records into one group. */
  _group?: BrowseGroupInfo;
}

/** Aggregated metadata for a text model group. */
export interface BrowseGroupInfo {
  groupName: string;
  /** The individual canonical model records rolled up into this group. */
  members: BrowseModel[];
  variantCount: number;
  /** Distinct parameter-size labels (e.g. `['7B', '13B']`), ascending. */
  sizes: string[];
  /** Compact size range for display (e.g. `7B\u201334B`). */
  sizeLabel: string;
}

/** One presentation group containing exact, independently actionable model records. */
export interface BrowseTextGroup {
  name: string;
  summary: BrowseModel;
  members: BrowseModel[];
}

export interface Facets {
  baselines: { value: string; label: string; count: number }[];
  styles: { value: string; label: string; count: number }[];
  groups: { value: string; label: string; count: number }[];
  families: { value: string; label: string; count: number }[];
  tags: { value: string; label: string; count: number }[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return a useful label even when upstream deliberately stores a blank display name. */
export function browseModelDisplayName(model: Pick<BrowseModel, 'name' | 'display_name'>): string {
  const explicit = model.display_name?.trim();
  if (explicit) return explicit;
  const identifier = model.name.trim();
  return identifier.split('/').filter(Boolean).at(-1) ?? (identifier || 'Unnamed model');
}

/**
 * Extract a family/series label from a record. Legacy records expose a `family`
 * string; v2 records expose a `finetune_series` object carrying a `name`.
 */
function extractFamily(record: Record<string, unknown>): string | null {
  const raw = record['family'] ?? record['finetune_series'];
  if (typeof raw === 'string') return raw || null;
  if (raw && typeof raw === 'object' && 'name' in raw) {
    const name = (raw as { name?: unknown }).name;
    return typeof name === 'string' && name.length > 0 ? name : null;
  }
  return null;
}

/** Normalize a legacy record or v2 response value into a flat BrowseModel. */
export function toBrowseModel(record: Record<string, unknown>, category: string): BrowseModel {
  const name = String(record['name'] ?? '');
  const recordParams =
    (record['parameters'] as number | null | undefined) ??
    (record['parameters_count'] as number | null | undefined) ??
    null;
  return {
    name,
    display_name: (record['display_name'] as string | null | undefined) ?? null,
    description: (record['description'] as string | null | undefined) ?? null,
    version: (record['version'] as string | null | undefined) ?? null,
    style: (record['style'] as string | null | undefined) ?? null,
    nsfw: (record['nsfw'] as boolean | null | undefined) ?? null,
    baseline: (record['baseline'] as string | null | undefined) ?? null,
    tags: (record['tags'] as string[] | null | undefined) ?? null,
    family: extractFamily(record),
    size_on_disk_bytes: (record['size_on_disk_bytes'] as number | null | undefined) ?? null,
    // Parameter counts are structured API data. Do not infer them again from names;
    // group endpoints already expose the result of the canonical name-schema parser.
    parameters_count: recordParams,
    context_window: record['context_window'] as BrowseModel['context_window'],
    interaction_modes: record['interaction_modes'] as BrowseModel['interaction_modes'],
    capabilities: record['capabilities'] as BrowseModel['capabilities'],
    guidance: record['guidance'] as BrowseModel['guidance'],
    category,
    text_model_group: (record['text_model_group'] as string | null | undefined) ?? null,
    licensing: record['licensing'] as ModelLicensing | undefined,
    _raw: record as LegacyRecordUnion,
  };
}

/** Convert a pending `create` change payload into a ghost BrowseModel. */
function ghostFromChange(change: PendingChangeRecord): BrowseModel {
  const p = (change.payload ?? {}) as Record<string, unknown>;
  return {
    name: (p['name'] as string) || change.model_name,
    display_name: (p['display_name'] as string) ?? ((p['name'] as string) || change.model_name),
    description: (p['description'] as string) ?? '',
    baseline: p['baseline'] as string | undefined,
    nsfw: (p['nsfw'] as boolean) ?? false,
    style: p['style'] as string | undefined,
    tags: (p['tags'] as string[]) ?? [],
    _ghost: true,
    _pending: {
      pendingOperation: 'create' as const,
      pendingChangeId: change.change_id,
      isGhost: true,
      pendingRecord: change,
    },
  };
}

// ---------------------------------------------------------------------------
// Text group aggregation
// ---------------------------------------------------------------------------

/** Format a raw parameter count into a short label (e.g. 13_000_000_000 \u2192 `13B`). */
function formatParamLabel(n: number | null | undefined): string | null {
  if (n == null) return null;
  if (n >= 1e9) return `${parseFloat((n / 1e9).toFixed(1))}B`;
  if (n >= 1e6) return `${Math.round(n / 1e6)}M`;
  return String(n);
}

/** Render an ascending list of size labels as a compact range (e.g. `7B\u201334B`). */
function formatSizeRange(sizes: string[]): string {
  if (sizes.length === 0) return '';
  if (sizes.length === 1) return sizes[0];
  return `${sizes[0]}\u2013${sizes[sizes.length - 1]}`;
}

/** Return the key with the highest count, or null when the map is empty. */
function mostCommonKey(counts: Map<string, number>): string | null {
  let best: string | null = null;
  let bestCount = -1;
  for (const [key, count] of counts) {
    if (count > bestCount) {
      best = key;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Roll up several text model variants (sharing a `text_model_group`) into a
 * single group row: summed worker/usage/queued stats, merged tags, the set of
 * parameter sizes, and the members preserved for drill-down fidelity.
 */
function buildGroupRow(groupName: string, members: BrowseModel[]): BrowseModel {
  let workers = 0;
  let usageDay = 0;
  let usageMonth = 0;
  let usageTotal = 0;
  let queued = 0;
  const tagSet = new Set<string>();
  const sizeMap = new Map<number, string>();
  const baselineCounts = new Map<string, number>();
  let nsfw = false;
  let description: string | null = null;
  let pending: PendingChangeOverlay | undefined;
  let maxParams = 0;

  const memberLicensing = members.map(
    (member) =>
      member.licensing ?? {
        license_expression: 'NOASSERTION',
        commercial_use: 'unknown' as const,
        redistribution: 'unknown' as const,
      },
  );
  const licensingMixed =
    new Set(memberLicensing.map((licensing) => JSON.stringify(licensing))).size > 1;

  for (const m of members) {
    const s = m._stats;
    workers += s?.worker_count ?? 0;
    usageDay += s?.usage_stats?.day ?? 0;
    usageMonth += s?.usage_stats?.month ?? 0;
    usageTotal += s?.usage_stats?.total ?? 0;
    queued += s?.queued_jobs ?? 0;
    for (const t of m.tags ?? []) tagSet.add(t);
    if (m.parameters_count != null) {
      const label = formatParamLabel(m.parameters_count);
      if (label) sizeMap.set(m.parameters_count, label);
      maxParams = Math.max(maxParams, m.parameters_count);
    }
    if (m.baseline) baselineCounts.set(m.baseline, (baselineCounts.get(m.baseline) ?? 0) + 1);
    if (m.nsfw) nsfw = true;
    if (!description && m.description) description = m.description;
    if (!pending && m._pending) pending = m._pending;
  }

  const sizes = Array.from(sizeMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, label]) => label);

  const stats: BackendCombinedModelStatistics = {
    worker_count: workers,
    queued_jobs: queued,
    usage_stats: { day: usageDay, month: usageMonth, total: usageTotal },
  };

  return {
    name: groupName,
    display_name: groupName,
    description,
    baseline: mostCommonKey(baselineCounts),
    nsfw,
    tags: Array.from(tagSet),
    family: null,
    parameters_count: maxParams > 0 ? maxParams : null,
    category: 'text_generation',
    text_model_group: groupName,
    licensing: licensingMixed
      ? {
          license_expression: 'MULTIPLE',
          commercial_use: 'unknown',
          redistribution: 'unknown',
          notes: 'Members of this group have different licensing conclusions.',
        }
      : memberLicensing[0],
    _licensingMixed: licensingMixed,
    _stats: stats,
    _pending: pending,
    _group: {
      groupName,
      members,
      variantCount: members.length,
      sizes,
      sizeLabel: formatSizeRange(sizes),
    },
  };
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

@Injectable({ providedIn: 'root' })
export class BrowseModelsStore {
  private readonly api = inject(ModelReferenceApiService);
  private readonly hordeApi = inject(HordeApiService);
  private readonly statisticsService = inject(StatisticsService);
  private readonly pendingSummary = inject(PendingQueueSummaryService);
  private readonly destroyRef = inject(DestroyRef);

  // ---- Core state ----

  readonly category = signal<string>(DEFAULT_CATEGORY);
  private readonly _rawModels = signal<Record<string, unknown>[]>([]);
  private readonly _textGroupFamilies = signal<Map<string, string>>(new Map());
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  // Stats (loaded async after models render)
  readonly statsLoading = signal(false);
  private readonly _statsMap = signal<Map<string, BackendCombinedModelStatistics>>(new Map());

  // ---- Pending merge ----

  private readonly pendingForCategory = computed(() => {
    const cat = this.category();
    return this.pendingSummary.records().filter((r) => r.category === cat);
  });

  /**
   * Live models annotated with pending-change overlays.
   * - Pending `create` → ghost rows (_ghost = true) prepended to the list.
   * - Pending `update` / `delete` → _pending overlay attached to the matching live model.
   */
  readonly mergedModels = computed<BrowseModel[]>(() => {
    const cat = this.category();
    const rawModels = this._rawModels();
    const pending = this.pendingForCategory();

    // Normalize live models
    const byName = new Map<string, BrowseModel>();
    for (const raw of rawModels) {
      const m = toBrowseModel(raw, cat);
      m.text_group_family = m.text_model_group
        ? (this._textGroupFamilies().get(m.text_model_group) ?? null)
        : null;
      byName.set(m.name, m);
    }

    const ghosts: BrowseModel[] = [];

    for (const change of pending) {
      if (change.operation === 'create') {
        ghosts.push(ghostFromChange(change));
      } else if (byName.has(change.model_name)) {
        const model = byName.get(change.model_name)!;
        model._pending = {
          pendingOperation: change.operation,
          pendingChangeId: change.change_id,
          isGhost: false,
          pendingRecord: change as PendingChangeRecord,
        };
      }
    }

    return [...ghosts, ...Array.from(byName.values())];
  });

  // ---- Filter / sort state ----

  readonly searchQuery = signal('');
  readonly sortKey = signal<SortKey>('usage');
  readonly sortDirection = signal<SortDirection>('desc');
  readonly viewMode = signal<ViewMode>('table');
  readonly activeBaselines = signal<string[]>([]);
  readonly activeStyles = signal<string[]>([]);
  readonly activeGroups = signal<string[]>([]);
  readonly activeFamilies = signal<string[]>([]);
  readonly activeTags = signal<string[]>([]);
  readonly nsfwFilter = signal<NsfwFilter>('all');
  readonly pendingOnly = signal(false);

  // ---- Derived: filtered + sorted ----

  readonly filteredModels = computed<BrowseModel[]>(() => {
    const q = this.searchQuery().toLowerCase();
    const baselines = this.activeBaselines();
    const styles = this.activeStyles();
    const groups = this.activeGroups();
    const families = this.activeFamilies();
    const tags = this.activeTags();
    const nsfw = this.nsfwFilter();
    const pendingOnly = this.pendingOnly();
    const sort = this.sortKey();
    const statsMap = this._statsMap();

    const list = this.mergedModels().filter((m) => {
      if (q) {
        const haystack = [
          m.display_name ?? m.name,
          m.name,
          (m.tags ?? []).join(' '),
          m.description ?? '',
          m.text_model_group ?? '',
          m.text_group_family ?? '',
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (baselines.length && !baselines.includes(m.baseline ?? '')) return false;
      if (styles.length && !styles.includes(m.style ?? '')) return false;
      if (groups.length && !groups.includes(m.text_model_group ?? '')) return false;
      if (families.length && !families.includes(m.text_group_family ?? m.family ?? ''))
        return false;
      if (tags.length && !tags.every((tag) => (m.tags ?? []).includes(tag))) return false;
      if (nsfw === 'sfw' && m.nsfw) return false;
      if (nsfw === 'nsfw' && !m.nsfw) return false;
      if (pendingOnly && !m._pending) return false;
      return true;
    });

    // Attach stats to each model
    for (const m of list) {
      const stats = statsMap.get(m.name);
      if (stats) m._stats = stats;
    }

    const rows = list;
    const direction = this.sortDirection() === 'asc' ? 1 : -1;

    rows.sort((a, b) => {
      if (a._ghost && !b._ghost) return -1;
      if (b._ghost && !a._ghost) return 1;

      const availability =
        Number((b._stats?.worker_count ?? 0) > 0) - Number((a._stats?.worker_count ?? 0) > 0);
      if (availability !== 0) return availability;

      const sa = a._stats;
      const sb = b._stats;

      switch (sort) {
        case 'usage':
          return direction * ((sa?.usage_stats?.month ?? 0) - (sb?.usage_stats?.month ?? 0));
        case 'workers':
          return direction * ((sa?.worker_count ?? 0) - (sb?.worker_count ?? 0));
        case 'name':
          return direction * browseModelDisplayName(a).localeCompare(browseModelDisplayName(b));
        case 'size':
          return direction * ((a.size_on_disk_bytes ?? 0) - (b.size_on_disk_bytes ?? 0));
        case 'params':
          return direction * ((a.parameters_count ?? 0) - (b.parameters_count ?? 0));
        default:
          return 0;
      }
    });

    return rows;
  });

  /** Grouped alternate view; the exact model list above remains the default catalog. */
  readonly groupedTextModels = computed<BrowseTextGroup[]>(() => {
    const buckets = new Map<string, BrowseModel[]>();
    for (const model of this.filteredModels()) {
      const groupName = model.text_model_group?.trim() || 'Ungrouped models';
      const members = buckets.get(groupName) ?? [];
      members.push(model);
      buckets.set(groupName, members);
    }
    return Array.from(buckets, ([name, members]) => ({
      name,
      members,
      summary: buildGroupRow(name, members),
    })).sort((left, right) => left.name.localeCompare(right.name));
  });

  // ---- Derived: facets for filter chips ----

  readonly facets = computed<Facets>(() => {
    const models = this.mergedModels();
    const baselineCounts = new Map<string, number>();
    const styleCounts = new Map<string, number>();
    const groupCounts = new Map<string, number>();
    const familyCounts = new Map<string, number>();
    const tagCounts = new Map<string, number>();

    for (const m of models) {
      if (m.baseline) baselineCounts.set(m.baseline, (baselineCounts.get(m.baseline) ?? 0) + 1);
      if (m.style) styleCounts.set(m.style, (styleCounts.get(m.style) ?? 0) + 1);
      if (m.text_model_group) {
        groupCounts.set(m.text_model_group, (groupCounts.get(m.text_model_group) ?? 0) + 1);
      }
      const familyName = m.text_group_family ?? m.family;
      if (familyName) familyCounts.set(familyName, (familyCounts.get(familyName) ?? 0) + 1);
      for (const tag of m.tags ?? []) {
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      }
    }

    return {
      baselines: Array.from(baselineCounts, ([value, count]) => ({
        value,
        label: prettyBaseline(value),
        count,
      })),
      styles: Array.from(styleCounts, ([value, count]) => ({
        value,
        label: value.charAt(0).toUpperCase() + value.slice(1),
        count,
      })),
      groups: Array.from(groupCounts, ([value, count]) => ({ value, label: value, count })).sort(
        (left, right) => left.label.localeCompare(right.label),
      ),
      families: Array.from(familyCounts, ([value, count]) => ({ value, label: value, count })),
      tags: Array.from(tagCounts, ([value, count]) => ({ value, label: value, count })).sort(
        (left, right) => right.count - left.count || left.label.localeCompare(right.label),
      ),
    };
  });

  readonly resultCount = computed(() => this.filteredModels().length);
  readonly pendingCount = computed(() => this.pendingForCategory().length);

  readonly isImageDomain = computed(() => domainOf(this.category()) === 'image');
  readonly isTextDomain = computed(() => domainOf(this.category()) === 'text');

  // ---- Category counts for the rail ----

  readonly categoryCounts = signal<Map<string, number>>(new Map());
  readonly categoryCountsLoading = signal(false);

  // ---- Public methods ----

  loadCategory(cat: string): void {
    this.category.set(cat);
    this.loading.set(true);
    this.error.set(null);
    this._rawModels.set([]);
    this._textGroupFamilies.set(new Map());
    this._statsMap.set(new Map());

    // Text reads use the v2 endpoint: it is deduplicated (no backend-prefixed
    // variants) and carries the `text_model_group` field required for grouping.
    const source$: Observable<(LegacyRecordUnion | ResponseReadV2ReferenceValue)[]> =
      cat === 'text_generation'
        ? this.api.getModelsInCategory(cat).pipe(map((response) => Object.values(response)))
        : this.api.getDisplayModelsAsArray(cat);

    const groupFamilies$ =
      cat === 'text_generation'
        ? this.api.listFamilies().pipe(
            map((response) => {
              const result = new Map<string, string>();
              for (const family of response.families ?? []) {
                for (const groupName of family.members) result.set(groupName, family.family_name);
              }
              return result;
            }),
            catchError(() => of(new Map<string, string>())),
          )
        : of(new Map<string, string>());

    forkJoin({ models: source$, groupFamilies: groupFamilies$ })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ models, groupFamilies }) => {
          this._textGroupFamilies.set(groupFamilies);
          this._rawModels.set(models as Record<string, unknown>[]);
          this.loading.set(false);
          this.loadStats(cat);
        },
        error: (err) => {
          this.error.set(err?.message ?? 'Failed to load models');
          this.loading.set(false);
        },
      });
  }

  setSort(sortKey: SortKey): void {
    if (this.sortKey() === sortKey) {
      this.sortDirection.update((direction) => (direction === 'asc' ? 'desc' : 'asc'));
      return;
    }
    this.sortKey.set(sortKey);
    this.sortDirection.set(sortKey === 'name' ? 'asc' : 'desc');
  }

  private loadStats(cat: string): void {
    const type: HordeModelType = cat === 'text_generation' ? 'text' : 'image';
    this.statsLoading.set(true);

    this.hordeApi
      .getCombinedModelData(type)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response: BackendStatisticsResponse) => {
          const map = new Map<string, BackendCombinedModelStatistics>();
          for (const [name, stats] of Object.entries(response)) {
            if (stats) map.set(name, stats);
          }
          this._statsMap.set(map);
          this.statsLoading.set(false);
        },
        error: () => {
          this.statsLoading.set(false);
        },
      });
  }

  loadAllCategoryCounts(): void {
    this.categoryCountsLoading.set(true);

    this.api
      .getCategories()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (categories) => {
          const counts = new Map<string, number>();
          let completed = 0;

          if (categories.length === 0) {
            this.categoryCounts.set(counts);
            this.categoryCountsLoading.set(false);
            return;
          }

          for (const cat of categories) {
            this.statisticsService
              .readV2CategoryStatistics(cat as MODEL_REFERENCE_CATEGORY)
              .subscribe({
                next: (stats) => {
                  counts.set(cat, stats.total_models ?? 0);
                  completed++;
                  if (completed >= categories.length) {
                    this.categoryCounts.set(counts);
                    this.categoryCountsLoading.set(false);
                  }
                },
                error: () => {
                  counts.set(cat, 0);
                  completed++;
                  if (completed >= categories.length) {
                    this.categoryCounts.set(counts);
                    this.categoryCountsLoading.set(false);
                  }
                },
              });
          }
        },
        error: () => {
          this.categoryCountsLoading.set(false);
        },
      });
  }

  hydrateFromParams(params: Record<string, string>): void {
    this.searchQuery.set(params['q'] ?? '');
    this.sortKey.set(
      params['sort'] && isValidSortKey(params['sort']) ? (params['sort'] as SortKey) : 'usage',
    );
    this.sortDirection.set(params['direction'] === 'asc' ? 'asc' : 'desc');
    this.viewMode.set(
      params['layout'] && isValidViewMode(params['layout'])
        ? (params['layout'] as ViewMode)
        : 'table',
    );
    this.activeBaselines.set(splitQueryList(params['baselines']));
    this.activeStyles.set(splitQueryList(params['styles']));
    this.activeGroups.set(splitQueryList(params['groups']));
    this.activeFamilies.set(splitQueryList(params['families']));
    this.activeTags.set(splitQueryList(params['tags']));
    this.nsfwFilter.set(
      params['nsfw'] && isValidNsfwFilter(params['nsfw']) ? (params['nsfw'] as NsfwFilter) : 'all',
    );
    this.pendingOnly.set(params['pending'] === 'true');
  }

  toQueryParams(): Record<string, string | null> {
    const params: Record<string, string | null> = {};
    const q = this.searchQuery();
    if (q) params['q'] = q;
    params['sort'] = this.sortKey() === 'usage' ? null : this.sortKey();
    params['direction'] = this.sortDirection() === 'desc' ? null : this.sortDirection();
    params['layout'] = this.viewMode() === 'table' ? null : this.viewMode();
    const baselines = this.activeBaselines();
    if (baselines.length) params['baselines'] = baselines.join(',');
    else params['baselines'] = null;
    const styles = this.activeStyles();
    if (styles.length) params['styles'] = styles.join(',');
    else params['styles'] = null;
    const groups = this.activeGroups();
    if (groups.length) params['groups'] = groups.join(',');
    else params['groups'] = null;
    const families = this.activeFamilies();
    if (families.length) params['families'] = families.join(',');
    else params['families'] = null;
    const tags = this.activeTags();
    if (tags.length) params['tags'] = tags.join(',');
    else params['tags'] = null;
    const nsfw = this.nsfwFilter();
    if (nsfw !== 'all') params['nsfw'] = nsfw;
    else params['nsfw'] = null;
    params['pending'] = this.pendingOnly() ? 'true' : null;
    return params;
  }
}

// ---- Validators ----

const VALID_SORT_KEYS = new Set(['usage', 'workers', 'name', 'size', 'params']);
const VALID_VIEW_MODES = new Set(['table', 'grouped', 'cards', 'gallery']);
const VALID_NSFW_FILTERS = new Set(['all', 'sfw', 'nsfw']);

function isValidSortKey(v: string): boolean {
  return VALID_SORT_KEYS.has(v);
}
function isValidViewMode(v: string): boolean {
  return VALID_VIEW_MODES.has(v);
}
function isValidNsfwFilter(v: string): boolean {
  return VALID_NSFW_FILTERS.has(v);
}

function splitQueryList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}
