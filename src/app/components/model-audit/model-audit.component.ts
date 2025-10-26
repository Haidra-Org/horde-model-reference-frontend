import {
  Component,
  inject,
  OnInit,
  signal,
  computed,
  effect,
  ChangeDetectionStrategy,
  DestroyRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ModelReferenceApiService } from '../../services/model-reference-api.service';
import { NotificationService } from '../../services/notification.service';
import { HordeApiService } from '../../services/horde-api.service';
import {
  LegacyRecordUnion,
  isLegacyStableDiffusionRecord,
  isLegacyTextGenerationRecord,
} from '../../models';
import {
  UnifiedModelData,
  mergeMultipleModels,
  createGroupedTextModels,
  GroupedTextModel,
} from '../../models/unified-model';
import { HordeModelType, HordeModelUsageStats } from '../../models/horde-api.models';
import { BASELINE_SHORTHAND_MAP, RECORD_DISPLAY_MAP } from '../../models/maps';
import {
  getModelFileHosts,
  calculateUsagePercentage,
  calculateUsageTrend,
  getCostBenefitScore,
  getDeletionFlags,
  isCriticalModel,
  hasWarnings,
  countActiveFlags,
  formatFileHosts,
  getFileHostBadgeClass,
  AUDIT_DEFAULTS_BY_CATEGORY,
  AUDIT_FILTERS_BY_CATEGORY,
  AUDIT_FILTER_PRESETS,
  AuditFilterType,
  AuditPreset,
  DeletionFlags,
  UsageTrend,
} from '../../utils/audit-metrics.utils';

/**
 * Enriched model data with audit metrics
 */
