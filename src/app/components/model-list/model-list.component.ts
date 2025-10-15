import {
  Component,
  inject,
  OnInit,
  signal,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ModelReferenceApiService } from '../../services/model-reference-api.service';
import { NotificationService } from '../../services/notification.service';
import {
  LegacyRecordUnion,
  isLegacyStableDiffusionRecord,
  isLegacyTextGenerationRecord,
  isLegacyClipRecord,
} from '../../models';
import {
  BASELINE_SHORTHAND_MAP,
  BASELINE_DISPLAY_MAP,
  RECORD_DISPLAY_MAP,
  CATEGORY_STATS_CONFIG,
} from '../../models/maps';
import { ModelRowComponent } from './model-row.component';

@Component({
  selector: 'app-model-list',
  imports: [FormsModule, ModelRowComponent],
  templateUrl: './model-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModelListComponent implements OnInit {
  readonly recordDisplayMap = RECORD_DISPLAY_MAP;
  private readonly api = inject(ModelReferenceApiService);
  private readonly notification = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly category = signal<string>('');
  readonly models = signal<LegacyRecordUnion[]>([]);
  readonly loading = signal(true);
  readonly searchTerm = signal('');
  readonly selectedTags = signal<string[]>([]);
  readonly tagFilterOpen = signal(false);
  readonly showDetails = signal(false);
  readonly expandedModels = signal<Set<string>>(new Set());
  readonly expandedShowcases = signal<Set<string>>(new Set());
  readonly modelToDelete = signal<string | null>(null);
  readonly deleteConfirmationInput = signal('');
  readonly modelJsonToShow = signal<LegacyRecordUnion | null>(null);
  readonly statDetailsToShow = signal<{ title: string; content: string } | null>(null);

  readonly writable = computed(() => this.api.backendCapabilities().writable);
  readonly deleteAllowed = computed(
    () => this.deleteConfirmationInput().trim() === this.modelToDelete(),
  );

  readonly isImageGeneration = computed(() => this.category() === 'image_generation');
  readonly isTextGeneration = computed(() => this.category() === 'text_generation');
  readonly isClip = computed(() => this.category() === 'clip');

  readonly availableTags = computed(() => {
    const tagsSet = new Set<string>();
    this.models().forEach((model) => {
      if (isLegacyStableDiffusionRecord(model) && model.tags) {
        model.tags.forEach((tag) => tagsSet.add(tag));
      } else if (isLegacyTextGenerationRecord(model) && model.tags) {
        model.tags.forEach((tag) => tagsSet.add(tag));
      }
    });
    return Array.from(tagsSet).sort();
  });

  readonly filteredModels = computed(() => {
    const search = this.searchTerm().toLowerCase();
    const selectedTags = this.selectedTags();
    let filtered = this.models();

    if (selectedTags.length > 0) {
      filtered = filtered.filter((model) => {
        if (isLegacyStableDiffusionRecord(model) && model.tags) {
          return model.tags.some((tag) => selectedTags.includes(tag));
        } else if (isLegacyTextGenerationRecord(model) && model.tags) {
          return model.tags.some((tag) => selectedTags.includes(tag));
        }
        return false;
      });
    }

    if (search) {
      filtered = filtered.filter(
        (model) =>
          model.name.toLowerCase().includes(search) ||
          model.description?.toLowerCase().includes(search) ||
          (isLegacyStableDiffusionRecord(model) &&
            model.baseline?.toLowerCase().includes(search)) ||
          (isLegacyStableDiffusionRecord(model) &&
            model.tags?.some((tag) => tag.toLowerCase().includes(search))),
      );
    }

    return filtered;
  });

  readonly totalModels = computed(() => this.models().length);

  readonly baselineStats = computed(() => {
    const baselineCounts = new Map<string, number>();
    this.filteredModels().forEach((model) => {
      let baseline: string | undefined;
      if (isLegacyStableDiffusionRecord(model)) {
        baseline = model.baseline;
      } else if (isLegacyTextGenerationRecord(model)) {
        baseline = model.baseline ?? undefined;
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
      if (isLegacyStableDiffusionRecord(model) && model.tags) {
        model.tags.forEach((tag) => uniqueTags.add(tag));
      } else if (isLegacyTextGenerationRecord(model) && model.tags) {
        model.tags.forEach((tag) => uniqueTags.add(tag));
      }
    });
    return uniqueTags.size;
  });

  readonly nsfwStats = computed(() => {
    let nsfw = 0;
    let sfw = 0;
    let unknown = 0;
    this.filteredModels().forEach((model) => {
      if (model.nsfw === true) {
        nsfw++;
      } else if (model.nsfw === false) {
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
      if (isLegacyTextGenerationRecord(model) && model.parameters) {
        parameterCounts.set(model.parameters, (parameterCounts.get(model.parameters) ?? 0) + 1);
      }
    });

    const sorted = Array.from(parameterCounts.entries())
      .map(([params, count]) => ({ params, count }))
      .sort((a, b) => b.params - a.params);

    const topBuckets = sorted.slice(0, 3);
    const otherCount = sorted.slice(3).reduce((sum, bucket) => sum + bucket.count, 0);

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

  readonly categoryStatsConfig = computed(() => {
    return CATEGORY_STATS_CONFIG[this.category()] ?? ['nsfw'];
  });

  readonly allTags = computed(() => {
    const tags = new Set<string>();
    this.filteredModels().forEach((model) => {
      if (isLegacyStableDiffusionRecord(model) && model.tags) {
        model.tags.forEach((tag) => tags.add(tag));
      } else if (isLegacyTextGenerationRecord(model) && model.tags) {
        model.tags.forEach((tag) => tags.add(tag));
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
    return params >= 1_000_000_000
      ? `${(params / 1_000_000_000).toFixed(0)}B`
      : `${(params / 1_000_000).toFixed(0)}M`;
  }

  getBaselineDisplayName(baseline: string): string {
    return BASELINE_SHORTHAND_MAP[baseline] || baseline;
  }

  showBaselineDetails(): void {
    const lines = this.baselineStats().map((stat) => {
      const fullName = BASELINE_DISPLAY_MAP[stat.baseline] || stat.baseline;
      const shortName = BASELINE_SHORTHAND_MAP[stat.baseline] || stat.baseline;
      return `${shortName} = ${fullName}: ${stat.count} model${stat.count === 1 ? '' : 's'}`;
    });
    this.statDetailsToShow.set({
      title: 'Baseline Breakdown',
      content: lines.join('\n'),
    });
  }

  showTagsDetails(): void {
    const tags = this.allTags();
    this.statDetailsToShow.set({
      title: `All Tags (${tags.length})`,
      content: tags.join(', '),
    });
  }

  showNsfwDetails(): void {
    const stats = this.nsfwStats();
    const lines: string[] = [];
    if (stats.nsfw > 0) {
      lines.push(`NSFW: ${stats.nsfw} model${stats.nsfw === 1 ? '' : 's'}`);
    }
    if (stats.sfw > 0) {
      lines.push(`SFW (Safe for Work): ${stats.sfw} model${stats.sfw === 1 ? '' : 's'}`);
    }
    if (stats.unknown > 0) {
      lines.push(
        `Unknown: ${stats.unknown} model${stats.unknown === 1 ? '' : 's'} (content rating not specified)`,
      );
    }
    this.statDetailsToShow.set({
      title: 'Content Rating Breakdown',
      content: lines.join('\n'),
    });
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
    const { topBuckets, otherCount } = this.parameterBucketStats();
    const lines = topBuckets.map((bucket) => {
      const formatted = this.formatParametersInBillions(bucket.params);
      return `${formatted} (${bucket.params.toLocaleString()} parameters): ${bucket.count} model${bucket.count === 1 ? '' : 's'}`;
    });
    if (otherCount > 0) {
      lines.push(`Other parameter counts: ${otherCount} model${otherCount === 1 ? '' : 's'}`);
    }
    this.statDetailsToShow.set({
      title: 'Parameter Count Breakdown',
      content: lines.join('\n'),
    });
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
    this.route.params.subscribe((params) => {
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

    this.api.deleteModel(this.category(), modelName).subscribe({
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

  toggleTagFilterDropdown(): void {
    this.tagFilterOpen.set(!this.tagFilterOpen());
  }

  closeTagFilterDropdown(): void {
    this.tagFilterOpen.set(false);
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
    return (
      isLegacyStableDiffusionRecord(model) &&
      !!model.showcases &&
      model.showcases.length > 0
    );
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

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.src =
      'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%23999%27 stroke-width=%272%27%3E%3Crect x=%273%27 y=%273%27 width=%2718%27 height=%2718%27 rx=%272%27/%3E%3Ccircle cx=%278.5%27 cy=%278.5%27 r=%271.5%27/%3E%3Cpath d=%27M21 15l-5-5L5 21%27/%3E%3C/svg%3E';
  }

  private loadModels(): void {
    this.loading.set(true);
    this.api.getLegacyModelsAsArray(this.category()).subscribe({
      next: (models) => {
        this.models.set(models);
        this.loading.set(false);
      },
      error: (error: Error) => {
        this.notification.error(error.message);
        this.loading.set(false);
      },
    });
  }
}
