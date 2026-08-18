import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, catchError, debounceTime, of, switchMap } from 'rxjs';
import {
  ComposeNameResponse,
  GroupFamilyResponse,
  GroupNameSchemaUpdateRequest,
} from '../../api-client';
import { FormModelData } from '../../adapters/model-format-adapter';
import { ModelReferenceApiService } from '../../services/model-reference-api.service';
import { NotificationService } from '../../services/notification.service';
import { PendingQueueSummaryService } from '../../services/pending-queue-summary.service';
import { AutocompleteInputComponent } from '../form-fields/autocomplete-input/autocomplete-input.component';
import { HordeButtonComponent } from '@haidra/design-system/button';
import { HordeBadgeComponent } from '@haidra/design-system/badge';
import { syncParametersFromSize } from '../../utils/size-parser';

type WizardStep = 'identity' | 'variation' | 'review';

const DEFAULT_SEPARATOR = '-';
const DEFAULT_PART_ORDER = ['base', 'size', 'variant', 'version', 'quant'];
const TEMPLATE_PREVIEW_PART_EXAMPLES: Record<string, string> = {
  size: '8B',
  variant: 'Instruct',
  version: 'v1',
  quant: 'Q4_K_M',
};

export const CREATE_GROUP_DEFAULT_PART_ORDER: readonly string[] = DEFAULT_PART_ORDER;

export const EXTRA_PART_LABEL_SUGGESTIONS: readonly string[] = [
  'date',
  'descriptor',
  'leading_version',
];

export interface ExtraPartEntry {
  label: string;
  value: string;
}

