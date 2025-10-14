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
  BASELINE_DISPLAY_MAP,
} from '../../models';

@Component({
  selector: 'app-model-list',
  imports: [FormsModule],
  templateUrl: './model-list.component.html',
  styleUrl: './model-list.component.scss',
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
  readonly modelToDelete = signal<string | null>(null);

  readonly writable = computed(() => this.api.backendCapabilities().writable);

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
        (isLegacyStableDiffusionRecord(model) && model.tags?.some(tag => tag.toLowerCase().includes(search)))
    );
  });

  readonly isStableDiffusionRecord = isLegacyStableDiffusionRecord;
  readonly isTextGenerationRecord = isLegacyTextGenerationRecord;
  readonly isClipRecord = isLegacyClipRecord;
  readonly baselineDisplayMap = BASELINE_DISPLAY_MAP;

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
  }

  deleteModel(modelName: string): void {
    this.api.deleteModel(this.category(), modelName).subscribe({
      next: () => {
        this.notification.success(`Model "${modelName}" deleted successfully`);
        this.modelToDelete.set(null);
        this.loadModels();
      },
      error: (error: Error) => {
        this.notification.error(error.message);
        this.modelToDelete.set(null);
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
