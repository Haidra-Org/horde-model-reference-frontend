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
import {
  ComposeNameRequest,
  ComposeNameResponse,
  GroupMembersResponse,
  MODEL_REFERENCE_CATEGORY,
} from '../../api-client';
import { FormModelData } from '../../adapters/model-format-adapter';
import { ModelReferenceApiService } from '../../services/model-reference-api.service';
import { NotificationService } from '../../services/notification.service';
import { AutocompleteInputComponent } from '../form-fields/autocomplete-input/autocomplete-input.component';
import { FieldTooltipComponent } from '../form-fields/field-tooltip/field-tooltip.component';
import { Subject, catchError, concatMap, debounceTime, forkJoin, from, map, of, switchMap } from 'rxjs';

interface GroupMembersResponseUsageFields {
  size_usage?: Record<string, number>;
  variant_usage?: Record<string, number>;
  quant_usage?: Record<string, number>;
}

export interface VariationCombo {
  size: string;
  quant: string | null;
  composedName: string;
  alreadyExists: boolean;
  selected: boolean;
  status: 'pending' | 'creating' | 'created' | 'failed';
  errorMessage: string | null;
}

interface PreviewRequest {
  key: string;
  size: string;
  quant: string | null;
  request: ComposeNameRequest;
}

@Component({
  selector: 'app-multi-variation-panel',
  imports: [FormsModule, AutocompleteInputComponent, FieldTooltipComponent],
  templateUrl: './multi-variation-panel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MultiVariationPanelComponent implements OnInit {
  private readonly api = inject(ModelReferenceApiService);
  private readonly notification = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly groupName = input.required<string>();
  readonly groupData = input.required<GroupMembersResponse>();

  readonly created = output<void>();
  readonly cancelled = output<void>();
  readonly dirtyChange = output<boolean>();

  readonly author = signal('');
  readonly variant = signal('');
  readonly version = signal('');
  readonly parameters = signal<number | null>(null);
  readonly parametersUnit = signal<'B' | 'M'>('B');
  readonly parametersLinked = signal(true);
  readonly baseline = signal('');
  readonly description = signal('');
  readonly url = signal('');
  readonly nsfw = signal(false);

  readonly selectedSizes = signal<Set<string>>(new Set());
  readonly selectedQuants = signal<Set<string | null>>(new Set());
  readonly removedCombos = signal<Set<string>>(new Set());
  readonly customSize = signal('');
  readonly customQuant = signal('');

  readonly combos = signal<VariationCombo[]>([]);
  readonly previewing = signal(false);
  readonly submitting = signal(false);
  readonly progress = signal({ done: 0, total: 0 });

  readonly baselineSuggestions = signal<readonly string[]>([]);

  private readonly previewSubject = new Subject<void>();
  private readonly initialSnapshot = signal('');
  private readonly initialized = signal(false);

  readonly availableSizes = computed(() => {
    const seeded = [...this.groupData().available_sizes];
    for (const selected of this.selectedSizes()) {
      if (!seeded.includes(selected)) {
        seeded.push(selected);
      }
    }
    return seeded;
  });

  readonly availableQuants = computed(() => {
    const seeded = this.groupData().available_quants.filter((q): q is string => q != null);
    for (const selected of this.selectedQuants()) {
      if (selected && !seeded.includes(selected)) {
        seeded.push(selected);
      }
    }
    return seeded;
  });

  readonly availableVariants = computed(() =>
    this.groupData().available_variants.filter((variant): variant is string => variant != null),
  );

  readonly availableVersions = computed(() =>
    this.groupData().available_versions.filter((version): version is string => version != null),
  );

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

  readonly selectableCount = computed(() => this.combos().filter((combo) => !combo.alreadyExists).length);

  readonly selectedCount = computed(
    () => this.combos().filter((combo) => combo.selected && combo.status === 'pending').length,
  );

  readonly createdCount = computed(() => this.combos().filter((combo) => combo.status === 'created').length);

  readonly failedCount = computed(() => this.combos().filter((combo) => combo.status === 'failed').length);

  readonly hasFailedCombos = computed(() => this.failedCount() > 0);

  readonly hasPreviewableSelection = computed(() => this.selectedSizes().size > 0);

  readonly selectedSizeCount = computed(() => this.selectedSizes().size);

  readonly selectedQuantCount = computed(() => this.selectedQuants().size);

  readonly previewTotalCount = computed(() => this.combos().length);

  readonly existingComboCount = computed(() => this.combos().filter((combo) => combo.alreadyExists).length);

  readonly canSubmit = computed(() => {
    const hasSelectablePending = this.combos().some(
      (combo) => combo.selected && !combo.alreadyExists && combo.status === 'pending',
    );
    if (!hasSelectablePending || this.submitting()) {
      return false;
    }

    if (this.parametersLinked()) {
      return true;
    }

    const currentParams = this.parameters();
    return currentParams != null && currentParams > 0;
  });

  readonly isDirty = computed(() => {
    if (!this.initialized()) {
      return false;
    }
    return this.snapshotState() !== this.initialSnapshot();
  });

  readonly activityRows = computed(() =>
    this.combos().filter((combo) => combo.status !== 'pending' || combo.alreadyExists),
  );

  readonly nameFormat = computed(() => this.groupData().name_format);

  constructor() {
    effect(() => {
      this.dirtyChange.emit(this.isDirty());
    });

    this.previewSubject
      .pipe(
        debounceTime(500),
        switchMap(() => {
          const requests = this.buildPreviewRequests();
          if (requests.length === 0) {
            this.combos.set([]);
            return of<{ requests: PreviewRequest[]; results: ComposeNameResponse[] } | null>(null);
          }

          this.previewing.set(true);
          return forkJoin(
            requests.map((requestEntry) =>
              this.api.composeModelName(requestEntry.request).pipe(
                catchError(() =>
                  of({
                    composed_name: this.fallbackComposedName(requestEntry.size, requestEntry.quant),
                    already_exists: false,
                    suggested_group: this.groupName(),
                  } satisfies ComposeNameResponse),
                ),
              ),
            ),
          ).pipe(map((results) => ({ requests, results })));
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((payload) => {
        if (!payload) {
          this.previewing.set(false);
          return;
        }

        const previous = new Map(
          this.combos().map((combo) => [this.comboKey(combo.size, combo.quant), combo]),
        );

        const nextCombos = payload.results.map((result, index): VariationCombo => {
          const requestEntry = payload.requests[index];
          const prior = previous.get(requestEntry.key);
          return {
            size: requestEntry.size,
            quant: requestEntry.quant,
            composedName: result.composed_name,
            alreadyExists: result.already_exists,
            selected: prior ? prior.selected && !result.already_exists : !result.already_exists,
            status: 'pending',
            errorMessage: null,
          };
        });

        this.combos.set(nextCombos);
        this.previewing.set(false);
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

  toggleSize(size: string): void {
    const current = new Set(this.selectedSizes());
    if (current.has(size)) {
      current.delete(size);
    } else {
      current.add(size);
    }
    this.selectedSizes.set(current);
    this.schedulePreview();
  }

  toggleQuant(quant: string | null): void {
    const current = new Set(this.selectedQuants());
    if (current.has(quant)) {
      current.delete(quant);
    } else {
      current.add(quant);
    }
    this.selectedQuants.set(current);
    this.schedulePreview();
  }

  addCustomSize(): void {
    const custom = this.customSize().trim();
    if (!custom) {
      return;
    }

    const current = new Set(this.selectedSizes());
    current.add(custom);
    this.selectedSizes.set(current);
    this.customSize.set('');
    this.schedulePreview();
  }

  addCustomQuant(): void {
    const custom = this.customQuant().trim();
    if (!custom) {
      return;
    }

    const current = new Set(this.selectedQuants());
    current.add(custom);
    this.selectedQuants.set(current);
    this.customQuant.set('');
    this.schedulePreview();
  }

  setAuthor(value: string | null): void {
    this.author.set((value ?? '').trim());
    this.schedulePreview();
  }

  setVariant(value: string | null): void {
    this.variant.set((value ?? '').trim());
    this.schedulePreview();
  }

  setVersion(value: string | null): void {
    this.version.set((value ?? '').trim());
    this.schedulePreview();
  }

  setBaseline(value: string | null): void {
    this.baseline.set((value ?? '').trim());
  }

  toggleParameterSync(): void {
    this.parametersLinked.update((linked) => !linked);
  }

  removeCombo(combo: VariationCombo): void {
    const key = this.comboKey(combo.size, combo.quant);
    this.removedCombos.update((set) => {
      const next = new Set(set);
      next.add(key);
      return next;
    });

    this.combos.set(this.combos().filter((current) => this.comboKey(current.size, current.quant) !== key));
  }

  toggleCombo(index: number): void {
    const current = [...this.combos()];
    const combo = current[index];
    if (!combo || combo.alreadyExists || combo.status !== 'pending') {
      return;
    }

    current[index] = { ...combo, selected: !combo.selected };
    this.combos.set(current);
  }

  selectAllAvailable(): void {
    this.combos.set(
      this.combos().map((combo) =>
        combo.alreadyExists || combo.status !== 'pending' ? combo : { ...combo, selected: true },
      ),
    );
  }

  deselectAll(): void {
    this.combos.set(
      this.combos().map((combo) => (combo.status !== 'pending' ? combo : { ...combo, selected: false })),
    );
  }

  submit(): void {
    const pendingSelection = this.combos().filter(
      (combo) => combo.selected && !combo.alreadyExists && combo.status === 'pending',
    );
    if (pendingSelection.length === 0 || !this.canSubmit()) {
      return;
    }

    this.submitCombos(pendingSelection);
  }

  retryFailed(): void {
    if (this.submitting()) {
      return;
    }

    this.combos.set(
      this.combos().map((combo) =>
        combo.status === 'failed'
          ? { ...combo, status: 'pending', selected: true, errorMessage: null }
          : combo,
      ),
    );

    const failedSelection = this.combos().filter(
      (combo) => combo.selected && !combo.alreadyExists && combo.status === 'pending',
    );

    if (failedSelection.length === 0) {
      return;
    }

    this.submitCombos(failedSelection);
  }

  cancel(): void {
    this.cancelled.emit();
  }

  sizeUsageCount(size: string): number {
    const usage = this.groupDataWithUsage().size_usage ?? {};
    return usage[size] ?? 0;
  }

  quantUsageCount(quant: string): number {
    const usage = this.groupDataWithUsage().quant_usage ?? {};
    return usage[quant] ?? 0;
  }

  private submitCombos(toCreate: VariationCombo[]): void {
    this.submitting.set(true);
    this.progress.set({ done: 0, total: toCreate.length });

    let created = 0;
    let failed = 0;

    from(toCreate)
      .pipe(
        concatMap((combo, index) => {
          this.updateComboStatus(combo.composedName, 'creating', null);

          const resolvedParams = this.resolveParametersForCombo(combo);
          if (resolvedParams == null) {
            return of({ combo, index, success: false, error: 'Size must end with B or M to derive parameters.' });
          }

          const formData = this.buildFormData(resolvedParams);
          return this.api.createModel('text_generation', combo.composedName, formData).pipe(
            map(() => ({ combo, index, success: true as const, error: null })),
            catchError((error: Error) =>
              of({ combo, index, success: false as const, error: error.message || 'Failed to create variation.' }),
            ),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (result) => {
          if (result.success) {
            created += 1;
            this.updateComboStatus(result.combo.composedName, 'created', null);
          } else {
            failed += 1;
            this.updateComboStatus(result.combo.composedName, 'failed', result.error);
          }

          this.progress.update((current) => ({ ...current, done: current.done + 1 }));
        },
        complete: () => {
          this.submitting.set(false);
          this.initialSnapshot.set(this.snapshotState());

          if (created > 0) {
            this.notification.success(`Created ${created} variation(s).`);
            this.created.emit();
          }
          if (failed > 0) {
            this.notification.error(`${failed} variation(s) failed. You can retry failed rows.`);
          }
        },
      });
  }

  private resolveParametersForCombo(combo: VariationCombo): number | null {
    if (this.parametersLinked()) {
      const parsed = this.parseSizeLabel(combo.size);
      if (!parsed) {
        return null;
      }
      return parsed.unit === 'B' ? parsed.value * 1_000_000_000 : parsed.value * 1_000_000;
    }

    const rawParams = this.parameters();
    if (rawParams == null || rawParams <= 0) {
      return null;
    }

    return this.parametersUnit() === 'B' ? rawParams * 1_000_000_000 : rawParams * 1_000_000;
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

  private updateComboStatus(
    composedName: string,
    status: VariationCombo['status'],
    errorMessage: string | null,
  ): void {
    this.combos.set(
      this.combos().map((combo) =>
        combo.composedName === composedName ? { ...combo, status, errorMessage } : combo,
      ),
    );
  }

  private buildFormData(actualParams: number): FormModelData {
    return {
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
  }

  private schedulePreview(): void {
    this.previewSubject.next();
  }

  private buildPreviewRequests(): PreviewRequest[] {
    const selectedSizes = Array.from(this.selectedSizes());
    if (selectedSizes.length === 0) {
      return [];
    }

    const selectedQuants = this.selectedQuants().size > 0 ? Array.from(this.selectedQuants()) : [null];
    const format = this.nameFormat();
    const removed = this.removedCombos();
    const author = this.author().trim() || null;
    const variant = this.variant().trim() || null;
    const version = this.version().trim() || null;

    const requests: PreviewRequest[] = [];
    for (const size of selectedSizes) {
      for (const quant of selectedQuants) {
        const key = this.comboKey(size, quant);
        if (removed.has(key)) {
          continue;
        }

        const partOrder = this.buildEffectivePartOrder(format.part_order, {
          variant,
          version,
          quant,
        });

        requests.push({
          key,
          size,
          quant,
          request: {
            author,
            base_name: this.groupName(),
            size,
            variant,
            version,
            quant,
            separator: format.separator,
            part_order: partOrder,
          },
        });
      }
    }

    return requests;
  }

  private fallbackComposedName(size: string, quant: string | null): string {
    if (quant) {
      return `${this.groupName()}-${size}-${quant}`;
    }
    return `${this.groupName()}-${size}`;
  }

  private comboKey(size: string, quant: string | null): string {
    return `${size}::${quant ?? ''}`;
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

  private snapshotState(): string {
    return JSON.stringify({
      author: this.author(),
      variant: this.variant(),
      version: this.version(),
      parameters: this.parameters(),
      parametersUnit: this.parametersUnit(),
      parametersLinked: this.parametersLinked(),
      baseline: this.baseline(),
      description: this.description(),
      url: this.url(),
      nsfw: this.nsfw(),
      selectedSizes: Array.from(this.selectedSizes()).sort(),
      selectedQuants: Array.from(this.selectedQuants()).sort(),
      removedCombos: Array.from(this.removedCombos()).sort(),
      comboSelection: this.combos()
        .map((combo) => ({ key: this.comboKey(combo.size, combo.quant), selected: combo.selected }))
        .sort((a, b) => a.key.localeCompare(b.key)),
    });
  }
}