@Component({
  selector: 'app-create-group-wizard',
  imports: [FormsModule, AutocompleteInputComponent, HordeButtonComponent, HordeBadgeComponent],
  templateUrl: './create-group-wizard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateGroupWizardComponent {
  private readonly api = inject(ModelReferenceApiService);
  private readonly notification = inject(NotificationService);
  private readonly pendingSummary = inject(PendingQueueSummaryService);
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
  readonly extraParts = signal<ExtraPartEntry[]>([]);
  readonly extraPartLabelSuggestions = EXTRA_PART_LABEL_SUGGESTIONS;

  // Step 2: First variation
  readonly size = signal('');
  readonly variant = signal('');
  readonly version = signal('');
  readonly quant = signal('');
  readonly parameters = signal<number | null>(null);
  readonly parametersUnit = signal<'B' | 'M'>('B');
  readonly parametersLinked = signal(true);
  readonly baseline = signal('');
  readonly description = signal('');
  readonly url = signal('');
  readonly nsfw = signal(false);
  readonly style = signal('');
  readonly tags = signal<string[]>([]);
  readonly instructFormat = signal('');
  readonly styleSuggestions = ['alpaca', 'chatml', 'llama2', 'vicuna', 'mistral', 'zephyr'];
  readonly instructFormatSuggestions = [
    'alpaca',
    'chatml',
    'llama2',
    'llama3',
    'mistral',
    'vicuna',
    'zephyr',
    'command-r',
  ];

  readonly composedName = signal('');
  readonly alreadyExists = signal(false);
  readonly composing = signal(false);
  readonly submitting = signal(false);

  // Family suggestion
  readonly knownFamilies = signal<readonly GroupFamilyResponse[]>([]);
  readonly selectedFamily = signal<string | null>(null);
  readonly dismissedSuggestion = signal(false);
  private submitted = false;

  readonly baselineSuggestions = signal<readonly string[]>([]);
  readonly separatorOptions = ['-', '_', '.'];

  private readonly composeSubject = new Subject<void>();

  readonly step1Valid = computed(() => this.groupName().trim().length > 0);

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

  readonly suggestedFamily = computed<string | null>(() => {
    if (this.dismissedSuggestion()) return null;
    const rawName = this.groupName().trim();
    if (!rawName) return null;
    const name = rawName.toLowerCase();
    const families = this.knownFamilies();
    for (const family of families) {
      const famName = family.family_name.toLowerCase();
      if (!famName) continue;
      if (name === famName || name.includes(famName) || famName.includes(name)) {
        return family.family_name;
      }
    }
    return null;
  });

  readonly effectiveParameters = computed(() => {
    const raw = this.parameters();
    if (raw == null) return null;
    return this.parametersUnit() === 'B' ? raw * 1_000_000_000 : raw * 1_000_000;
  });

  readonly previewTemplate = computed(() => {
    const parts = this.partOrder();
    const sep = this.separator();
    const body = parts.map((p) => `{${p}}`).join(sep);
    return this.author().trim() ? `{author}/${body}` : body;
  });

  readonly previewExampleName = computed(() => {
    const base = this.groupName().trim() || 'Llama-3.1';
    const sep = this.separator();
    const renderedParts = this.partOrder().map((part) => {
      if (part === 'base') return base;
      return TEMPLATE_PREVIEW_PART_EXAMPLES[part] ?? `{${part}}`;
    });
    const renderedName = renderedParts.join(sep);
    const author = this.author().trim();
    return author ? `${author}/${renderedName}` : renderedName;
  });

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const cat = params.get('category');
      if (cat) this.category.set(cat);
    });

    effect(() => {
      const sizeValue = this.size();
      if (!this.parametersLinked()) return;
      const result = syncParametersFromSize(sizeValue, true);
      if (result.value !== null) {
        this.parameters.set(result.value);
        this.parametersUnit.set(result.unit);
      } else if (sizeValue.trim().length === 0) {
        this.parameters.set(null);
      }
    });

    this.api
      .getDistinctBaselines()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (baselines) => this.baselineSuggestions.set(baselines),
        error: () => this.baselineSuggestions.set([]),
      });

    this.api
      .listFamilies()
      .pipe(
        catchError(() => of({ families: [] as GroupFamilyResponse[] })),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((response) => {
        this.knownFamilies.set(response.families ?? []);
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
    const order = [...this.partOrder()];
    if (index <= 0 || order[index] === 'base' || order[index - 1] === 'base') return;
    [order[index - 1], order[index]] = [order[index], order[index - 1]];
    this.partOrder.set(order);
  }

  movePartDown(index: number): void {
    const order = [...this.partOrder()];
    if (index >= order.length - 1 || order[index] === 'base') return;
    [order[index], order[index + 1]] = [order[index + 1], order[index]];
    this.partOrder.set(order);
  }

  isPartLocked(part: string): boolean {
    return part === 'base';
  }

  acceptFamilySuggestion(): void {
    const name = this.suggestedFamily();
    if (name) {
      this.selectedFamily.set(name);
    }
  }

  dismissFamilySuggestion(): void {
    this.dismissedSuggestion.set(true);
    this.selectedFamily.set(null);
  }

  setGroupName(value: string): void {
    this.groupName.set(value);
    // Reset suggestion dismissal when name changes so fresh matches surface again
    this.dismissedSuggestion.set(false);
  }

  addTag(tag: string): void {
    const trimmed = tag.trim();
    if (!trimmed) return;
    this.tags.update((list) => (list.includes(trimmed) ? list : [...list, trimmed]));
  }

  removeTag(tag: string): void {
    this.tags.update((list) => list.filter((t) => t !== tag));
  }

  toggleParametersLinked(): void {
    const next = !this.parametersLinked();
    this.parametersLinked.set(next);
    if (next) {
      const result = syncParametersFromSize(this.size(), true);
      if (result.value !== null) {
        this.parameters.set(result.value);
        this.parametersUnit.set(result.unit);
      }
    }
  }

  addExtraPart(): void {
    this.extraParts.update((list) => [...list, { label: '', value: '' }]);
  }

  removeExtraPart(index: number): void {
    this.extraParts.update((list) => list.filter((_, i) => i !== index));
    this.triggerCompose();
  }

  updateExtraPartLabel(index: number, label: string): void {
    this.extraParts.update((list) =>
      list.map((entry, i) => (i === index ? { ...entry, label } : entry)),
    );
    this.triggerCompose();
  }

  updateExtraPartValue(index: number, value: string): void {
    this.extraParts.update((list) =>
      list.map((entry, i) => (i === index ? { ...entry, value } : entry)),
    );
    this.triggerCompose();
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
            const extraLabels = this.extraParts()
              .map((p) => p.label.trim())
              .filter((label) => label.length > 0);
            const extraKeys = extraLabels.map((label) => `extra:${label}`);
            const schemaPartOrder = [...this.partOrder()];
            for (const key of extraKeys) {
              if (!schemaPartOrder.includes(key)) {
                schemaPartOrder.push(key);
              }
            }
            const schema: GroupNameSchemaUpdateRequest = {
              separator: this.separator(),
              part_order: schemaPartOrder,
              author_included: this.author().trim().length > 0,
              common_author: this.author().trim() || undefined,
              template: this.previewTemplate() || undefined,
              extra_parts: extraLabels.length > 0 ? extraLabels : undefined,
            };
            return this.api.updateGroupNameSchema(this.groupName().trim(), schema);
          }
          return of(void 0);
        }),
        switchMap(() => {
          const family = this.selectedFamily();
          if (!family) return of(void 0);
          return this.api.addFamilyMember(family, this.groupName().trim()).pipe(
            catchError((err: Error) => {
              this.notification.warning(
                `Group created, but family assignment failed: ${err.message}`,
              );
              return of(void 0);
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.submitted = true;
          this.pendingSummary.refresh();
          this.notification.success(
            `Created "${modelName}" and group "${this.groupName().trim()}" (pending approval)`,
          );
          this.router.navigate(['/categories', this.category(), 'group', this.groupName().trim()]);
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
    if (this.submitted) return false;
    return this.groupName().trim().length > 0 || this.size().trim().length > 0;
  }

  private buildFormModelData(): FormModelData {
    const tagList = this.tags();
    return {
      commonData: {
        description: this.description().trim() || null,
        nsfw: this.nsfw(),
        version: this.version().trim() || null,
        style: this.style().trim() || null,
      },
      categoryData: {
        kind: 'text_generation',
        data: {
          parameters: this.effectiveParameters(),
          baseline: this.baseline().trim() || null,
          url: this.url().trim() || null,
          text_model_group: this.groupName().trim(),
          tags: tagList.length > 0 ? tagList : null,
          instruct_format: this.instructFormat().trim() || null,
        },
      },
      downloads: [],
      licensing: null,
      legacyFiles: [],
      v2Fields: null,
    };
  }

  private buildEffectivePartOrder(parts: {
    variant: string | null;
    version: string | null;
    quant: string | null;
  }): string[] {
    const filtered = this.partOrder().filter((part) => {
      if (part === 'base') return true;
      if (part === 'variant' && !parts.variant) return false;
      if (part === 'version' && !parts.version) return false;
      if (part === 'quant' && !parts.quant) return false;
      return true;
    });
    if (!filtered.includes('base')) {
      filtered.unshift('base');
    }
    const extraKeys = this.extraParts()
      .filter((p) => p.label.trim() && p.value.trim())
      .map((p) => `extra:${p.label.trim()}`);
    for (const key of extraKeys) {
      if (!filtered.includes(key)) {
        filtered.push(key);
      }
    }
    return filtered;
  }
}