interface ModelWithAuditMetrics {
  model: UnifiedModelData | GroupedTextModel;
  usagePercentage: number; // Percentage of category's 30-day usage
  usageTrend: UsageTrend;
  costBenefitScore: number | null;
  flags: DeletionFlags;
  isCritical: boolean;
  hasWarning: boolean;
  flagCount: number;
  fileHosts: string[];
  baseline: string | null;
  sizeGB: number | null;
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
  imports: [FormsModule, RouterLink],
  templateUrl: './model-audit.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModelAuditComponent implements OnInit {
  private readonly api = inject(ModelReferenceApiService);
  private readonly notification = inject(NotificationService);
  private readonly hordeApi = inject(HordeApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  // Expose constant for template
  readonly AUDIT_DEFAULTS_BY_CATEGORY = AUDIT_DEFAULTS_BY_CATEGORY;

  // Route and data
  readonly category = signal<string>('');
  readonly models = signal<(UnifiedModelData | GroupedTextModel)[]>([]);
  readonly loading = signal(true);

  // Filter controls - Range filters (min/max pairs)
  // null means no constraint (empty input)
  readonly minUsagePercentage = signal<number | null>(null);
  readonly maxUsagePercentage = signal<number | null>(null);
  readonly enableUsagePercentageFilter = signal(false);
  readonly minWorkerCount = signal<number | null>(null);
  readonly maxWorkerCount = signal<number | null>(null);
  readonly enableWorkerCountFilter = signal(false);
  readonly minMonthUsage = signal<number | null>(null);
  readonly maxMonthUsage = signal<number | null>(null);
  readonly enableMonthUsageFilter = signal(false);
  readonly minTotalUsage = signal<number | null>(null);
  readonly maxTotalUsage = signal<number | null>(null);
  readonly enableTotalUsageFilter = signal(false);
  readonly selectedHosts = signal<string[]>([]);
  readonly selectedBaselines = signal<string[]>([]);
  readonly showOnlyFlagged = signal(false);

  // Sorting
  readonly sortColumn = signal<SortColumn | null>(null);
  readonly sortDirection = signal<SortDirection>(null);

  // Selection
  readonly selectedModels = signal<Set<string>>(new Set());

  // UI state
  readonly showFilterPanel = signal(true);

  // Computed values
  readonly recordDisplayName = computed(() => {
    return RECORD_DISPLAY_MAP[this.category()] || this.category();
  });

  readonly isTextGeneration = computed(() => this.category() === 'text_generation');
  readonly isImageGeneration = computed(() => this.category() === 'image_generation');

  /**
   * Get available filters for the current category
   */
  readonly availableFilters = computed((): AuditFilterType[] => {
    return AUDIT_FILTERS_BY_CATEGORY[this.category()] ?? [];
  });

  /**
   * Get available presets for the current category
   */
  readonly availablePresets = computed((): AuditPreset[] => {
    return AUDIT_FILTER_PRESETS[this.category()] ?? [];
  });

  /**
   * Detect if any min/max filter pairs are in conflict (min > max when both are set)
   */
  readonly hasFilterConflicts = computed(() => {
    const conflicts: string[] = [];

    if (this.enableUsagePercentageFilter()) {
      const minUsagePct = this.minUsagePercentage();
      const maxUsagePct = this.maxUsagePercentage();
      if (minUsagePct !== null && maxUsagePct !== null && minUsagePct > maxUsagePct) {
        conflicts.push('Usage Percentage: min > max');
      }
    }

    if (this.enableWorkerCountFilter()) {
      const minWorkers = this.minWorkerCount();
      const maxWorkers = this.maxWorkerCount();
      if (minWorkers !== null && maxWorkers !== null && minWorkers > maxWorkers) {
        conflicts.push('Worker Count: min > max');
      }
    }

    if (this.enableMonthUsageFilter()) {
      const minMonth = this.minMonthUsage();
      const maxMonth = this.maxMonthUsage();
      if (minMonth !== null && maxMonth !== null && minMonth > maxMonth) {
        conflicts.push('Month Usage: min > max');
      }
    }

    if (this.enableTotalUsageFilter()) {
      const minTotal = this.minTotalUsage();
      const maxTotal = this.maxTotalUsage();
      if (minTotal !== null && maxTotal !== null && minTotal > maxTotal) {
        conflicts.push('Total Usage: min > max');
      }
    }

    return conflicts;
  });

  readonly hasConflicts = computed(() => this.hasFilterConflicts().length > 0);

  constructor() {
    // Reset filters when category changes
    effect(() => {
      const category = this.category();
      if (category) {
        this.resetFilters();
      }
    });
  }

  /** Total 30-day usage across all models in category */
  readonly categoryTotalUsage = computed(() => {
    const models = this.models();
    let total = 0;
    models.forEach((model) => {
      const stats = model.usageStats as HordeModelUsageStats | undefined;
      total += stats?.month ?? 0;
    });
    return total;
  });

  readonly modelsWithAuditMetrics = computed((): ModelWithAuditMetrics[] => {
    const models = this.models();
    const categoryTotal = this.categoryTotalUsage();

    return models.map((model) => {
      const legacyModel = model as LegacyRecordUnion;
      const stats = model.usageStats as HordeModelUsageStats | undefined;
      const monthUsage = stats?.month ?? 0;

      const fileHosts = getModelFileHosts(model);
      const flags = getDeletionFlags(model);

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

      return {
        model,
        usagePercentage: calculateUsagePercentage(monthUsage, categoryTotal),
        usageTrend: calculateUsageTrend(stats),
        costBenefitScore: getCostBenefitScore(model),
        flags,
        isCritical: isCriticalModel(flags),
        hasWarning: hasWarnings(flags),
        flagCount: countActiveFlags(flags),
        fileHosts,
        baseline,
        sizeGB,
      };
    });
  });

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
    let filtered = this.modelsWithAuditMetrics();
    const available = this.availableFilters();

    // Get filter values
    const minUsagePct = this.minUsagePercentage();
    const maxUsagePct = this.maxUsagePercentage();
    const minWorkers = this.minWorkerCount();
    const maxWorkers = this.maxWorkerCount();
    const minMonth = this.minMonthUsage();
    const maxMonth = this.maxMonthUsage();
    const minTotal = this.minTotalUsage();
    const maxTotal = this.maxTotalUsage();
    const hosts = this.selectedHosts();
    const baselines = this.selectedBaselines();
    const onlyFlagged = this.showOnlyFlagged();

    // Apply usage percentage filter (image generation)
    if (available.includes('usagePercentage') && this.enableUsagePercentageFilter()) {
      // Skip if conflicting values (min > max), otherwise apply filter
      const hasConflict = minUsagePct !== null && maxUsagePct !== null && minUsagePct > maxUsagePct;
      if (!hasConflict) {
        filtered = filtered.filter((item) => {
          const value = item.usagePercentage;
          return (
            (minUsagePct === null || value >= minUsagePct) &&
            (maxUsagePct === null || value <= maxUsagePct)
          );
        });
      }
    }

    // Apply worker count filter (image generation)
    if (available.includes('workerCount') && this.enableWorkerCountFilter()) {
      const hasConflict = minWorkers !== null && maxWorkers !== null && minWorkers > maxWorkers;
      if (!hasConflict) {
        filtered = filtered.filter((item) => {
          const value = item.model.workerCount ?? 0;
          return (
            (minWorkers === null || value >= minWorkers) &&
            (maxWorkers === null || value <= maxWorkers)
          );
        });
      }
    }

    // Apply month usage filter (image generation)
    if (available.includes('monthUsage') && this.enableMonthUsageFilter()) {
      const hasConflict = minMonth !== null && maxMonth !== null && minMonth > maxMonth;
      if (!hasConflict) {
        filtered = filtered.filter((item) => {
          const stats = item.model.usageStats as HordeModelUsageStats | undefined;
          const value = stats?.month ?? 0;
          return (
            (minMonth === null || value >= minMonth) && (maxMonth === null || value <= maxMonth)
          );
        });
      }
    }

    // Apply total usage filter (text generation)
    if (available.includes('totalUsage') && this.enableTotalUsageFilter()) {
      const hasConflict = minTotal !== null && maxTotal !== null && minTotal > maxTotal;
      if (!hasConflict) {
        filtered = filtered.filter((item) => {
          const stats = item.model.usageStats as HordeModelUsageStats | undefined;
          const value = stats?.total ?? 0;
          return (
            (minTotal === null || value >= minTotal) && (maxTotal === null || value <= maxTotal)
          );
        });
      }
    }

    // Apply hosts filter (if available)
    if (available.includes('hosts') && hosts.length > 0) {
      filtered = filtered.filter((item) => item.fileHosts.some((host) => hosts.includes(host)));
    }

    // Apply baselines filter (if available)
    if (available.includes('baselines') && baselines.length > 0) {
      filtered = filtered.filter((item) => item.baseline && baselines.includes(item.baseline));
    }

    // Apply flagged filter (if available)
    if (available.includes('flagged') && onlyFlagged) {
      filtered = filtered.filter((item) => item.isCritical || item.hasWarning);
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
          aVal = a.model.name;
          bVal = b.model.name;
          break;
        case 'baseline':
          aVal = a.baseline ?? '';
          bVal = b.baseline ?? '';
          break;
        case 'workers':
          aVal = a.model.workerCount ?? 0;
          bVal = b.model.workerCount ?? 0;
          break;
        case 'usageDay':
          aVal = (a.model.usageStats as HordeModelUsageStats | undefined)?.day ?? 0;
          bVal = (b.model.usageStats as HordeModelUsageStats | undefined)?.day ?? 0;
          break;
        case 'usageMonth':
          aVal = (a.model.usageStats as HordeModelUsageStats | undefined)?.month ?? 0;
          bVal = (b.model.usageStats as HordeModelUsageStats | undefined)?.month ?? 0;
          break;
        case 'usageTotal':
          aVal = (a.model.usageStats as HordeModelUsageStats | undefined)?.total ?? 0;
          bVal = (b.model.usageStats as HordeModelUsageStats | undefined)?.total ?? 0;
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
    return this.models().filter((m) => (m.workerCount ?? 0) > 0).length;
  });

