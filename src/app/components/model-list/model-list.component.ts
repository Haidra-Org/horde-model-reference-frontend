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
import { BASELINE_SHORTHAND_MAP } from '../../models/maps';

@Component({
  selector: 'app-model-list',
  imports: [FormsModule],
  templateUrl: './model-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModelListComponent implements OnInit {
  private readonly api = inject(ModelReferenceApiService);
  private readonly notification = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly category = signal<string>('');
  readonly models = signal<LegacyRecordUnion[]>([]);
  readonly loading = signal(true);
  readonly searchTerm = signal('');
  readonly showDetails = signal(false);
  readonly modelToDelete = signal<string | null>(null);
  readonly deleteConfirmationInput = signal('');
  readonly modelJsonToShow = signal<LegacyRecordUnion | null>(null);

  readonly writable = computed(() => this.api.backendCapabilities().writable);
  readonly deleteAllowed = computed(
    () => this.deleteConfirmationInput().trim() === this.modelToDelete(),
  );

  readonly isImageGeneration = computed(() => this.category() === 'image_generation');
  readonly isTextGeneration = computed(() => this.category() === 'text_generation');
  readonly isClip = computed(() => this.category() === 'clip');

  readonly filteredModels = computed(() => {
    const search = this.searchTerm().toLowerCase();
    if (!search) return this.models();

    return this.models().filter(
      (model) =>
        model.name.toLowerCase().includes(search) ||
        model.description?.toLowerCase().includes(search) ||
        (isLegacyStableDiffusionRecord(model) && model.baseline?.toLowerCase().includes(search)) ||
        (isLegacyStableDiffusionRecord(model) &&
          model.tags?.some((tag) => tag.toLowerCase().includes(search))),
    );
  });

  readonly isStableDiffusionRecord = isLegacyStableDiffusionRecord;
  readonly isTextGenerationRecord = isLegacyTextGenerationRecord;
  readonly isClipRecord = isLegacyClipRecord;
  readonly baselineDisplayMap = BASELINE_SHORTHAND_MAP;

  getDownloadCount(model: LegacyRecordUnion): number {
    return model.config?.download?.length ?? 0;
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
