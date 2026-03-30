import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Subject, catchError, debounceTime, of, switchMap } from 'rxjs';
import {
  ComposeNameResponse,
  GroupMembersResponse,
  MODEL_REFERENCE_CATEGORY,
} from '../../api-client';
import { FormModelData } from '../../adapters/model-format-adapter';
import { ModelReferenceApiService } from '../../services/model-reference-api.service';
import { NotificationService } from '../../services/notification.service';
import { AutocompleteInputComponent } from '../form-fields/autocomplete-input/autocomplete-input.component';
import { FieldTooltipComponent } from '../form-fields/field-tooltip/field-tooltip.component';
import { NameCompositionPreviewComponent } from './name-composition-preview.component';

interface GroupMembersResponseUsageFields {
  size_usage?: Record<string, number>;
  variant_usage?: Record<string, number>;
  quant_usage?: Record<string, number>;
}

@Component({
  selector: 'app-add-variation-panel',
  imports: [
    FormsModule,
    NameCompositionPreviewComponent,
    AutocompleteInputComponent,
    FieldTooltipComponent,
  ],
  templateUrl: './add-variation-panel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddVariationPanelComponent implements OnInit {
  private readonly api = inject(ModelReferenceApiService);
  private readonly notification = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly groupName = input.required<string>();
  readonly groupData = input.required<GroupMembersResponse>();

  readonly created = output<void>();
  readonly cancelled = output<void>();
  readonly dirtyChange = output<boolean>();

  readonly author = signal('');
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

  readonly composedName = signal('');
  readonly alreadyExists = signal(false);
  readonly composing = signal(false);
  readonly submitting = signal(false);

  readonly baselineSuggestions = signal<readonly string[]>([]);

  private readonly composeSubject = new Subject<void>();
  private readonly initialSnapshot = signal('');
  private readonly initialized = signal(false);

  readonly canSubmit = computed(() => {
    const currentParams = this.parameters();
    return (
      this.size().trim().length > 0 &&
      currentParams != null &&
      currentParams > 0 &&
      this.composedName().length > 0 &&
      !this.alreadyExists() &&
      !this.submitting()
    );
  });

  readonly readinessItems = computed(() => {
    const currentParams = this.parameters();
    const hasComposedName = this.composedName().length > 0;
    return [
      {
        key: 'size',
        label: 'Size selected',
        ready: this.size().trim().length > 0,
      },
      {
        key: 'parameters',
        label: 'Parameters resolved',
        ready: currentParams != null && currentParams > 0,
      },
      {
        key: 'name',
        label: 'Composed name generated',
        ready: hasComposedName,
      },
      {
        key: 'availability',
        label: 'Name is available',
        ready: hasComposedName && !this.alreadyExists(),
      },
    ];
  });

  readonly readinessCompleteCount = computed(
    () => this.readinessItems().filter((item) => item.ready).length,
  );

  readonly availableSizes = computed(() => this.groupData().available_sizes);

  readonly availableVariants = computed(() =>
    this.groupData().available_variants.filter((v): v is string => v != null),
  );

  readonly availableQuants = computed(() =>
    this.groupData().available_quants.filter((q): q is string => q != null),
  );

  readonly availableVersions = computed(() =>
    this.groupData().available_versions.filter((v): v is string => v != null),
  );

  readonly sizeAnnotations = computed(() => {
    const usage = this.groupDataWithUsage().size_usage ?? {};
    return this.buildUsageAnnotations(this.availableSizes(), usage);
  });

  readonly variantAnnotations = computed(() => {
    const usage = this.groupDataWithUsage().variant_usage ?? {};
    return this.buildUsageAnnotations(this.availableVariants(), usage);
  });

  readonly quantAnnotations = computed(() => {
    const usage = this.groupDataWithUsage().quant_usage ?? {};
    return this.buildUsageAnnotations(this.availableQuants(), usage);
  });

  readonly versionAnnotations = computed(() => {
    const usage: Record<string, number> = {};
    for (const member of this.groupData().members) {
      if (member.is_backend_duplicate) {
        continue;
      }
      const parsedVersion = member.parsed.version;
      if (parsedVersion) {
        usage[parsedVersion] = (usage[parsedVersion] ?? 0) + 1;
      }
    }
    return this.buildUsageAnnotations(this.availableVersions(), usage);
  });

  readonly nameFormat = computed(() => this.groupData().name_format);

  readonly isDirty = computed(() => {
    if (!this.initialized()) {
      return false;
    }
    return this.snapshotState() !== this.initialSnapshot();
  });

  constructor() {
    effect(() => {
      this.dirtyChange.emit(this.isDirty());
    });

    this.composeSubject
      .pipe(
        debounceTime(300),
        switchMap(() => {
          const sizeValue = this.size().trim();
          if (!sizeValue) {
            this.composedName.set('');
            this.alreadyExists.set(false);
            return of(null);
          }

          this.composing.set(true);
          const format = this.nameFormat();
          const variant = this.variant().trim() || null;
          const version = this.version().trim() || null;
          const quant = this.quant().trim() || null;
          const partOrder = this.buildEffectivePartOrder(format.part_order, {
            variant,
            version,
            quant,
          });
          return this.api
            .composeModelName({
              author: this.author().trim() || null,
              base_name: this.groupName(),
              size: sizeValue,
              variant,
              version,
              quant,
              separator: format.separator,
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

  ngOnInit(): void {
    const common = this.groupData().common_fields;
    this.baseline.set((common['baseline'] as string) ?? '');
    this.description.set((common['description'] as string) ?? '');
    this.url.set((common['url'] as string) ?? '');
    this.nsfw.set((common['nsfw'] as boolean) ?? false);

    const format = this.groupData().name_format;
    if (format.common_author) {
      this.author.set(format.common_author);
    } else {
      const canonicalMembers = this.groupData().members.filter((member) => !member.is_backend_duplicate);
      const authors = new Set(
        canonicalMembers
          .map((member) => {
            const slashIndex = member.name.indexOf('/');
            return slashIndex > 0 ? member.name.substring(0, slashIndex) : null;
          })
          .filter((value): value is string => value != null),
      );
      if (authors.size === 1) {
        this.author.set([...authors][0]);
      }
    }

    this.api
      .getDistinctBaselines()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (baselines) => {
          this.baselineSuggestions.set(baselines);
        },
        error: () => {
          this.baselineSuggestions.set([]);
        },
      });

    this.initialSnapshot.set(this.snapshotState());
    this.initialized.set(true);
  }

  setAuthor(value: string | null): void {
    this.author.set((value ?? '').trim());
    this.onFieldChange();
  }

  setSize(value: string | null): void {
    this.size.set((value ?? '').trim());
    this.syncParametersFromSize();
    this.onFieldChange();
  }

  setVariant(value: string | null): void {
    this.variant.set((value ?? '').trim());
    this.onFieldChange();
  }

  setVersion(value: string | null): void {
    this.version.set((value ?? '').trim());
    this.onFieldChange();
  }

  setQuant(value: string | null): void {
    this.quant.set((value ?? '').trim());
    this.onFieldChange();
  }

  setBaseline(value: string | null): void {
    this.baseline.set((value ?? '').trim());
  }

  toggleParameterSync(): void {
    const next = !this.parametersLinked();
    this.parametersLinked.set(next);
    if (next) {
      this.syncParametersFromSize();
    }
  }

  onFieldChange(): void {
    this.composeSubject.next();
  }

  submit(): void {
    if (!this.canSubmit()) {
      return;
    }

    const rawParams = this.parameters();
    if (rawParams == null) {
      return;
    }

    const actualParams =
      this.parametersUnit() === 'B' ? rawParams * 1_000_000_000 : rawParams * 1_000_000;

    const formData: FormModelData = {
      commonData: {
        description: this.description() || null,
        nsfw: this.nsfw(),
        style: null,
      },
      categoryData: {
        kind: 'text_generation',
        data: {
          parameters: actualParams,
          baseline: this.baseline() || null,
          url: this.url() || null,
          text_model_group: this.groupName(),
        },
      },
      downloads: [],
      legacyFiles: [],
      v2Fields: {
        recordType: 'text_generation' as MODEL_REFERENCE_CATEGORY,
        modelClassification: { domain: 'text', purpose: 'generation' },
        finetuneSeries: null,
        metadata: undefined,
      },
    };

    this.submitting.set(true);
    this.api
      .createModel('text_generation', this.composedName(), formData)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.notification.success(`Queued creation of "${this.composedName()}" for approval`);
          this.initialSnapshot.set(this.snapshotState());
          this.submitting.set(false);
          this.created.emit();
        },
        error: (error: Error) => {
          this.notification.error(error.message);
          this.submitting.set(false);
        },
      });
  }

  cancel(): void {
    this.cancelled.emit();
  }

  private groupDataWithUsage(): GroupMembersResponse & GroupMembersResponseUsageFields {
    return this.groupData() as GroupMembersResponse & GroupMembersResponseUsageFields;
  }

  private buildUsageAnnotations(
    options: readonly string[],
    usage: Record<string, number>,
  ): Record<string, string> {
    const result: Record<string, string> = {};
    for (const option of options) {
      const count = usage[option] ?? 0;
      if (count > 0) {
        result[option] = `${count} variation${count === 1 ? '' : 's'}`;
      }
    }
    return result;
  }

  private syncParametersFromSize(): void {
    if (!this.parametersLinked()) {
      return;
    }

    const parsed = this.parseSizeLabel(this.size());
    if (!parsed) {
      this.parameters.set(null);
      return;
    }

    this.parameters.set(parsed.value);
    this.parametersUnit.set(parsed.unit);
  }

  private parseSizeLabel(sizeLabel: string): { value: number; unit: 'B' | 'M' } | null {
    const normalized = sizeLabel.trim().toUpperCase();
    const match = normalized.match(/^(\d+(?:\.\d+)?)(?:X(\d+(?:\.\d+)?))?\s*([BM])$/);
    if (!match) {
      return null;
    }

    const primary = Number(match[1]);
    const secondary = match[2] ? Number(match[2]) : 1;
    const value = primary * secondary;
    if (!Number.isFinite(value) || value <= 0) {
      return null;
    }

    const unit = match[3] as 'B' | 'M';
    return { value, unit };
  }

  private buildEffectivePartOrder(
    partOrder: readonly string[] | null | undefined,
    parts: { variant: string | null; version: string | null; quant: string | null },
  ): string[] | null {
    if (!partOrder || partOrder.length === 0) {
      return null;
    }

    const effectiveOrder = [...partOrder];
    if (parts.variant && !effectiveOrder.includes('variant')) {
      effectiveOrder.push('variant');
    }
    if (parts.version && !effectiveOrder.includes('version')) {
      effectiveOrder.push('version');
    }
    if (parts.quant && !effectiveOrder.includes('quant')) {
      effectiveOrder.push('quant');
    }

    return effectiveOrder;
  }

  private snapshotState(): string {
    return JSON.stringify({
      author: this.author(),
      size: this.size(),
      variant: this.variant(),
      version: this.version(),
      quant: this.quant(),
      parameters: this.parameters(),
      parametersUnit: this.parametersUnit(),
      parametersLinked: this.parametersLinked(),
      baseline: this.baseline(),
      description: this.description(),
      url: this.url(),
      nsfw: this.nsfw(),
    });
  }
}
