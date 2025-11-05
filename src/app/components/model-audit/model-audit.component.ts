import {
  Component,
  inject,
  OnInit,
  signal,
  computed,
  ChangeDetectionStrategy,
  DestroyRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
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
} from '../../models/unified-model';
import { HordeModelUsageStats } from '../../models/horde-api.models';
import {
  ModelAuditInfo,
  DeletionRiskFlags,
  CategoryAuditResponse,
} from '../../api-client';
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
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

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

  // Filter controls - now handled server-side via presets
  readonly selectedPresetName = signal<string>('Show All');

  // Sorting
  readonly sortColumn = signal<SortColumn | null>(null);
  readonly sortDirection = signal<SortDirection>(null);

  // Selection
  readonly selectedModels = signal<Set<string>>(new Set());

  // Computed values
  readonly recordDisplayName = computed(() => {
    return RECORD_DISPLAY_MAP[this.category()] || this.category();
  });

  readonly isTextGeneration = computed(() => this.category() === 'text_generation');
  readonly isImageGeneration = computed(() => this.category() === 'image_generation');

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
      // Backend mode: map ModelAuditInfo to ModelWithAuditMetrics
      return auditResp.models.map((auditInfo) => {
        // Find corresponding model from reference data for extended properties
        const model = models.find((m) => m.name === auditInfo.name);
        if (!model) {
          // Shouldn't happen, but handle gracefully - create minimal model from auditInfo
          return this.createDegradedMetrics({ name: auditInfo.name } as UnifiedModelData, categoryTotal);
        }

        const fileHosts = auditInfo.download_hosts ?? [];
        const flags = auditInfo.deletion_risk_flags;

        return {
          model,
          auditInfo,
          // Core metrics from audit API
          name: auditInfo.name,
          workerCount: auditInfo.worker_count ?? 0,
          usagePercentage: auditInfo.usage_percentage_of_category ?? 0,
          usageTrend: {
            dayToMonthRatio: auditInfo.usage_trend?.day_to_month_ratio ?? null,
            monthToTotalRatio: auditInfo.usage_trend?.month_to_total_ratio ?? null,
          },
          // New fields from audit API
          usageHour: auditInfo.usage_hour ?? 0,
          usageMinute: auditInfo.usage_minute ?? 0,
          costBenefitScore: auditInfo.cost_benefit_score ?? null,
          nsfw: auditInfo.nsfw ?? null,
          hasDescription: auditInfo.has_description ?? false,
          downloadCount: auditInfo.download_count ?? 0,
          // Risk assessment
          flags: flags ?? null,
          isCritical: flags ? !!(flags.zero_usage_month && flags.no_active_workers) : false,
          hasWarning: flags ? !!(
            flags.has_multiple_hosts ||
            flags.has_non_preferred_host ||
            flags.no_download_urls ||
            flags.has_unknown_host
          ) : false,
          flagCount: auditInfo.risk_score ?? 0,
          fileHosts,
          baseline: auditInfo.baseline ?? null,
          sizeGB: auditInfo.size_gb ?? null,
        };
      });
    }

    // Degraded mode: create basic metrics from reference data only
    return models.map((model) => this.createDegradedMetrics(model, categoryTotal));
  });

  /**
   * Create metrics in degraded mode (when audit API fails)
   */
  private createDegradedMetrics(model: UnifiedModelData | GroupedTextModel, categoryTotal: number): ModelWithAuditMetrics {
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
    // Backend handles all filtering via preset parameter
    // This just passes through the audit metrics
    return this.modelsWithAuditMetrics();
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
    this.route.params.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const category = params['category'];
      if (category) {
        this.category.set(category);
        this.loadModels();
      }
    });
  }

  private loadModels(): void {
    this.loading.set(true);
    this.degradedMode.set(false);
    const isTextGen = this.isTextGeneration();
    const groupModels = isTextGen;

    // First, load reference models
    this.api
      .getLegacyModelsAsArray(this.category())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (referenceModels) => {
          const displayModels = isTextGen
            ? createGroupedTextModels(referenceModels.map((m) => ({ ...m })))
            : referenceModels.map((m) => ({ ...m }));

          this.models.set(displayModels);

          // Then, try to load audit data from backend
          this.loadAuditData(groupModels);
        },
        error: (error: Error) => {
          this.notification.error(error.message);
          this.loading.set(false);
        },
      });
  }

  /**
   * Load audit data from backend
   */
  private loadAuditData(groupModels: boolean): void {
    const preset = this.getBackendPresetForSelected();

    this.auditLoading.set(true);
    this.api
      .getCategoryAudit(this.category(), groupModels, preset)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (auditResponse) => {
          if (auditResponse) {
            this.auditResponse.set(auditResponse);
            this.degradedMode.set(false);
            this.lastRefreshTime.set(Date.now());
          } else {
            // Audit API failed - enter degraded mode
            this.degradedMode.set(true);
            this.notification.warning(
              'Audit analysis unavailable. Showing basic model data without risk assessment.',
            );
          }
          this.loading.set(false);
          this.auditLoading.set(false);
        },
        error: () => {
          // Audit API failed - enter degraded mode
          this.degradedMode.set(true);
          this.notification.warning(
            'Audit analysis unavailable. Showing basic model data without risk assessment.',
          );
          this.loading.set(false);
          this.auditLoading.set(false);
        },
      });
  }

  /**
   * Refresh audit data (manual refresh button)
   */
  refreshAuditData(): void {
    if (this.auditLoading()) {
      return; // Already loading
    }

    const isTextGen = this.isTextGeneration();
    const groupModels = isTextGen;
    this.loadAuditData(groupModels);
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

    // Reload audit data with backend preset
    const isTextGen = this.isTextGeneration();
    const groupModels = isTextGen;
    this.loadAuditData(groupModels);
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
}
