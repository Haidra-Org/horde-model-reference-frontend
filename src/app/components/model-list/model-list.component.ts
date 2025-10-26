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
import { HordeApiService } from '../../services/horde-api.service';
import {
  LegacyRecordUnion,
  isLegacyStableDiffusionRecord,
  isLegacyTextGenerationRecord,
  isLegacyClipRecord,
} from '../../models';
import {
  UnifiedModelData,
  mergeMultipleModels,
  createGroupedTextModels,
  GroupedTextModel,
  hasActiveWorkers,
} from '../../models/unified-model';
import { HordeModelType } from '../../models/horde-api.models';
import {
  BASELINE_SHORTHAND_MAP,
  BASELINE_DISPLAY_MAP,
  RECORD_DISPLAY_MAP,
  CATEGORY_STATS_CONFIG,
} from '../../models/maps';
import { ModelRowComponent } from './model-row.component';
import {
  getParameterHeatmapClass,
  formatParametersInBillions,
} from '../../utils/parameter-heatmap.utils';
import {
  StatModalComponent,
  CountValuePair,
  CountValueDescriptionTriple,
  CountValueDetailTriple,
} from './stat-modal.component';

@Component({
  selector: 'app-model-list',
  imports: [FormsModule, RouterLink, ModelRowComponent, StatModalComponent],
  templateUrl: './model-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModelListComponent implements OnInit {
  readonly recordDisplayMap = RECORD_DISPLAY_MAP;
  private readonly api = inject(ModelReferenceApiService);
  private readonly notification = inject(NotificationService);
  private readonly auth = inject(AuthService);
  private readonly hordeApi = inject(HordeApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly category = signal<string>('');
  readonly models = signal<(UnifiedModelData | GroupedTextModel)[]>([]);
  readonly loading = signal(true);
  readonly searchTerm = signal('');
  readonly filterByActive = signal(false);
  readonly selectedTags = signal<string[]>([]);
  readonly tagSearchTerm = signal('');
  readonly tagFilterOpen = signal(false);
  readonly selectedParameterTags = signal<string[]>([]);
  readonly parameterTagSearchTerm = signal('');
  readonly parameterTagFilterOpen = signal(false);
  readonly showDetails = signal(false);
  readonly expandedModels = signal<Set<string>>(new Set());
  readonly expandedShowcases = signal<Set<string>>(new Set());
  readonly modelToDelete = signal<string | null>(null);
  readonly deleteConfirmationInput = signal('');
  readonly modelJsonToShow = signal<LegacyRecordUnion | null>(null);
  readonly statDetailsToShow = signal<{ title: string; content: string } | null>(null);
  readonly showParametersModal = signal(false);
  readonly showBaselineModal = signal(false);
  readonly showStyleModal = signal(false);
  readonly showNsfwModal = signal(false);
  readonly showTagsModal = signal(false);
  readonly headerCollapsed = signal(false);

  readonly writable = computed(
    () => this.api.backendCapabilities().writable && this.auth.isAuthenticated(),
  );
  readonly deleteAllowed = computed(
    () => this.deleteConfirmationInput().trim() === this.modelToDelete(),
  );

  readonly isImageGeneration = computed(() => this.category() === 'image_generation');
  readonly isTextGeneration = computed(() => this.category() === 'text_generation');
  readonly isClip = computed(() => this.category() === 'clip');

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

  readonly filteredModels = computed(() => {
    const search = this.searchTerm().toLowerCase();
    const selectedTags = this.selectedTags();
    const selectedParameterTags = this.selectedParameterTags();
    const activeFilter = this.filterByActive();
    let filtered = this.models();

    if (activeFilter) {
      filtered = filtered.filter((model) => hasActiveWorkers(model));
    }

    if (selectedTags.length > 0) {
      filtered = filtered.filter((model) => {
        const legacyModel = model as LegacyRecordUnion;
        if (isLegacyStableDiffusionRecord(legacyModel) && legacyModel.tags) {
          return legacyModel.tags.some((tag) => selectedTags.includes(tag));
        } else if (isLegacyTextGenerationRecord(legacyModel) && legacyModel.tags) {
          return legacyModel.tags.some((tag) => selectedTags.includes(tag));
        }
        return false;
      });
    }

    if (selectedParameterTags.length > 0) {
      filtered = filtered.filter((model) => {
        const legacyModel = model as LegacyRecordUnion;
        if (isLegacyTextGenerationRecord(legacyModel) && legacyModel.tags) {
          return legacyModel.tags.some((tag) => selectedParameterTags.includes(tag));
        }
        return false;
      });
    }

    if (search) {
      filtered = filtered.filter((model) => {
        const legacyModel = model as LegacyRecordUnion;
        return (
          model.name.toLowerCase().includes(search) ||
          (legacyModel.description && legacyModel.description.toLowerCase().includes(search)) ||
          (isLegacyStableDiffusionRecord(legacyModel) &&
            legacyModel.baseline?.toLowerCase().includes(search)) ||
          (isLegacyStableDiffusionRecord(legacyModel) &&
            legacyModel.tags?.some((tag) => tag.toLowerCase().includes(search)))
        );
      });
    }

    return filtered;
  });

  readonly totalModels = computed(() => this.models().length);

  readonly baselineStats = computed(() => {
    const baselineCounts = new Map<string, number>();
    this.filteredModels().forEach((model) => {
      const legacyModel = model as LegacyRecordUnion;
      let baseline: string | undefined;
      if (isLegacyStableDiffusionRecord(legacyModel)) {
        baseline = legacyModel.baseline;
      } else if (isLegacyTextGenerationRecord(legacyModel)) {
        baseline = legacyModel.baseline ?? undefined;
      }
      if (baseline) {
        baselineCounts.set(baseline, (baselineCounts.get(baseline) ?? 0) + 1);
      }
    });
    return Array.from(baselineCounts.entries())
      .map(([baseline, count]) => ({ baseline, count }))
      .sort((a, b) => b.count - a.count);
  });

  readonly tagStats = computed(() => {
    const uniqueTags = new Set<string>();
    this.filteredModels().forEach((model) => {
      const legacyModel = model as LegacyRecordUnion;
      if (isLegacyStableDiffusionRecord(legacyModel) && legacyModel.tags) {
        legacyModel.tags.forEach((tag) => uniqueTags.add(tag));
      } else if (isLegacyTextGenerationRecord(legacyModel) && legacyModel.tags) {
        legacyModel.tags.forEach((tag) => uniqueTags.add(tag));
      }
    });
    return uniqueTags.size;
  });

  readonly nsfwStats = computed(() => {
    let nsfw = 0;
    let sfw = 0;
    let unknown = 0;
    this.filteredModels().forEach((model) => {
      const legacyModel = model as LegacyRecordUnion;
      if (legacyModel.nsfw === true) {
        nsfw++;
      } else if (legacyModel.nsfw === false) {
        sfw++;
      } else {
        unknown++;
      }
    });
    return { nsfw, sfw, unknown };
  });

  readonly sizeStats = computed(() => {
    let totalBytes = 0;
    this.filteredModels().forEach((model) => {
      if (isLegacyStableDiffusionRecord(model) && model.size_on_disk_bytes) {
        totalBytes += model.size_on_disk_bytes;
      }
    });
    return totalBytes;
  });

  readonly parameterBucketStats = computed(() => {
    const parameterCounts = new Map<number, number>();
    this.filteredModels().forEach((model) => {
      const legacyModel = model as LegacyRecordUnion;
      if (isLegacyTextGenerationRecord(legacyModel) && legacyModel.parameters) {
        parameterCounts.set(
          legacyModel.parameters,
          (parameterCounts.get(legacyModel.parameters) ?? 0) + 1,
        );
      }
    });

    const sorted = Array.from(parameterCounts.entries())
      .map(([params, count]) => ({ params, count }))
      .sort((a, b) => b.count - a.count);

    const topBuckets = sorted.slice(0, 100);
    const otherCount = sorted.slice(100).reduce((sum, bucket) => sum + bucket.count, 0);

    return { topBuckets, otherCount };
  });

  readonly requirementsStats = computed(() => {
    let modelsWithRequirements = 0;
    this.filteredModels().forEach((model) => {
      if (
        isLegacyStableDiffusionRecord(model) &&
        model.requirements &&
        Object.keys(model.requirements).length > 0
      ) {
        modelsWithRequirements++;
      }
    });
    return modelsWithRequirements;
  });

  readonly styleStats = computed(() => {
    const styleCounts = new Map<string, number>();
    this.filteredModels().forEach((model) => {
      const legacyModel = model as LegacyRecordUnion;
      if (legacyModel.style) {
        styleCounts.set(legacyModel.style, (styleCounts.get(legacyModel.style) ?? 0) + 1);
      }
    });
    return Array.from(styleCounts.entries())
      .map(([style, count]) => ({ style, count }))
      .sort((a, b) => b.count - a.count);
  });

  readonly categoryStatsConfig = computed(() => {
    return CATEGORY_STATS_CONFIG[this.category()] ?? ['nsfw'];
  });

  readonly hasParametersStats = computed(() => {
    const config = this.categoryStatsConfig();
    return config.includes('parameters') && this.parameterBucketStats().topBuckets.length > 0;
  });

  readonly baselineModalData = computed((): CountValueDescriptionTriple[] => {
    return this.baselineStats().map((stat) => ({
      count: stat.count,
      value: this.getBaselineDisplayName(stat.baseline),
      wrapperClass: 'badge badge-info',
      description: this.getBaselineTooltip(stat.baseline),
    }));
  });

  readonly styleModalData = computed((): CountValuePair[] => {
    return this.styleStats().map((stat) => ({
      count: stat.count,
      value: stat.style,
      wrapperClass: 'badge badge-info',
    }));
  });

  readonly nsfwModalData = computed((): CountValueDescriptionTriple[] => {
    const data: CountValueDescriptionTriple[] = [];
    const stats = this.nsfwStats();
    if (stats.nsfw > 0) {
      data.push({
        count: stats.nsfw,
        value: 'NSFW',
        wrapperClass: 'badge badge-warning',
        description: 'Not Safe For Work',
      });
    }
    if (stats.sfw > 0) {
      data.push({
        count: stats.sfw,
        value: 'SFW',
        wrapperClass: 'badge badge-success',
        description: 'Safe For Work',
      });
    }
    if (stats.unknown > 0) {
      data.push({
        count: stats.unknown,
        value: 'Unknown',
        wrapperClass: 'badge badge-secondary',
        description: 'Content rating not specified',
      });
    }
    return data;
  });

  readonly tagsModalData = computed((): CountValuePair[] => {
    const tagCounts = new Map<string, number>();
    const isTextGen = this.isTextGeneration();
    this.filteredModels().forEach((model) => {
      const legacyModel = model as LegacyRecordUnion;
      if (isLegacyStableDiffusionRecord(legacyModel) && legacyModel.tags) {
        legacyModel.tags.forEach((tag) => tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1));
      } else if (isLegacyTextGenerationRecord(legacyModel) && legacyModel.tags) {
        legacyModel.tags.forEach((tag) => {
          // For text generation, exclude parameter count tags
          if (!isTextGen || !this.isParameterTag(tag)) {
            tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
          }
        });
      }
    });
    return Array.from(tagCounts.entries())
      .map(([tag, count]) => ({
        count,
        value: tag,
        wrapperClass: 'badge badge-primary',
      }))
      .sort((a, b) => b.count - a.count);
  });

  readonly parametersModalData = computed((): CountValueDetailTriple[] => {
    const { topBuckets, otherCount } = this.parameterBucketStats();
    const data: CountValueDetailTriple[] = topBuckets.map((bucket) => ({
      count: bucket.count,
      value: this.formatParametersInBillions(bucket.params),
      wrapperClass: `pc-badge ${this.getParameterHeatmapClass(bucket.params)}`,
      detail: bucket.params.toLocaleString(),
    }));
    if (otherCount > 0) {
      data.push({
        count: otherCount,
        value: 'Other parameter counts',
        detail: '',
        isOtherRow: true,
      });
    }
    return data;
  });

  readonly allTags = computed(() => {
    const tags = new Set<string>();
    this.filteredModels().forEach((model) => {
      const legacyModel = model as LegacyRecordUnion;
      if (isLegacyStableDiffusionRecord(legacyModel) && legacyModel.tags) {
        legacyModel.tags.forEach((tag) => tags.add(tag));
      } else if (isLegacyTextGenerationRecord(legacyModel) && legacyModel.tags) {
        legacyModel.tags.forEach((tag) => tags.add(tag));
      }
    });
    return Array.from(tags).sort();
  });

  readonly isStableDiffusionRecord = isLegacyStableDiffusionRecord;
  readonly isTextGenerationRecord = isLegacyTextGenerationRecord;
  readonly isClipRecord = isLegacyClipRecord;
  readonly baselineDisplayMap = BASELINE_SHORTHAND_MAP;

  getDownloadCount(model: LegacyRecordUnion): number {
    return model.config?.download?.length ?? 0;
  }

  getObjectKeysLength(obj: Record<string, unknown> | null | undefined): number {
    return obj ? Object.keys(obj).length : 0;
  }

  formatSizeInGB(bytes: number): string {
    return (bytes / 1024 / 1024 / 1024).toFixed(1);
  }

  formatParametersInBillions(params: number): string {
    return formatParametersInBillions(params);
  }

  getParameterHeatmapClass(params: number): string {
    return getParameterHeatmapClass(params);
  }

  getBaselineDisplayName(baseline: string): string {
    return BASELINE_SHORTHAND_MAP[baseline] || baseline;
  }

  showBaselineDetails(): void {
    this.showBaselineModal.set(true);
  }

  showTagsDetails(): void {
    this.showTagsModal.set(true);
  }

  showNsfwDetails(): void {
    this.showNsfwModal.set(true);
  }

  showSizeDetails(): void {
    const totalBytes = this.sizeStats();
    const totalGB = this.formatSizeInGB(totalBytes);
    const modelCount = this.filteredModels().filter(
      (m) => isLegacyStableDiffusionRecord(m) && m.size_on_disk_bytes,
    ).length;
    this.statDetailsToShow.set({
      title: 'Total Disk Size',
      content: `${totalGB} GB total across ${modelCount} model${modelCount === 1 ? '' : 's'} (for models with size information)`,
    });
  }

  showParametersDetails(): void {
    this.showParametersModal.set(true);
  }

  showRequirementsDetails(): void {
    const modelsWithReqs = this.filteredModels().filter(
      (m) =>
        isLegacyStableDiffusionRecord(m) &&
        m.requirements &&
        Object.keys(m.requirements).length > 0,
    );

    const lines: string[] = [];
    modelsWithReqs.forEach((model) => {
      if (!isLegacyStableDiffusionRecord(model) || !model.requirements) return;

      lines.push(`${model.name}:`);
      lines.push(this.formatRequirements(model.requirements));
      lines.push(''); // Empty line between models
    });

    this.statDetailsToShow.set({
      title: `Requirements (${modelsWithReqs.length} model${modelsWithReqs.length === 1 ? '' : 's'})`,
      content: lines.join('\n').trim(),
    });
  }

  showStyleDetails(): void {
    this.showStyleModal.set(true);
  }

  formatRequirements(requirements: Record<string, unknown>): string {
    const lines: string[] = [];
    for (const [key, value] of Object.entries(requirements)) {
      if (Array.isArray(value)) {
        lines.push(`  ${key}: ${value.join(', ')}`);
      } else {
        lines.push(`  ${key}: ${value}`);
      }
    }
    return lines.join('\n');
  }

  closeStatDetails(): void {
    this.statDetailsToShow.set(null);
  }

  copyStatDetailsToClipboard(): void {
    const details = this.statDetailsToShow();
    if (!details) return;

    const text = `${details.title}\n${'='.repeat(details.title.length)}\n${details.content}`;
    navigator.clipboard.writeText(text).then(
      () => {
        this.notification.success('Details copied to clipboard');
      },
      () => {
        this.notification.error('Failed to copy to clipboard');
      },
    );
  }

  getBaselineTooltip(baseline: string): string {
    return BASELINE_DISPLAY_MAP[baseline] || baseline;
  }

  ngOnInit(): void {
    this.route.params.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const category = params['category'];
      if (category) {
        this.category.set(category);
        this.loadModels();
      }
    });
  }

  createModel(): void {
    this.router.navigate(['/categories', this.category(), 'create']);
  }

  editModel(modelName: string): void {
    this.router.navigate(['/categories', this.category(), 'edit', modelName]);
  }

  confirmDelete(modelName: string): void {
    this.modelToDelete.set(modelName);
  }

  cancelDelete(): void {
    this.modelToDelete.set(null);
    this.deleteConfirmationInput.set('');
  }

  showJson(model: LegacyRecordUnion): void {
    this.modelJsonToShow.set(model);
  }

  closeJsonModal(): void {
    this.modelJsonToShow.set(null);
  }

  getFormattedJson(model: LegacyRecordUnion): string {
    return JSON.stringify(model, null, 2);
  }

  copyJsonToClipboard(model: LegacyRecordUnion): void {
    const json = this.getFormattedJson(model);
    navigator.clipboard.writeText(json).then(
      () => {
        this.notification.success('JSON copied to clipboard');
      },
      () => {
        this.notification.error('Failed to copy JSON to clipboard');
      },
    );
  }

  deleteModel(modelName: string): void {
    if (!this.deleteAllowed()) {
      return;
    }

    this.api.deleteModel(this.category(), modelName).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.notification.success(`Model "${modelName}" deleted successfully`);
        this.modelToDelete.set(null);
        this.deleteConfirmationInput.set('');
        this.loadModels();
      },
      error: (error: Error) => {
        this.notification.error(error.message);
        this.modelToDelete.set(null);
        this.deleteConfirmationInput.set('');
      },
    });
  }

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

  toggleRowExpansion(modelName: string): void {
    const expanded = new Set(this.expandedModels());
    if (expanded.has(modelName)) {
      expanded.delete(modelName);
    } else {
      expanded.add(modelName);
    }
    this.expandedModels.set(expanded);
  }

  isRowExpanded(modelName: string): boolean {
    return this.expandedModels().has(modelName);
  }

  toggleShowcases(modelName: string): void {
    const expanded = new Set(this.expandedShowcases());
    if (expanded.has(modelName)) {
      expanded.delete(modelName);
    } else {
      expanded.add(modelName);
    }
    this.expandedShowcases.set(expanded);
  }

  areShowcasesExpanded(modelName: string): boolean {
    return this.expandedShowcases().has(modelName);
  }

  hasShowcases(model: LegacyRecordUnion): boolean {
    return isLegacyStableDiffusionRecord(model) && !!model.showcases && model.showcases.length > 0;
  }

  toggleShowDetails(): void {
    const newShowDetails = !this.showDetails();
    this.showDetails.set(newShowDetails);

    if (newShowDetails) {
      const allModelNames = new Set(this.filteredModels().map((m) => m.name));
      this.expandedModels.set(allModelNames);
    } else {
      this.expandedModels.set(new Set());
    }
  }

  toggleHeaderCollapsed(): void {
    this.headerCollapsed.set(!this.headerCollapsed());
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.src =
      'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%23999%27 stroke-width=%272%27%3E%3Crect x=%273%27 y=%273%27 width=%2718%27 height=%2718%27 rx=%272%27/%3E%3Ccircle cx=%278.5%27 cy=%278.5%27 r=%271.5%27/%3E%3Cpath d=%27M21 15l-5-5L5 21%27/%3E%3C/svg%3E';
  }

  private getCategoryHordeType(category: string): HordeModelType | null {
    if (category === 'image_generation') {
      return 'image';
    }
    if (category === 'text_generation') {
      return 'text';
    }
    return null;
  }

  private loadModels(): void {
    this.loading.set(true);
    const hordeType = this.getCategoryHordeType(this.category());
    const isTextGen = this.isTextGeneration();

    this.api.getLegacyModelsAsArray(this.category()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (referenceModels) => {
        // Parse text model names for text generation category
        const modelsWithParsing = isTextGen
          ? mergeMultipleModels(referenceModels, undefined, undefined, {
              parseTextModelNames: true,
            })
          : referenceModels.map((m) => ({ ...m }));

        // Group text models by base name
        const displayModels = isTextGen
          ? createGroupedTextModels(modelsWithParsing)
          : modelsWithParsing;

        // Immediately display reference models
        this.models.set(displayModels);
        this.loading.set(false);

        // Asynchronously fetch and merge Horde data if applicable
        if (hordeType) {
          this.hordeApi.getCombinedModelData(hordeType).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: ({ status, stats }) => {
              const unifiedModels = mergeMultipleModels(
                referenceModels,
                status,
                stats,
                isTextGen ? { parseTextModelNames: true } : undefined,
              );

              // Re-group text models with updated Horde data
              const groupedModels = isTextGen
                ? createGroupedTextModels(unifiedModels)
                : unifiedModels;

              this.models.set(groupedModels);
            },
            error: () => {
              // Keep displaying reference models even if Horde API fails
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
}
