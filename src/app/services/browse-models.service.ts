import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ModelReferenceApiService } from './model-reference-api.service';
import { HordeApiService, BackendStatisticsResponse } from './horde-api.service';
import { StatisticsService } from '../api-client/api/statistics.service';
import { PendingQueueSummaryService } from './pending-queue-summary.service';
import type { BackendCombinedModelStatistics } from '../models/api.models';
import type { LegacyRecordUnion } from '../models';
import type { PendingChangeOverlay } from '../models/pending-change-overlay';
import type { PendingChangeRecord } from '../api-client/model/models';
import { MODEL_REFERENCE_CATEGORY } from '../api-client';
import { HordeModelType } from '../models/horde-api.models';
import { domainOf } from '../shared/domain';
import { DEFAULT_CATEGORY } from '../shared/constants';

// ---------------------------------------------------------------------------
// Public type exports
// ---------------------------------------------------------------------------

export type SortKey = 'usage' | 'workers' | 'name' | 'size' | 'params';
export type ViewMode = 'table' | 'cards' | 'gallery';
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
  category?: string | null;
  _raw?: LegacyRecordUnion;
  _ghost?: boolean;
  _pending?: PendingChangeOverlay;
  _stats?: BackendCombinedModelStatistics;
}

export interface Facets {
  baselines: { value: string; label: string; count: number }[];
  styles: { value: string; label: string; count: number }[];
  families: { value: string; label: string; count: number }[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Normalize a legacy record or v2 response value into a flat BrowseModel. */
function toBrowseModel(record: Record<string, unknown>, category: string): BrowseModel {
  return {
    name: String(record['name'] ?? ''),
    display_name: (record['display_name'] as string | null | undefined) ?? null,
    description: (record['description'] as string | null | undefined) ?? null,
    version: (record['version'] as string | null | undefined) ?? null,
    style: (record['style'] as string | null | undefined) ?? null,
    nsfw: (record['nsfw'] as boolean | null | undefined) ?? null,
    baseline: (record['baseline'] as string | null | undefined) ?? null,
    tags: (record['tags'] as string[] | null | undefined) ?? null,
    family: ((record['family'] ?? record['finetune_series']) as string | null | undefined) ?? null,
    size_on_disk_bytes: (record['size_on_disk_bytes'] as number | null | undefined) ?? null,
    parameters_count: (record['parameters_count'] as number | null | undefined) ?? null,
    category,
    _raw: record as LegacyRecordUnion,
  };
}

/** Convert a pending `create` change payload into a ghost BrowseModel. */
function ghostFromChange(change: PendingChangeRecord): BrowseModel {
  const p = change.payload ?? {};
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
  readonly viewMode = signal<ViewMode>('table');
  readonly activeBaselines = signal<string[]>([]);
  readonly activeStyles = signal<string[]>([]);
  readonly activeFamilies = signal<string[]>([]);
  readonly nsfwFilter = signal<NsfwFilter>('all');
  readonly pendingOnly = signal(false);

  // ---- Derived: filtered + sorted ----

  readonly filteredModels = computed<BrowseModel[]>(() => {
    const q = this.searchQuery().toLowerCase();
    const baselines = this.activeBaselines();
    const styles = this.activeStyles();
    const families = this.activeFamilies();
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
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (baselines.length && !baselines.includes(m.baseline ?? '')) return false;
      if (styles.length && !styles.includes(m.style ?? '')) return false;
      if (families.length && !families.includes(m.family ?? '')) return false;
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

    list.sort((a, b) => {
      if (a._ghost && !b._ghost) return -1;
      if (b._ghost && !a._ghost) return 1;

      const sa = a._stats;
      const sb = b._stats;

      switch (sort) {
        case 'usage':
          return (sb?.usage_stats?.month ?? 0) - (sa?.usage_stats?.month ?? 0);
        case 'workers':
          return (sb?.worker_count ?? 0) - (sa?.worker_count ?? 0);
        case 'name':
          return (a.display_name ?? a.name).localeCompare(b.display_name ?? b.name);
        case 'size':
          return (b.size_on_disk_bytes ?? 0) - (a.size_on_disk_bytes ?? 0);
        case 'params':
          return (b.parameters_count ?? 0) - (a.parameters_count ?? 0);
        default:
          return 0;
      }
    });

    return list;
  });

  // ---- Derived: facets for filter chips ----

  readonly facets = computed<Facets>(() => {
    const models = this.mergedModels();
    const baselineCounts = new Map<string, number>();
    const styleCounts = new Map<string, number>();
    const familyCounts = new Map<string, number>();

    for (const m of models) {
      if (m.baseline) baselineCounts.set(m.baseline, (baselineCounts.get(m.baseline) ?? 0) + 1);
      if (m.style) styleCounts.set(m.style, (styleCounts.get(m.style) ?? 0) + 1);
      if (m.family) familyCounts.set(m.family, (familyCounts.get(m.family) ?? 0) + 1);
    }

    return {
      baselines: Array.from(baselineCounts, ([value, count]) => ({ value, label: value, count })),
      styles: Array.from(styleCounts, ([value, count]) => ({
        value,
        label: value.charAt(0).toUpperCase() + value.slice(1),
        count,
      })),
      families: Array.from(familyCounts, ([value, count]) => ({ value, label: value, count })),
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
    this._statsMap.set(new Map());

    // Reset filters
    this.searchQuery.set('');
    this.activeBaselines.set([]);
    this.activeStyles.set([]);
    this.activeFamilies.set([]);
    this.nsfwFilter.set('all');
    this.pendingOnly.set(false);

    this.api
      .getDisplayModelsAsArray(cat)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (models) => {
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
    if (params['q']) this.searchQuery.set(params['q']);
    if (params['sort'] && isValidSortKey(params['sort']))
      this.sortKey.set(params['sort'] as SortKey);
    if (params['layout'] && isValidViewMode(params['layout']))
      this.viewMode.set(params['layout'] as ViewMode);
    if (params['baselines']) this.activeBaselines.set(params['baselines'].split(','));
    if (params['styles']) this.activeStyles.set(params['styles'].split(','));
    if (params['families']) this.activeFamilies.set(params['families'].split(','));
    if (params['nsfw'] && isValidNsfwFilter(params['nsfw']))
      this.nsfwFilter.set(params['nsfw'] as NsfwFilter);
    if (params['pending'] === 'true') this.pendingOnly.set(true);
  }

  toQueryParams(): Record<string, string | null> {
    const params: Record<string, string | null> = {};
    const q = this.searchQuery();
    if (q) params['q'] = q;
    params['sort'] = this.sortKey();
    params['layout'] = this.viewMode();
    const baselines = this.activeBaselines();
    if (baselines.length) params['baselines'] = baselines.join(',');
    else params['baselines'] = null;
    const styles = this.activeStyles();
    if (styles.length) params['styles'] = styles.join(',');
    else params['styles'] = null;
    const families = this.activeFamilies();
    if (families.length) params['families'] = families.join(',');
    else params['families'] = null;
    const nsfw = this.nsfwFilter();
    if (nsfw !== 'all') params['nsfw'] = nsfw;
    else params['nsfw'] = null;
    params['pending'] = this.pendingOnly() ? 'true' : null;
    return params;
  }
}

// ---- Validators ----

const VALID_SORT_KEYS = new Set(['usage', 'workers', 'name', 'size', 'params']);
const VALID_VIEW_MODES = new Set(['table', 'cards', 'gallery']);
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
