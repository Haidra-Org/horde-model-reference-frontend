import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, catchError, debounceTime, of, switchMap } from 'rxjs';
import {
  ComposeNameResponse,
  GroupNameSchemaUpdateRequest,
} from '../../api-client';
import { FormModelData } from '../../adapters/model-format-adapter';
import { ModelReferenceApiService } from '../../services/model-reference-api.service';
import { NotificationService } from '../../services/notification.service';
import { AutocompleteInputComponent } from '../form-fields/autocomplete-input/autocomplete-input.component';
import { HordeButtonComponent } from '@haidra/design-system/button';
import { HordeBadgeComponent } from '@haidra/design-system/badge';

type WizardStep = 'identity' | 'variation' | 'review';

const DEFAULT_SEPARATOR = '-';
const DEFAULT_PART_ORDER = ['size', 'variant', 'version', 'quant'];
const TEMPLATE_PREVIEW_PART_EXAMPLES: Record<string, string> = {
  size: '8B',
  variant: 'Instruct',
  version: 'v1',
  quant: 'Q4_K_M',
};

@Component({
  selector: 'app-create-group-wizard',
  imports: [
    FormsModule,
    AutocompleteInputComponent,
    HordeButtonComponent,
    HordeBadgeComponent,
  ],
  templateUrl: './create-group-wizard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateGroupWizardComponent {
  private readonly api = inject(ModelReferenceApiService);
  private readonly notification = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly category = signal('text_generation');
  readonly step = signal<WizardStep>('identity');

  // Step 1: Group identity
  readonly groupName = signal('');
  readonly author = signal('');
  readonly separator = signal(DEFAULT_SEPARATOR);
  readonly partOrder = signal<string[]>([...DEFAULT_PART_ORDER]);
  readonly saveSchema = signal(true);

  // Step 2: First variation
  readonly size = signal('');
  readonly variant = signal('');
  readonly version = signal('');
  readonly quant = signal('');
  readonly parameters = signal<number | null>(null);
  readonly parametersUnit = signal<'B' | 'M'>('B');
  readonly baseline = signal('');
  readonly description = signal('');
  readonly url = signal('');
  readonly nsfw = signal(false);

  readonly composedName = signal('');
  readonly alreadyExists = signal(false);
  readonly composing = signal(false);
  readonly submitting = signal(false);

  readonly baselineSuggestions = signal<readonly string[]>([]);
  readonly separatorOptions = ['-', '_', '.'];

  private readonly composeSubject = new Subject<void>();

  readonly step1Valid = computed(
    () => this.groupName().trim().length > 0,
  );

  readonly step2Valid = computed(() => {
    const params = this.parameters();
    return (
      this.size().trim().length > 0 &&
      params != null &&
      params > 0 &&
      this.composedName().length > 0 &&
      !this.alreadyExists()
    );
  });

  readonly effectiveParameters = computed(() => {
    const raw = this.parameters();
    if (raw == null) return null;
    return this.parametersUnit() === 'B' ? raw * 1_000_000_000 : raw * 1_000_000;
  });

  readonly previewTemplate = computed(() => {
    const parts = this.partOrder();
    const sep = this.separator();
    return `{base}${parts.map((p) => `${sep}{${p}}`).join('')}`;
  });

  readonly previewExampleName = computed(() => {
    const base = this.groupName().trim() || 'Llama-3.1';
    const sep = this.separator();
    const renderedParts = this.partOrder().map(
      (part) => TEMPLATE_PREVIEW_PART_EXAMPLES[part] ?? `{${part}}`,
    );
    const renderedName = [base, ...renderedParts].join(sep);
    const author = this.author().trim();

    return author ? `${author}/${renderedName}` : renderedName;
  });

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const cat = params.get('category');
      if (cat) this.category.set(cat);
    });

    this.api
      .getDistinctBaselines()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (baselines) => this.baselineSuggestions.set(baselines),
        error: () => this.baselineSuggestions.set([]),
      });

    this.composeSubject
      .pipe(
        debounceTime(300),
        switchMap(() => {
          const sizeValue = this.size().trim();
          if (!sizeValue || !this.groupName().trim()) {
            this.composedName.set('');
            this.alreadyExists.set(false);
            return of(null);
          }

          this.composing.set(true);
          const variant = this.variant().trim() || null;
          const version = this.version().trim() || null;
          const quant = this.quant().trim() || null;
          const partOrder = this.buildEffectivePartOrder({ variant, version, quant });
          return this.api
            .composeModelName({
              author: this.author().trim() || null,
              base_name: this.groupName().trim(),
              size: sizeValue,
              variant,
              version,
              quant,
              separator: this.separator(),
              part_order: partOrder,
            })
            .pipe(
              catchError(() => {
                this.composing.set(false);
                return of(null);
              }),
            );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result: ComposeNameResponse | null) => {
        this.composing.set(false);
        if (result) {
          this.composedName.set(result.composed_name);
          this.alreadyExists.set(result.already_exists);
        }
      });
  }

  goToStep(target: WizardStep): void {
    this.step.set(target);
    if (target === 'variation') {
      this.triggerCompose();
    }
  }

  triggerCompose(): void {
    this.composeSubject.next();
  }

  movePartUp(index: number): void {
    if (index <= 0) return;
    const order = [...this.partOrder()];
    [order[index - 1], order[index]] = [order[index], order[index - 1]];
    this.partOrder.set(order);
  }

  movePartDown(index: number): void {
    const order = [...this.partOrder()];
    if (index >= order.length - 1) return;
    [order[index], order[index + 1]] = [order[index + 1], order[index]];
    this.partOrder.set(order);
  }

  submit(): void {
    if (this.submitting()) return;
    this.submitting.set(true);

    const modelName = this.composedName();
    const formData = this.buildFormModelData();

    this.api
      .createModel(this.category(), modelName, formData)
      .pipe(
        switchMap(() => {
          if (this.saveSchema()) {
            const schema: GroupNameSchemaUpdateRequest = {
              separator: this.separator(),
              part_order: this.partOrder(),
              author_included: this.author().trim().length > 0,
              common_author: this.author().trim() || undefined,
            };
            return this.api.updateGroupNameSchema(this.groupName().trim(), schema);
          }
          return of(void 0);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.notification.success(
            `Created "${modelName}" and group "${this.groupName().trim()}"`,
          );
          this.router.navigate([
            '/categories',
            this.category(),
            'group',
            this.groupName().trim(),
          ]);
        },
        error: (error: Error) => {
          this.submitting.set(false);
          this.notification.error(error.message);
        },
      });
  }

  cancel(): void {
    this.router.navigate(['/categories', this.category()]);
  }

  hasUnsavedChanges(): boolean {
    return this.groupName().trim().length > 0 || this.size().trim().length > 0;
  }

  private buildFormModelData(): FormModelData {
    return {
      commonData: {
        description: this.description().trim() || null,
        nsfw: this.nsfw(),
        version: this.version().trim() || null,
      },
      categoryData: {
        kind: 'text_generation',
        data: {
          parameters: this.effectiveParameters(),
          baseline: this.baseline().trim() || null,
          url: this.url().trim() || null,
          text_model_group: this.groupName().trim(),
        },
      },
      downloads: [],
      legacyFiles: [],
      v2Fields: null,
    };
  }

  private buildEffectivePartOrder(parts: {
    variant: string | null;
    version: string | null;
    quant: string | null;
  }): string[] {
    return this.partOrder().filter((part) => {
      if (part === 'variant' && !parts.variant) return false;
      if (part === 'version' && !parts.version) return false;
      if (part === 'quant' && !parts.quant) return false;
      return true;
    });
  }
}
