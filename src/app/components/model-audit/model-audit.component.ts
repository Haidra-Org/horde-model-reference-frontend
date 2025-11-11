import {
  Component,
  inject,
  OnInit,
  signal,
  computed,
  ChangeDetectionStrategy,
  DestroyRef,
  EnvironmentInjector,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { Subject, Observable, combineLatest, EMPTY, of, fromEvent } from 'rxjs';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  filter,
  map,
  shareReplay,
  startWith,
  switchMap,
  tap,
} from 'rxjs/operators';
import { ModelReferenceApiService } from '../../services/model-reference-api.service';
import { NotificationService } from '../../services/notification.service';
import { AuthService } from '../../services/auth.service';
import {
  LegacyRecordUnion,
  isLegacyStableDiffusionRecord,
  isLegacyTextGenerationRecord,
} from '../../models';
import {
  UnifiedModelData,
  createGroupedTextModels,
  GroupedTextModel,
  isGroupedTextModel,
  mergeMultipleModels,
} from '../../models/unified-model';
import { HordeModelUsageStats } from '../../models/horde-api.models';
import { ModelAuditInfo, DeletionRiskFlags, CategoryAuditResponse } from '../../api-client';
import { BASELINE_SHORTHAND_MAP, RECORD_DISPLAY_MAP } from '../../models/maps';
import {
  getModelFileHosts,
  formatFileHosts,
  getFileHostBadgeClass,
  AUDIT_FILTER_PRESETS,
  PRESET_NAME_TO_BACKEND,
  AuditPreset,
  UsageTrend,
} from '../../utils/audit-metrics.utils';

/**
 * Enriched model data with audit metrics (mapped from backend ModelAuditInfo)
 */
interface ModelWithAuditMetrics {
  model: UnifiedModelData | GroupedTextModel;
  auditInfo: ModelAuditInfo | null; // Null in degraded mode
  // Core metrics
  name: string;
  workerCount: number;
  usagePercentage: number;
  usageTrend: UsageTrend;
  // New fields from audit API
  usageHour: number;
  usageMinute: number;
  costBenefitScore: number | null;
  nsfw: boolean | null;
  hasDescription: boolean;
  downloadCount: number;
  // Risk flags
  flags: DeletionRiskFlags | null; // Null in degraded mode
  isCritical: boolean;
  hasWarning: boolean;
  flagCount: number;
  fileHosts: string[];
  baseline: string | null;
  sizeGB: number | null;
  // Grouping support
  isGrouped: boolean;
  variations?: UnifiedModelData[];
  variationCount: number;
}

type SortColumn =
  | 'name'
  | 'baseline'
  | 'workers'
  | 'usageDay'
  | 'usageMonth'
  | 'usageTotal'
  | 'usagePercentage'
  | 'sizeGB'
  | 'flags';
type SortDirection = 'asc' | 'desc' | null;

