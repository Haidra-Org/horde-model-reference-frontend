import {
  Component,
  inject,
  OnInit,
  signal,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ModelReferenceApiService } from '../../services/model-reference-api.service';
import { NotificationService } from '../../services/notification.service';
import {
  LegacyRecordUnion,
  ModelReferenceCategory,
  createDefaultRecordForCategory,
  validateLegacyRecord,
  hasErrorIssues,
  groupIssuesBySeverity,
  ValidationIssue,
} from '../../models';

@Component({
  selector: 'app-model-form',
  imports: [ReactiveFormsModule],
  templateUrl: './model-form.component.html',
  styleUrl: './model-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModelFormComponent implements OnInit {
  private readonly api = inject(ModelReferenceApiService);
  private readonly notification = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);

  readonly category = signal<string>('');
  readonly modelName = signal<string | null>(null);
  readonly isEditMode = signal(false);
  readonly loading = signal(false);
  readonly submitting = signal(false);
  readonly validationIssues = signal<ValidationIssue[]>([]);

  readonly groupedIssues = computed(() => groupIssuesBySeverity(this.validationIssues()));
  readonly hasErrors = computed(() => hasErrorIssues(this.validationIssues()));

  form!: FormGroup;

  ngOnInit(): void {
    this.route.params.subscribe((params) => {
      this.category.set(params['category']);
      const modelName = params['modelName'];

      if (modelName) {
        this.isEditMode.set(true);
        this.modelName.set(modelName);
        this.initFormForEdit(modelName);
      } else {
        this.isEditMode.set(false);
        this.initFormForCreate();
      }
    });
  }

  cancel(): void {
    this.router.navigate(['/categories', this.category()]);
  }

  validateJson(): void {
    try {
      const jsonData = JSON.parse(this.form.value.jsonData);
      const modelName = this.form.value.name || 'new-model';
      const modelData: LegacyRecordUnion = { name: modelName, ...jsonData };

      const issues = validateLegacyRecord(modelData);
      this.validationIssues.set(issues);
    } catch (error) {
      this.validationIssues.set([
        {
          message: 'Invalid JSON format',
          severity: 'error',
        },
      ]);
    }
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const modelName = this.form.value.name;
    let modelData: LegacyRecordUnion;

    try {
      const jsonData = JSON.parse(this.form.value.jsonData);
      modelData = { name: modelName, ...jsonData };
    } catch (error) {
      this.notification.error('Invalid JSON format');
      return;
    }

    const issues = validateLegacyRecord(modelData);
    this.validationIssues.set(issues);

    if (hasErrorIssues(issues)) {
      this.notification.error('Please fix validation errors before submitting');
      return;
    }

    this.submitting.set(true);

    const operation = this.isEditMode()
      ? this.api.updateLegacyModel(this.category(), modelName, modelData)
      : this.api.createLegacyModel(this.category(), modelName, modelData);

    operation.subscribe({
      next: () => {
        const action = this.isEditMode() ? 'updated' : 'created';
        this.notification.success(`Model "${modelName}" ${action} successfully`);
        this.router.navigate(['/categories', this.category()]);
      },
      error: (error: Error) => {
        this.notification.error(error.message);
        this.submitting.set(false);
      },
    });
  }

  private initFormForCreate(): void {
    const category = this.category() as ModelReferenceCategory;
    const defaultRecord = createDefaultRecordForCategory(category, 'new-model');
    const { name, ...jsonData } = defaultRecord;

    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.pattern(/^[a-zA-Z0-9_-]+$/)]],
      jsonData: [JSON.stringify(jsonData, null, 2), Validators.required],
    });

    this.form.get('jsonData')?.valueChanges.subscribe(() => {
      this.validateJson();
    });
  }

  private initFormForEdit(modelName: string): void {
    this.loading.set(true);

    this.api.getLegacyModelsInCategory(this.category()).subscribe({
      next: (response) => {
        const model = response[modelName];
        if (!model) {
          this.notification.error(`Model "${modelName}" not found`);
          this.router.navigate(['/categories', this.category()]);
          return;
        }

        const { name, ...jsonData } = model;

        this.form = this.fb.group({
          name: [{ value: name, disabled: true }, Validators.required],
          jsonData: [JSON.stringify(jsonData, null, 2), Validators.required],
        });

        this.form.get('jsonData')?.valueChanges.subscribe(() => {
          this.validateJson();
        });

        this.validateJson();
        this.loading.set(false);
      },
      error: (error: Error) => {
        this.notification.error(error.message);
        this.router.navigate(['/categories', this.category()]);
      },
    });
  }
}