  readonly modelsWithZeroMonthUsage = computed(() => {
    return this.models().filter((m) => {
      const stats = m.usageStats as HordeModelUsageStats | undefined;
      return (stats?.month ?? 0) === 0;
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
    this.route.params.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const category = params['category'];
      if (category) {
        this.category.set(category);
        this.loadModels();
      }
    });
  }

  private getCategoryHordeType(category: string): HordeModelType | null {
    if (category === 'image_generation') return 'image';
    if (category === 'text_generation') return 'text';
    return null;
  }

  private loadModels(): void {
    this.loading.set(true);
    const hordeType = this.getCategoryHordeType(this.category());
    const isTextGen = this.isTextGeneration();

    this.api.getLegacyModelsAsArray(this.category()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (referenceModels) => {
        const modelsWithParsing = isTextGen
          ? mergeMultipleModels(referenceModels, undefined, undefined, {
              parseTextModelNames: true,
            })
          : referenceModels.map((m) => ({ ...m }));

        const displayModels = isTextGen
          ? createGroupedTextModels(modelsWithParsing)
          : modelsWithParsing;

        this.models.set(displayModels);
        this.loading.set(false);

        if (hordeType) {
          this.hordeApi.getCombinedModelData(hordeType).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: ({ status, stats }) => {
              const unifiedModels = mergeMultipleModels(
                referenceModels,
                status,
                stats,
                isTextGen ? { parseTextModelNames: true } : undefined,
              );

              const groupedModels = isTextGen
                ? createGroupedTextModels(unifiedModels)
                : unifiedModels;

              this.models.set(groupedModels);
            },
            error: () => {
              // Keep displaying reference models if Horde API fails
            },
          });
        }
      },
      error: (error: Error) => {
        this.notification.error(error.message);
        this.loading.set(false);
      },
    });
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

  // Filters
  clearMinUsagePercentage(): void {
    this.minUsagePercentage.set(null);
  }

  clearMaxUsagePercentage(): void {
    this.maxUsagePercentage.set(null);
  }

  clearMinWorkerCount(): void {
    this.minWorkerCount.set(null);
  }

  clearMaxWorkerCount(): void {
    this.maxWorkerCount.set(null);
  }

  clearMinMonthUsage(): void {
    this.minMonthUsage.set(null);
  }

  clearMaxMonthUsage(): void {
    this.maxMonthUsage.set(null);
  }

  clearMinTotalUsage(): void {
    this.minTotalUsage.set(null);
  }

  clearMaxTotalUsage(): void {
    this.maxTotalUsage.set(null);
  }

  toggleHostFilter(host: string): void {
    const current = this.selectedHosts();
    if (current.includes(host)) {
      this.selectedHosts.set(current.filter((h) => h !== host));
    } else {
      this.selectedHosts.set([...current, host]);
    }
  }

  isHostSelected(host: string): boolean {
    return this.selectedHosts().includes(host);
  }

  toggleBaselineFilter(baseline: string): void {
    const current = this.selectedBaselines();
    if (current.includes(baseline)) {
      this.selectedBaselines.set(current.filter((b) => b !== baseline));
    } else {
      this.selectedBaselines.set([...current, baseline]);
    }
  }

  isBaselineSelected(baseline: string): boolean {
    return this.selectedBaselines().includes(baseline);
  }

  resetFilters(): void {
    this.minUsagePercentage.set(null);
    this.maxUsagePercentage.set(null);
    this.enableUsagePercentageFilter.set(false);
    this.minWorkerCount.set(null);
    this.maxWorkerCount.set(null);
    this.enableWorkerCountFilter.set(false);
    this.minMonthUsage.set(null);
    this.maxMonthUsage.set(null);
    this.enableMonthUsageFilter.set(false);
    this.minTotalUsage.set(null);
    this.maxTotalUsage.set(null);
    this.enableTotalUsageFilter.set(false);
    this.selectedHosts.set([]);
    this.selectedBaselines.set([]);
    this.showOnlyFlagged.set(false);
  }

  /**
   * Apply a preset filter configuration
   */
  applyPreset(presetName: string): void {
    const presets = this.availablePresets();
    const preset = presets.find((p) => p.name === presetName);

    if (!preset) {
      return;
    }

    // Reset all filters first
    this.resetFilters();

    // Apply preset values with validation
    const filters = preset.filters;

    // Validate and apply usage percentage
    if (filters.minUsagePercentage !== undefined || filters.maxUsagePercentage !== undefined) {
      const min = filters.minUsagePercentage ?? null;
      const max = filters.maxUsagePercentage ?? null;
      if (min === null || max === null || min <= max) {
        if (filters.minUsagePercentage !== undefined) {
          this.minUsagePercentage.set(filters.minUsagePercentage);
        }
        if (filters.maxUsagePercentage !== undefined) {
          this.maxUsagePercentage.set(filters.maxUsagePercentage);
        }
        this.enableUsagePercentageFilter.set(true);
      }
    }

    // Validate and apply worker count
    if (filters.minWorkerCount !== undefined || filters.maxWorkerCount !== undefined) {
      const min = filters.minWorkerCount ?? null;
      const max = filters.maxWorkerCount ?? null;
      if (min === null || max === null || min <= max) {
        if (filters.minWorkerCount !== undefined) {
          this.minWorkerCount.set(filters.minWorkerCount);
        }
        if (filters.maxWorkerCount !== undefined) {
          this.maxWorkerCount.set(filters.maxWorkerCount);
        }
        this.enableWorkerCountFilter.set(true);
      }
    }

    // Validate and apply month usage
    if (filters.minMonthUsage !== undefined || filters.maxMonthUsage !== undefined) {
      const min = filters.minMonthUsage ?? null;
      const max = filters.maxMonthUsage ?? null;
      if (min === null || max === null || min <= max) {
        if (filters.minMonthUsage !== undefined) {
          this.minMonthUsage.set(filters.minMonthUsage);
        }
        if (filters.maxMonthUsage !== undefined) {
          this.maxMonthUsage.set(filters.maxMonthUsage);
        }
        this.enableMonthUsageFilter.set(true);
      }
    }

    // Validate and apply total usage
    if (filters.minTotalUsage !== undefined || filters.maxTotalUsage !== undefined) {
      const min = filters.minTotalUsage ?? null;
      const max = filters.maxTotalUsage ?? null;
      if (min === null || max === null || min <= max) {
        if (filters.minTotalUsage !== undefined) {
          this.minTotalUsage.set(filters.minTotalUsage);
        }
        if (filters.maxTotalUsage !== undefined) {
          this.maxTotalUsage.set(filters.maxTotalUsage);
        }
        this.enableTotalUsageFilter.set(true);
      }
    }

    if (filters.showOnlyFlagged !== undefined) {
      this.showOnlyFlagged.set(filters.showOnlyFlagged);
    }
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
    const stats = item.model.usageStats as HordeModelUsageStats | undefined;
    return stats?.day ?? 0;
  }

  getUsageMonth(item: ModelWithAuditMetrics): number {
    const stats = item.model.usageStats as HordeModelUsageStats | undefined;
    return stats?.month ?? 0;
  }

  getUsageTotal(item: ModelWithAuditMetrics): number {
    const stats = item.model.usageStats as HordeModelUsageStats | undefined;
    return stats?.total ?? 0;
  }

  getRowClass(item: ModelWithAuditMetrics): string {
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
      'Name,Baseline,Workers,Usage Day,Usage Month,Usage Total,Usage %,File Hosts,Flags,Size GB,Notes',
    ];

    models.forEach((item) => {
      const stats = item.model.usageStats as HordeModelUsageStats | undefined;
      const flags: string[] = [];
      if (item.flags.zeroUsageMonth) flags.push('ZeroMonth');
      if (item.flags.noActiveWorkers) flags.push('NoWorkers');
      if (item.flags.hasMultipleHosts) flags.push('MultiHost');
      if (item.flags.hasNonPreferredHost) flags.push('NonPreferred');
      if (item.flags.hasUnknownHost) flags.push('UnknownHost');
      if (item.flags.noDownloadUrls) flags.push('NoDownloads');

      const row = [
        this.escapeCSV(item.model.name),
        this.escapeCSV(item.baseline ?? ''),
        item.model.workerCount ?? 0,
        stats?.day ?? 0,
        stats?.month ?? 0,
        stats?.total ?? 0,
        item.usagePercentage.toFixed(2),
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
}