@Component({
  selector: 'app-model-audit',
  imports: [FormsModule, RouterLink, ScrollingModule],
  templateUrl: './model-audit.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModelAuditComponent implements OnInit {
  private readonly api = inject(ModelReferenceApiService);
  private readonly notification = inject(NotificationService);
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(EnvironmentInjector);
  private readonly auditRefreshTrigger = new Subject<void>();

  // Route and data
  readonly category = signal<string>('');
  readonly models = signal<(UnifiedModelData | GroupedTextModel)[]>([]);
  readonly auditResponse = signal<CategoryAuditResponse | null>(null);
  readonly loading = signal(true);
  readonly auditLoading = signal(false);
  readonly degradedMode = signal(false); // True when audit API fails
  readonly lastRefreshTime = signal<number>(Date.now());

  // Staleness warning threshold (5 minutes = 300000ms, matching backend cache TTL)
  private readonly STALE_THRESHOLD_MS = 300000;

  // Filter controls - server-side via presets
  readonly selectedPresetName = signal<string>('Show All');

  // Client-side filters (same as model-list)
  readonly searchTerm = signal('');
  readonly searchTermSubject = new Subject<string>();
  readonly debouncedSearchTerm = signal('');
  readonly filterByActive = signal(false);
  readonly selectedTags = signal<string[]>([]);
  readonly tagSearchTerm = signal('');
  readonly tagFilterOpen = signal(false);
  readonly selectedParameterTags = signal<string[]>([]);
  readonly parameterTagSearchTerm = signal('');
  readonly parameterTagFilterOpen = signal(false);

  // Sorting
  readonly sortColumn = signal<SortColumn | null>(null);
  readonly sortDirection = signal<SortDirection>('desc');
  private initialSortSet = false;

  // Selection
  readonly selectedModels = signal<Set<string>>(new Set());

  // Row expansion for grouped models
  readonly expandedRows = signal<Set<string>>(new Set());

  // Dynamic viewport height (minimum 400px)
  private readonly VIEWPORT_MIN_HEIGHT = 400;
  private readonly VIEWPORT_OVERHEAD = 450; // Header, search, filters, etc.
  readonly windowHeight = signal(typeof window !== 'undefined' ? window.innerHeight : 800);
  readonly viewportHeight = computed(() =>
    Math.max(this.VIEWPORT_MIN_HEIGHT, this.windowHeight() - this.VIEWPORT_OVERHEAD),
  );

  // Computed values
  readonly recordDisplayName = computed(() => {
    return RECORD_DISPLAY_MAP[this.category()] || this.category();
  });

  readonly isTextGeneration = computed(() => this.category() === 'text_generation');
  readonly isImageGeneration = computed(() => this.category() === 'image_generation');

  private isParameterTag(tag: string): boolean {
    // Match patterns like: 33b, 65b, 7B, 13B, 70b, etc.
    return /^\d+\.?\d*[bB]$/.test(tag);
  }

  readonly availableTags = computed(() => {
    const tagsSet = new Set<string>();
    const isTextGen = this.isTextGeneration();
    this.models().forEach((model) => {
      const legacyModel = model as LegacyRecordUnion;
      if (isLegacyStableDiffusionRecord(legacyModel) && legacyModel.tags) {
        legacyModel.tags.forEach((tag) => tagsSet.add(tag));
      } else if (isLegacyTextGenerationRecord(legacyModel) && legacyModel.tags) {
        legacyModel.tags.forEach((tag) => {
          // For text generation, exclude parameter count tags
          if (!isTextGen || !this.isParameterTag(tag)) {
            tagsSet.add(tag);
          }
        });
      }
    });
    return Array.from(tagsSet).sort();
  });

  readonly availableParameterTags = computed(() => {
    if (!this.isTextGeneration()) {
      return [];
    }
    const paramTagsSet = new Set<string>();
    this.models().forEach((model) => {
      const legacyModel = model as LegacyRecordUnion;
      if (isLegacyTextGenerationRecord(legacyModel) && legacyModel.tags) {
        legacyModel.tags.forEach((tag) => {
          if (this.isParameterTag(tag)) {
            paramTagsSet.add(tag);
          }
        });
      }
    });
    // Sort parameter tags numerically
    return Array.from(paramTagsSet).sort((a, b) => {
      const numA = parseFloat(a);
      const numB = parseFloat(b);
      return numA - numB;
    });
  });

  readonly filteredAvailableTags = computed(() => {
    const search = this.tagSearchTerm().toLowerCase();
    if (!search) {
      return this.availableTags();
    }
    return this.availableTags().filter((tag) => tag.toLowerCase().includes(search));
  });

  readonly filteredAvailableParameterTags = computed(() => {
    const search = this.parameterTagSearchTerm().toLowerCase();
    if (!search) {
      return this.availableParameterTags();
    }
    return this.availableParameterTags().filter((tag) => tag.toLowerCase().includes(search));
  });

  /**
   * Check if audit data is stale (older than 5 minutes)
   */
  readonly isDataStale = computed(() => {
    const now = Date.now();
    const lastRefresh = this.lastRefreshTime();
    return now - lastRefresh > this.STALE_THRESHOLD_MS;
  });

  /**
   * Get available presets for the current category
   */
  readonly availablePresets = computed((): AuditPreset[] => {
    return AUDIT_FILTER_PRESETS[this.category()] ?? [];
  });

  constructor() {
    // Component initialization - filters are handled server-side via presets
  }

  /** Total 30-day usage across all models in category */
  readonly categoryTotalUsage = computed(() => {
    const auditResp = this.auditResponse();
    if (auditResp) {
      return auditResp.category_total_month_usage;
    }
    // Fallback for degraded mode
    const models = this.models();
    let total = 0;
    models.forEach((model) => {
      const stats = model.usageStats as HordeModelUsageStats | undefined;
      total += stats?.month ?? 0;
    });
    return total;
  });

  readonly modelsWithAuditMetrics = computed((): ModelWithAuditMetrics[] => {
    const auditResp = this.auditResponse();
    const models = this.models();
    const categoryTotal = this.categoryTotalUsage();

    if (auditResp && !this.degradedMode()) {
      // Backend mode: match audit data to models (including grouped models)
      return models.map((model) => {
        const isGrouped = isGroupedTextModel(model);

        if (isGrouped) {
          // For grouped models, aggregate audit data from all variations
          const groupedModel = model as GroupedTextModel;
          const variationAuditInfos = groupedModel.variations
            .map((v) => auditResp.models.find((a) => a.name === v.name))
            .filter((a): a is ModelAuditInfo => a !== undefined);

          if (variationAuditInfos.length === 0) {
            // No audit data for this grouped model - use degraded metrics
            return this.createDegradedMetrics(model, categoryTotal);
          }

          // Aggregate metrics across all variations
          const aggregatedWorkerCount = variationAuditInfos.reduce(
            (sum, a) => sum + (a.worker_count ?? 0),
            0,
          );
          const aggregatedUsageDay = variationAuditInfos.reduce(
            (sum, a) => sum + (a.usage_day ?? 0),
            0,
          );
          const aggregatedUsageMonth = variationAuditInfos.reduce(
            (sum, a) => sum + (a.usage_month ?? 0),
            0,
          );
          const aggregatedUsageTotal = variationAuditInfos.reduce(
            (sum, a) => sum + (a.usage_total ?? 0),
            0,
          );
          const aggregatedUsageHour = variationAuditInfos.reduce(
            (sum, a) => sum + (a.usage_hour ?? 0),
            0,
          );
          const aggregatedUsageMinute = variationAuditInfos.reduce(
            (sum, a) => sum + (a.usage_minute ?? 0),
            0,
          );

          // Collect all file hosts
          const allFileHosts = new Set<string>();
          variationAuditInfos.forEach((a) => {
            (a.download_hosts ?? []).forEach((h) => allFileHosts.add(h));
          });

          // Aggregate flags (a flag is set if ANY variation has it)
          const aggregatedFlags = variationAuditInfos.reduce(
            (acc, a) => {
              const f = a.deletion_risk_flags;
              if (!f) return acc;
              return {
                zero_usage_day: acc.zero_usage_day || f.zero_usage_day,
                zero_usage_month: acc.zero_usage_month || f.zero_usage_month,
                zero_usage_total: acc.zero_usage_total || f.zero_usage_total,
                no_active_workers: acc.no_active_workers || f.no_active_workers,
                has_multiple_hosts: acc.has_multiple_hosts || f.has_multiple_hosts,
                has_non_preferred_host: acc.has_non_preferred_host || f.has_non_preferred_host,
                has_unknown_host: acc.has_unknown_host || f.has_unknown_host,
                no_download_urls: acc.no_download_urls || f.no_download_urls,
                missing_description: acc.missing_description || f.missing_description,
                missing_baseline: acc.missing_baseline || f.missing_baseline,
                low_usage: acc.low_usage || f.low_usage,
              };
            },
            {
              zero_usage_day: false,
              zero_usage_month: false,
              zero_usage_total: false,
              no_active_workers: false,
              has_multiple_hosts: false,
              has_non_preferred_host: false,
              has_unknown_host: false,
              no_download_urls: false,
              missing_description: false,
              missing_baseline: false,
              low_usage: false,
            } as DeletionRiskFlags,
          );

          const aggregatedRiskScore = variationAuditInfos.reduce(
            (sum, a) => sum + (a.risk_score ?? 0),
            0,
          );

          // Use first variation's audit info as template
          const primaryAuditInfo = variationAuditInfos[0];
          const usagePercentage =
            categoryTotal > 0 ? (aggregatedUsageMonth / categoryTotal) * 100 : 0;

          // For grouped models, aggregate critical/warning status across all variations
          const isCritical = variationAuditInfos.some((a) => a.is_critical);
          const hasWarning = variationAuditInfos.some((a) => a.has_warning);

          return {
            model,
            auditInfo: primaryAuditInfo, // Reference to first variation's audit info
            name: model.name,
            workerCount: aggregatedWorkerCount,
            usagePercentage,
            usageTrend: {
              dayToMonthRatio:
                aggregatedUsageMonth > 0 ? aggregatedUsageDay / aggregatedUsageMonth : null,
              monthToTotalRatio:
                aggregatedUsageTotal > 0 ? aggregatedUsageMonth / aggregatedUsageTotal : null,
            },
            usageHour: aggregatedUsageHour,
            usageMinute: aggregatedUsageMinute,
            costBenefitScore: null, // Can't meaningfully aggregate
            nsfw: primaryAuditInfo.nsfw ?? null,
            hasDescription: primaryAuditInfo.has_description ?? false,
            downloadCount: variationAuditInfos.reduce((sum, a) => sum + (a.download_count ?? 0), 0),
            flags: aggregatedFlags,
            isCritical,
            hasWarning,
            flagCount: aggregatedRiskScore,
            fileHosts: Array.from(allFileHosts),
            baseline: primaryAuditInfo.baseline ?? null,
            sizeGB: primaryAuditInfo.size_gb ?? null,
            isGrouped: true,
            variations: groupedModel.variations,
            variationCount: groupedModel.variations.length,
          };
        } else {
          // For ungrouped models, find matching audit info by exact name
          const auditInfo = auditResp.models.find((a) => a.name === model.name);
          if (!auditInfo) {
            return this.createDegradedMetrics(model, categoryTotal);
          }

          const fileHosts = auditInfo.download_hosts ?? [];
          const flags = auditInfo.deletion_risk_flags;

          return {
            model,
            auditInfo,
            name: auditInfo.name,
            workerCount: auditInfo.worker_count ?? 0,
            usagePercentage: auditInfo.usage_percentage_of_category ?? 0,
            usageTrend: {
              dayToMonthRatio: auditInfo.usage_trend?.day_to_month_ratio ?? null,
              monthToTotalRatio: auditInfo.usage_trend?.month_to_total_ratio ?? null,
            },
            usageHour: auditInfo.usage_hour ?? 0,
            usageMinute: auditInfo.usage_minute ?? 0,
            costBenefitScore: auditInfo.cost_benefit_score ?? null,
            nsfw: auditInfo.nsfw ?? null,
            hasDescription: auditInfo.has_description ?? false,
            downloadCount: auditInfo.download_count ?? 0,
            flags: flags ?? null,
            isCritical: auditInfo.is_critical, // Use backend-computed value
            hasWarning: auditInfo.has_warning, // Use backend-computed value
            flagCount: auditInfo.risk_score ?? 0,
            fileHosts,
            baseline: auditInfo.baseline ?? null,
            sizeGB: auditInfo.size_gb ?? null,
            isGrouped: false,
            variations: undefined,
            variationCount: 0,
          };
        }
      });
    }

    // Degraded mode: create basic metrics from reference data only
    return models.map((model) => this.createDegradedMetrics(model, categoryTotal));
  });

  /**
   * Create metrics in degraded mode (when audit API fails)
   */
  private createDegradedMetrics(
    model: UnifiedModelData | GroupedTextModel,
    categoryTotal: number,
  ): ModelWithAuditMetrics {
    const legacyModel = model as LegacyRecordUnion;
    const stats = model.usageStats as HordeModelUsageStats | undefined;
    const monthUsage = stats?.month ?? 0;

    const fileHosts = getModelFileHosts(model);

    let baseline: string | null = null;
    if (isLegacyStableDiffusionRecord(legacyModel)) {
      baseline = legacyModel.baseline;
    } else if (isLegacyTextGenerationRecord(legacyModel)) {
      baseline = legacyModel.baseline ?? null;
    }

    let sizeGB: number | null = null;
    if (isLegacyStableDiffusionRecord(legacyModel) && legacyModel.size_on_disk_bytes) {
      sizeGB = legacyModel.size_on_disk_bytes / (1024 * 1024 * 1024);
    }

    const isGrouped = isGroupedTextModel(model);

    return {
      model,
      auditInfo: null,
      // Core metrics
      name: model.name,
      workerCount: model.workerCount ?? 0,
      usagePercentage: categoryTotal > 0 ? (monthUsage / categoryTotal) * 100 : 0,
      usageTrend: {
        dayToMonthRatio: stats && stats.month > 0 ? stats.day / stats.month : null,
        monthToTotalRatio: stats && stats.total > 0 ? stats.month / stats.total : null,
      },
      // New fields (unavailable in degraded mode)
      usageHour: stats?.hour ?? 0,
      usageMinute: stats?.minute ?? 0,
      costBenefitScore: null,
      nsfw: isLegacyStableDiffusionRecord(legacyModel) ? (legacyModel.nsfw ?? null) : null,
      hasDescription: !!('description' in legacyModel && legacyModel.description),
      downloadCount: 0, // Not available from reference data
      // Risk flags
      flags: null, // No flags in degraded mode
      isCritical: false,
      hasWarning: false,
      flagCount: 0,
      fileHosts,
      baseline,
      sizeGB,
      // Grouping support
      isGrouped,
      variations: isGrouped ? (model as GroupedTextModel).variations : undefined,
      variationCount: isGrouped ? (model as GroupedTextModel).variations.length : 0,
    };
  }

  readonly availableHosts = computed(() => {
    const hostsSet = new Set<string>();
    this.modelsWithAuditMetrics().forEach((item) => {
      item.fileHosts.forEach((host) => hostsSet.add(host));
    });
    return Array.from(hostsSet).sort();
  });

  readonly availableBaselines = computed(() => {
    const baselinesSet = new Set<string>();
    this.modelsWithAuditMetrics().forEach((item) => {
      if (item.baseline) {
        baselinesSet.add(item.baseline);
      }
    });
    return Array.from(baselinesSet).sort();
  });

  readonly filteredModels = computed(() => {
    // Apply client-side filters on top of server-side preset filters
    const search = this.debouncedSearchTerm().toLowerCase();
    const selectedTags = this.selectedTags();
    const selectedParameterTags = this.selectedParameterTags();
    const activeFilter = this.filterByActive();
    let filtered = this.modelsWithAuditMetrics();

    if (activeFilter) {
      filtered = filtered.filter((item) => item.workerCount > 0);
    }

    if (selectedTags.length > 0) {
      filtered = filtered.filter((item) => {
        const legacyModel = item.model as LegacyRecordUnion;
        if (isLegacyStableDiffusionRecord(legacyModel) && legacyModel.tags) {
          return legacyModel.tags.some((tag) => selectedTags.includes(tag));
        } else if (isLegacyTextGenerationRecord(legacyModel) && legacyModel.tags) {
          return legacyModel.tags.some((tag) => selectedTags.includes(tag));
        }
        return false;
      });
    }

    if (selectedParameterTags.length > 0) {
      filtered = filtered.filter((item) => {
        const legacyModel = item.model as LegacyRecordUnion;
        if (isLegacyTextGenerationRecord(legacyModel) && legacyModel.tags) {
          return legacyModel.tags.some((tag) => selectedParameterTags.includes(tag));
        }
        return false;
      });
    }

    if (search) {
      filtered = filtered.filter((item) => {
        const legacyModel = item.model as LegacyRecordUnion;

        // Check base name
        if (item.model.name.toLowerCase().includes(search)) {
          return true;
        }

        // Check description
        if (legacyModel.description && legacyModel.description.toLowerCase().includes(search)) {
          return true;
        }

        // Check baseline
        if (
          isLegacyStableDiffusionRecord(legacyModel) &&
          legacyModel.baseline?.toLowerCase().includes(search)
        ) {
          return true;
        }

        // Check tags
        if (
          isLegacyStableDiffusionRecord(legacyModel) &&
          legacyModel.tags?.some((tag) => tag.toLowerCase().includes(search))
        ) {
          return true;
        }

        // For grouped text models, also check variations and backends
        if (isGroupedTextModel(item.model)) {
          const groupedModel = item.model as GroupedTextModel;
          // Check if search matches any backend name
          if (
            groupedModel.availableBackends.some((backend) => backend.toLowerCase().includes(search))
          ) {
            return true;
          }

          // Check if search matches any variation name
          if (
            groupedModel.variations.some((variation) =>
              variation.name.toLowerCase().includes(search),
            )
          ) {
            return true;
          }

          // Check if search matches any author
          if (
            groupedModel.availableAuthors.some((author) => author.toLowerCase().includes(search))
          ) {
            return true;
          }
        }

        return false;
      });
    }

    return filtered;
  });

  readonly sortedFilteredModels = computed(() => {
    const models = [...this.filteredModels()];
    const column = this.sortColumn();
    const direction = this.sortDirection();

    if (!column || !direction) {
      return models;
    }

    models.sort((a, b) => {
      let aVal: number | string | null;
      let bVal: number | string | null;

      switch (column) {
        case 'name':
          aVal = a.name;
          bVal = b.name;
          break;
        case 'baseline':
          aVal = a.baseline ?? '';
          bVal = b.baseline ?? '';
          break;
        case 'workers':
          aVal = a.workerCount;
          bVal = b.workerCount;
          break;
        case 'usageDay':
          aVal = this.getUsageDay(a);
          bVal = this.getUsageDay(b);
          break;
        case 'usageMonth':
          aVal = this.getUsageMonth(a);
          bVal = this.getUsageMonth(b);
          break;
        case 'usageTotal':
          aVal = this.getUsageTotal(a);
          bVal = this.getUsageTotal(b);
          break;
        case 'usagePercentage':
          aVal = a.usagePercentage;
          bVal = b.usagePercentage;
          break;
        case 'sizeGB':
          aVal = a.sizeGB ?? 0;
          bVal = b.sizeGB ?? 0;
          break;
        case 'flags':
          aVal = a.flagCount;
          bVal = b.flagCount;
          break;
        default:
          return 0;
      }

      if (aVal === null) aVal = '';
      if (bVal === null) bVal = '';

      if (aVal < bVal) return direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    return models;
  });

  // Summary statistics
  readonly totalModels = computed(() => this.models().length);
  readonly filteredCount = computed(() => this.filteredModels().length);

  readonly modelsWithWorkers = computed(() => {
    return this.modelsWithAuditMetrics().filter((m) => m.workerCount > 0).length;
  });

  readonly modelsWithZeroMonthUsage = computed(() => {
    return this.modelsWithAuditMetrics().filter((item) => {
      return this.getUsageMonth(item) === 0;
    }).length;
  });

  readonly averageUsagePercentage = computed(() => {
    const metrics = this.modelsWithAuditMetrics();
    if (metrics.length === 0) return 0;
    const sum = metrics.reduce((acc, item) => acc + item.usagePercentage, 0);
    return sum / metrics.length;
  });

  readonly totalDiskSpace = computed(() => {
    if (!this.isImageGeneration()) return null;
    let total = 0;
    this.models().forEach((model) => {
      const legacyModel = model as LegacyRecordUnion;
      if (isLegacyStableDiffusionRecord(legacyModel) && legacyModel.size_on_disk_bytes) {
        total += legacyModel.size_on_disk_bytes;
      }
    });
    return total / (1024 * 1024 * 1024); // Convert to GB
  });

  readonly flaggedDiskSpace = computed(() => {
    if (!this.isImageGeneration()) return null;
    let total = 0;
    this.modelsWithAuditMetrics().forEach((item) => {
      if (item.isCritical || item.hasWarning) {
        const legacyModel = item.model as LegacyRecordUnion;
        if (isLegacyStableDiffusionRecord(legacyModel) && legacyModel.size_on_disk_bytes) {
          total += legacyModel.size_on_disk_bytes;
        }
      }
    });
    return total / (1024 * 1024 * 1024); // Convert to GB
  });

  readonly criticalCount = computed(() => {
    return this.modelsWithAuditMetrics().filter((item) => item.isCritical).length;
  });

  readonly warningCount = computed(() => {
    return this.modelsWithAuditMetrics().filter((item) => item.hasWarning).length;
  });

  readonly selectedCount = computed(() => this.selectedModels().size);

  readonly selectedCriticalCount = computed(() => {
    const selected = this.selectedModels();
    return this.modelsWithAuditMetrics().filter(
      (item) => selected.has(item.model.name) && item.isCritical,
    ).length;
  });

  readonly selectedWarningCount = computed(() => {
    const selected = this.selectedModels();
    return this.modelsWithAuditMetrics().filter(
      (item) => selected.has(item.model.name) && item.hasWarning,
    ).length;
  });

  ngOnInit(): void {
    // Setup debounced search
    this.searchTermSubject
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((term) => {
        this.debouncedSearchTerm.set(term);
      });

    // Handle window resize with debouncing
    if (typeof window !== 'undefined') {
      fromEvent(window, 'resize')
        .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
        .subscribe(() => {
          this.windowHeight.set(window.innerHeight);
        });
    }

    const category$ = this.route.params.pipe(
      map((params) => params['category'] as string | undefined),
      filter((category): category is string => !!category),
      distinctUntilChanged(),
      tap((category) => {
        this.category.set(category);
        this.loading.set(true);
        this.auditResponse.set(null);
        this.degradedMode.set(false);
        this.models.set([]);
        this.selectedModels.set(new Set());
        this.expandedRows.set(new Set());
        this.selectedTags.set([]);
        this.selectedParameterTags.set([]);
        if (this.selectedPresetName() !== 'Show All') {
          this.selectedPresetName.set('Show All');
        }
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

    category$
      .pipe(
        switchMap((category) => this.fetchModelsForCategory$(category)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();

    const preset$ = toObservable(this.selectedPresetName, { injector: this.injector });
    const auditTrigger$ = this.auditRefreshTrigger.asObservable().pipe(startWith(void 0));

    combineLatest([category$, preset$, auditTrigger$])
      .pipe(
        tap(() => {
          this.auditLoading.set(true);
          this.degradedMode.set(false);
        }),
        switchMap(([category, presetName]) => this.fetchAuditForCategory$(category, presetName)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((audit) => {
        const wasDegraded = this.degradedMode();

        if (audit) {
          this.auditResponse.set(audit);
          this.degradedMode.set(false);
          this.lastRefreshTime.set(Date.now());
          if (!this.initialSortSet) {
            this.sortColumn.set('usagePercentage');
            this.initialSortSet = true;
          }
        } else {
          this.auditResponse.set(null);
          if (!wasDegraded) {
            this.notification.warning(
              'Audit analysis unavailable. Showing basic model data without risk assessment.',
            );
          }
          this.degradedMode.set(true);
        }

        this.auditLoading.set(false);
      });
  }

  private fetchModelsForCategory$(category: string): Observable<void> {
    const isTextGen = category === 'text_generation';

    return this.api.getLegacyModelsAsArray(category).pipe(
      map((referenceModels) => {
        const canonical: UnifiedModelData[] = isTextGen
          ? mergeMultipleModels(referenceModels, undefined, undefined, {
              parseTextModelNames: true,
            })
          : (referenceModels.map((model) => ({ ...model })) as UnifiedModelData[]);

        const displayModels: (UnifiedModelData | GroupedTextModel)[] = isTextGen
          ? createGroupedTextModels(canonical)
          : canonical;

        return displayModels;
      }),
      tap((displayModels) => {
        this.models.set(displayModels);
        this.loading.set(false);
      }),
      map(() => undefined),
      catchError((error: Error) => {
        this.notification.error(error.message);
        this.loading.set(false);
        return EMPTY;
      }),
    );
  }

  private fetchAuditForCategory$(
    category: string,
    presetName: string,
  ): Observable<CategoryAuditResponse | null> {
    const groupModels = category === 'text_generation';
    const preset = PRESET_NAME_TO_BACKEND[presetName];

    return this.api
      .getCategoryAudit(category, groupModels, preset)
      .pipe(catchError(() => of(null)));
  }

  /**
   * Refresh audit data (manual refresh button)
   */
  refreshAuditData(): void {
    if (this.auditLoading()) {
      return; // Already loading
    }

    this.auditRefreshTrigger.next();
  }

  /**
   * Get backend preset parameter based on selected preset name
   */
  private getBackendPresetForSelected(): string | undefined {
    const presetName = this.selectedPresetName();
    return PRESET_NAME_TO_BACKEND[presetName];
  }

  // Sorting
  toggleSort(column: SortColumn): void {
    const currentColumn = this.sortColumn();
    const currentDirection = this.sortDirection();

    if (currentColumn !== column) {
      this.sortColumn.set(column);
      this.sortDirection.set('asc');
    } else if (currentDirection === 'asc') {
      this.sortDirection.set('desc');
    } else if (currentDirection === 'desc') {
      this.sortColumn.set(null);
      this.sortDirection.set(null);
    } else {
      this.sortDirection.set('asc');
    }
  }

  getSortIcon(column: SortColumn): string {
    if (this.sortColumn() !== column) return '↕';
    return this.sortDirection() === 'asc' ? '↑' : '↓';
  }

  // Selection
  toggleModelSelection(modelName: string): void {
    const selected = new Set(this.selectedModels());
    if (selected.has(modelName)) {
      selected.delete(modelName);
    } else {
      selected.add(modelName);
    }
    this.selectedModels.set(selected);
  }

  isModelSelected(modelName: string): boolean {
    return this.selectedModels().has(modelName);
  }

  selectAll(): void {
    const names = new Set(this.sortedFilteredModels().map((item) => item.model.name));
    this.selectedModels.set(names);
  }

  selectNone(): void {
    this.selectedModels.set(new Set());
  }

  selectFlagged(): void {
    const names = new Set(
      this.sortedFilteredModels()
        .filter((item) => item.isCritical || item.hasWarning)
        .map((item) => item.model.name),
    );
    this.selectedModels.set(names);
  }

  // Row expansion for grouped models
  toggleRowExpansion(modelName: string): void {
    const expanded = new Set(this.expandedRows());
    if (expanded.has(modelName)) {
      expanded.delete(modelName);
    } else {
      expanded.add(modelName);
    }
    this.expandedRows.set(expanded);
  }

  isRowExpanded(modelName: string): boolean {
    return this.expandedRows().has(modelName);
  }

  // Preset selection (filters are now server-side)
  /**
   * Apply a preset filter configuration
   */
  applyPreset(presetName: string): void {
    const presets = this.availablePresets();
    const preset = presets.find((p) => p.name === presetName);

    if (!preset) {
      return;
    }

    // Store selected preset name
    this.selectedPresetName.set(presetName);
  }

  // Utility methods
  getBaselineDisplayName(baseline: string | null): string {
    if (!baseline) return '-';
    return BASELINE_SHORTHAND_MAP[baseline] || baseline;
  }

  getFileHostBadgeClass(host: string): string {
    return getFileHostBadgeClass(host);
  }

  formatFileHosts(hosts: string[]): string {
    return formatFileHosts(hosts);
  }

  getUsageDay(item: ModelWithAuditMetrics): number {
    if (item.auditInfo) {
      return item.auditInfo.usage_day ?? 0;
    }
    const stats = item.model.usageStats as HordeModelUsageStats | undefined;
    return stats?.day ?? 0;
  }

  getUsageMonth(item: ModelWithAuditMetrics): number {
    if (item.auditInfo) {
      return item.auditInfo.usage_month ?? 0;
    }
    const stats = item.model.usageStats as HordeModelUsageStats | undefined;
    return stats?.month ?? 0;
  }

  getUsageTotal(item: ModelWithAuditMetrics): number {
    if (item.auditInfo) {
      return item.auditInfo.usage_total ?? 0;
    }
    const stats = item.model.usageStats as HordeModelUsageStats | undefined;
    return stats?.total ?? 0;
  }

  getRowClass(item: ModelWithAuditMetrics): string {
    if (this.degradedMode()) {
      return ''; // No visual indicators in degraded mode
    }
    if (item.isCritical) return 'border-l-4 border-danger-500';
    if (item.hasWarning) return 'border-l-4 border-warning-500';
    return '';
  }

  // Navigation
  editModel(modelName: string): void {
    this.router.navigate(['/categories', this.category(), 'edit', modelName]);
  }

  viewModelList(): void {
    this.router.navigate(['/categories', this.category()]);
  }

  // Export
  exportToCSV(): void {
    const models = this.sortedFilteredModels();
    const rows: string[] = [
      'Name,Baseline,Workers,Usage Day,Usage Month,Usage Total,Usage %,Cost-Benefit,File Hosts,Flags,Size GB,Notes',
    ];

    models.forEach((item) => {
      const flags: string[] = [];

      // Handle both backend flags (snake_case) and degraded mode (null)
      if (item.flags) {
        if (item.flags.zero_usage_month) flags.push('ZeroMonth');
        if (item.flags.no_active_workers) flags.push('NoWorkers');
        if (item.flags.has_multiple_hosts) flags.push('MultiHost');
        if (item.flags.has_non_preferred_host) flags.push('NonPreferred');
        if (item.flags.has_unknown_host) flags.push('UnknownHost');
        if (item.flags.no_download_urls) flags.push('NoDownloads');
      }

      const row = [
        this.escapeCSV(item.name),
        this.escapeCSV(item.baseline ?? ''),
        item.workerCount,
        this.getUsageDay(item),
        this.getUsageMonth(item),
        this.getUsageTotal(item),
        item.usagePercentage.toFixed(2),
        item.costBenefitScore?.toFixed(2) ?? '',
        this.escapeCSV(item.fileHosts.join('; ')),
        this.escapeCSV(flags.join('; ')),
        item.sizeGB?.toFixed(2) ?? '',
        '', // Notes column (empty for now)
      ].join(',');

      rows.push(row);
    });

    const csv = rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `model-audit-${this.category()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    this.notification.success('CSV exported successfully');
  }

  private escapeCSV(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  // Tag filter methods
  toggleTag(tag: string): void {
    const current = this.selectedTags();
    if (current.includes(tag)) {
      this.selectedTags.set(current.filter((t) => t !== tag));
    } else {
      this.selectedTags.set([...current, tag]);
    }
  }

  isTagSelected(tag: string): boolean {
    return this.selectedTags().includes(tag);
  }

  clearAllTags(): void {
    this.selectedTags.set([]);
  }

  toggleParameterTag(tag: string): void {
    const current = this.selectedParameterTags();
    if (current.includes(tag)) {
      this.selectedParameterTags.set(current.filter((t) => t !== tag));
    } else {
      this.selectedParameterTags.set([...current, tag]);
    }
  }

  isParameterTagSelected(tag: string): boolean {
    return this.selectedParameterTags().includes(tag);
  }

  clearAllParameterTags(): void {
    this.selectedParameterTags.set([]);
  }

  toggleTagFilterDropdown(): void {
    this.tagFilterOpen.set(!this.tagFilterOpen());
  }

  closeTagFilterDropdown(): void {
    this.tagFilterOpen.set(false);
    this.tagSearchTerm.set('');
  }

  toggleParameterTagFilterDropdown(): void {
    this.parameterTagFilterOpen.set(!this.parameterTagFilterOpen());
  }

  closeParameterTagFilterDropdown(): void {
    this.parameterTagFilterOpen.set(false);
    this.parameterTagSearchTerm.set('');
  }
}
