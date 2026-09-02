import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize, forkJoin, Observable } from 'rxjs';
import {
  BASE_PATH,
  LicenseDefinition,
  LicenseObligation,
  LicensedAsset,
  LicensedAssetKind,
  LicensedAssetView,
  LicensingSummary,
  MODEL_REFERENCE_CATEGORY,
  PermissionStatus,
} from '../../api-client';
import {
  LicensedAssetFilters,
  ModelReferenceApiService,
} from '../../services/model-reference-api.service';
import { ViewerCapabilitiesService } from '../../services/viewer-capabilities.service';
import { NotificationService } from '../../services/notification.service';
import { ShellContextService } from '../../services/shell-context.service';
import { RECORD_DISPLAY_MAP } from '../../models/maps';

type LicensingTab = 'assets' | 'definitions';
type EditorKind = 'definition' | 'asset';

const PAGE_SIZE = 50;
const MODEL_FILE_EXTENSIONS = new Set([
  'bin',
  'ckpt',
  'ggml',
  'gguf',
  'h5',
  'keras',
  'mlmodel',
  'npz',
  'onnx',
  'pb',
  'pt',
  'pth',
  'safetensors',
  'tflite',
]);

@Component({
  selector: 'app-licensing',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './licensing.component.html',
  styleUrl: './licensing.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LicensingComponent implements OnInit, OnDestroy {
  private readonly api = inject(ModelReferenceApiService);
  private readonly viewer = inject(ViewerCapabilitiesService);
  private readonly notifications = inject(NotificationService);
  private readonly shellContext = inject(ShellContextService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(FormBuilder);
  private readonly apiBasePath = inject(BASE_PATH);

  protected readonly PermissionStatus = PermissionStatus;
  protected readonly modelCategories = Object.values(MODEL_REFERENCE_CATEGORY);
  protected readonly activeTab = signal<LicensingTab>('assets');
  protected readonly summary = signal<LicensingSummary | null>(null);
  protected readonly definitions = signal<LicenseDefinition[]>([]);
  protected readonly assets = signal<LicensedAssetView[]>([]);
  protected readonly assetTotal = signal(0);
  protected readonly assetOffset = signal(0);
  protected readonly loading = signal(true);
  protected readonly assetsLoading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly editorKind = signal<EditorKind | null>(null);
  protected readonly editingDefinitionId = signal<string | null>(null);
  protected readonly editingAssetKey = signal<{
    kind: LicensedAssetKind;
    identifier: string;
  } | null>(null);
  protected readonly saving = signal(false);

  protected readonly filterForm = this.formBuilder.nonNullable.group({
    query: [''],
    assetKind: [''],
    category: [''],
    licenseId: [''],
    commercialUse: [''],
    redistribution: [''],
  });

  protected readonly definitionForm = this.formBuilder.nonNullable.group({
    licenseId: ['', [Validators.required]],
    name: ['', [Validators.required]],
    spdxIdentifier: [''],
    canonicalUrl: ['', [Validators.required]],
    commercialUse: this.formBuilder.nonNullable.control<PermissionStatus>(
      PermissionStatus.Unknown,
      Validators.required,
    ),
    redistribution: this.formBuilder.nonNullable.control<PermissionStatus>(
      PermissionStatus.Unknown,
      Validators.required,
    ),
    obligations: [''],
    restrictions: [''],
    notes: [''],
    deprecated: [false],
  });

  protected readonly assetForm = this.formBuilder.nonNullable.group({
    assetKind: this.formBuilder.nonNullable.control<LicensedAssetKind>(
      LicensedAssetKind.SoftwareComponent,
      Validators.required,
    ),
    assetIdentifier: ['', [Validators.required]],
    displayName: ['', [Validators.required]],
    sourceUrl: [''],
    version: [''],
    locations: [''],
    relatedAssets: [''],
    licenseExpression: ['NOASSERTION', [Validators.required]],
    licenseIds: [''],
    commercialUse: this.formBuilder.nonNullable.control<PermissionStatus>(
      PermissionStatus.Unknown,
      Validators.required,
    ),
    redistribution: this.formBuilder.nonNullable.control<PermissionStatus>(
      PermissionStatus.Unknown,
      Validators.required,
    ),
    obligations: [''],
    attribution: [''],
    evidenceSource: [''],
    notes: [''],
  });

  protected readonly canManage = this.viewer.canEditLicensing;

  protected readonly apiDocsUrl = computed(() => {
    const basePath = Array.isArray(this.apiBasePath) ? this.apiBasePath[0] : this.apiBasePath;
    return `${basePath.replace(/\/$/, '')}/docs#/licensing`;
  });

  protected readonly reviewedCommercialCount = computed(() => {
    const summary = this.summary();
    if (!summary) return 0;
    return summary.total_assets - (summary.commercial_use[PermissionStatus.Unknown] ?? 0);
  });

  protected readonly coveragePercent = computed(() => {
    const summary = this.summary();
    if (!summary?.total_assets) return 0;
    return Math.round((this.reviewedCommercialCount() / summary.total_assets) * 100);
  });

  protected readonly firstAssetNumber = computed(() =>
    this.assetTotal() === 0 ? 0 : this.assetOffset() + 1,
  );
  protected readonly lastAssetNumber = computed(() =>
    Math.min(this.assetOffset() + this.assets().length, this.assetTotal()),
  );
  protected readonly hasPreviousAssets = computed(() => this.assetOffset() > 0);
  protected readonly hasNextAssets = computed(
    () => this.assetOffset() + this.assets().length < this.assetTotal(),
  );

  ngOnInit(): void {
    this.shellContext.setContext({
      breadcrumb: [{ label: 'Catalog' }, { label: 'Licensing', route: ['/licensing'] }],
      title: 'Licensing',
      sub: 'Reviewed permissions, reusable license definitions, and source evidence.',
      actions: [],
    });
    this.loadInitialData();
  }

  ngOnDestroy(): void {
    this.shellContext.clearContext();
  }

  protected setTab(tab: LicensingTab): void {
    this.activeTab.set(tab);
    this.closeEditor();
  }

  protected applyFilters(): void {
    this.assetOffset.set(0);
    this.loadAssets();
  }

  protected clearFilters(): void {
    this.filterForm.reset();
    this.assetOffset.set(0);
    this.loadAssets();
  }

  protected previousAssets(): void {
    if (!this.hasPreviousAssets()) return;
    this.assetOffset.update((offset) => Math.max(0, offset - PAGE_SIZE));
    this.loadAssets();
  }

  protected nextAssets(): void {
    if (!this.hasNextAssets()) return;
    this.assetOffset.update((offset) => offset + PAGE_SIZE);
    this.loadAssets();
  }

  protected openNewDefinition(): void {
    if (!this.canManage()) return;
    this.editingDefinitionId.set(null);
    this.definitionForm.reset({
      licenseId: '',
      name: '',
      spdxIdentifier: '',
      canonicalUrl: '',
      commercialUse: PermissionStatus.Unknown,
      redistribution: PermissionStatus.Unknown,
      obligations: '',
      restrictions: '',
      notes: '',
      deprecated: false,
    });
    this.editorKind.set('definition');
  }

  protected openDefinitionEditor(definition: LicenseDefinition): void {
    if (!this.canManage()) return;
    this.editingDefinitionId.set(definition.license_id);
    this.definitionForm.reset({
      licenseId: definition.license_id,
      name: definition.name,
      spdxIdentifier: definition.spdx_identifier ?? '',
      canonicalUrl: definition.canonical_url,
      commercialUse: definition.commercial_use,
      redistribution: definition.redistribution,
      obligations: (definition.obligations ?? []).join(', '),
      restrictions: (definition.restrictions ?? []).join('\n'),
      notes: definition.notes ?? '',
      deprecated: definition.deprecated ?? false,
    });
    this.editorKind.set('definition');
  }

  protected saveDefinition(): void {
    if (!this.canManage() || this.definitionForm.invalid || this.saving()) {
      this.definitionForm.markAllAsTouched();
      return;
    }

    const value = this.definitionForm.getRawValue();
    const definition: LicenseDefinition = {
      license_id: value.licenseId.trim(),
      name: value.name.trim(),
      canonical_url: value.canonicalUrl.trim(),
      commercial_use: value.commercialUse,
      redistribution: value.redistribution,
      obligations: this.obligationList(value.obligations),
      restrictions: this.lineSeparated(value.restrictions),
      deprecated: value.deprecated,
      ...(value.spdxIdentifier.trim() ? { spdx_identifier: value.spdxIdentifier.trim() } : {}),
      ...(value.notes.trim() ? { notes: value.notes.trim() } : {}),
    };

    const editingId = this.editingDefinitionId();
    const request$: Observable<LicenseDefinition> = editingId
      ? this.api.replaceLicenseDefinition(editingId, definition)
      : this.api.createLicenseDefinition(definition);

    this.saving.set(true);
    request$
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (saved) => {
          this.definitions.update((definitions) =>
            [...definitions.filter((item) => item.license_id !== saved.license_id), saved].sort(
              (a, b) => a.license_id.localeCompare(b.license_id),
            ),
          );
          this.notifications.success(
            `${saved.license_id} was ${editingId ? 'updated' : 'created'}.`,
          );
          this.closeEditor();
          this.refreshSummary();
        },
        error: () => this.notifications.error('The license definition could not be saved.'),
      });
  }

  protected deleteDefinition(definition: LicenseDefinition): void {
    if (
      !this.canManage() ||
      !window.confirm(
        `Delete ${definition.license_id}? Definitions referenced by assets cannot be deleted.`,
      )
    ) {
      return;
    }

    this.api
      .deleteLicenseDefinition(definition.license_id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.definitions.update((items) =>
            items.filter((item) => item.license_id !== definition.license_id),
          );
          this.notifications.success(`${definition.license_id} was deleted.`);
          this.refreshSummary();
        },
        error: () =>
          this.notifications.error(
            `${definition.license_id} could not be deleted. It may still be referenced.`,
          ),
      });
  }

  protected openNewAsset(): void {
    if (!this.canManage()) return;
    this.editingAssetKey.set(null);
    this.assetForm.reset({
      assetKind: LicensedAssetKind.SoftwareComponent,
      assetIdentifier: '',
      displayName: '',
      sourceUrl: '',
      version: '',
      locations: '',
      relatedAssets: '',
      licenseExpression: 'NOASSERTION',
      licenseIds: '',
      commercialUse: PermissionStatus.Unknown,
      redistribution: PermissionStatus.Unknown,
      obligations: '',
      attribution: '',
      evidenceSource: '',
      notes: '',
    });
    this.editorKind.set('asset');
  }

  protected openAssetEditor(asset: LicensedAssetView): void {
    if (!this.canManage() || asset.asset_kind === 'model') return;
    const kind = asset.asset_kind as LicensedAssetKind;
    this.editingAssetKey.set({ kind, identifier: asset.asset_identifier });
    this.assetForm.reset({
      assetKind: kind,
      assetIdentifier: asset.asset_identifier,
      displayName: asset.display_name,
      sourceUrl: asset.source_url ?? '',
      version: asset.version ?? '',
      locations: (asset.locations ?? []).join('\n'),
      relatedAssets: (asset.related_assets ?? []).join('\n'),
      licenseExpression: asset.licensing.license_expression,
      licenseIds: (asset.licensing.license_ids ?? []).join(', '),
      commercialUse: asset.licensing.commercial_use,
      redistribution: asset.licensing.redistribution,
      obligations: (asset.licensing.obligations ?? []).join(', '),
      attribution: asset.licensing.attribution ?? '',
      evidenceSource: asset.licensing.evidence?.[0]?.source ?? '',
      notes: asset.notes ?? asset.licensing.notes ?? '',
    });
    this.editorKind.set('asset');
  }

  protected saveAsset(): void {
    if (!this.canManage() || this.assetForm.invalid || this.saving()) {
      this.assetForm.markAllAsTouched();
      return;
    }

    const value = this.assetForm.getRawValue();
    const asset: LicensedAsset = {
      asset_kind: value.assetKind,
      asset_identifier: value.assetIdentifier.trim(),
      display_name: value.displayName.trim(),
      locations: this.lineSeparated(value.locations),
      related_assets: this.lineSeparated(value.relatedAssets),
      licensing: {
        license_expression: value.licenseExpression.trim(),
        license_ids: this.commaSeparated(value.licenseIds),
        commercial_use: value.commercialUse,
        redistribution: value.redistribution,
        obligations: this.obligationList(value.obligations),
        ...(value.attribution.trim() ? { attribution: value.attribution.trim() } : {}),
        ...(value.evidenceSource.trim()
          ? { evidence: [{ source: value.evidenceSource.trim() }] }
          : {}),
      },
      ...(value.sourceUrl.trim() ? { source_url: value.sourceUrl.trim() } : {}),
      ...(value.version.trim() ? { version: value.version.trim() } : {}),
      ...(value.notes.trim() ? { notes: value.notes.trim() } : {}),
    };

    const editingKey = this.editingAssetKey();
    const request$: Observable<LicensedAsset> = editingKey
      ? this.api.replaceLicensedAsset(editingKey.kind, editingKey.identifier, asset)
      : this.api.createLicensedAsset(asset);

    this.saving.set(true);
    request$
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (saved) => {
          this.notifications.success(
            `${saved.display_name} was ${editingKey ? 'updated' : 'created'}.`,
          );
          this.closeEditor();
          this.loadAssets();
          this.refreshSummary();
        },
        error: () => this.notifications.error('The licensed asset could not be saved.'),
      });
  }

  protected deleteAsset(asset: LicensedAssetView): void {
    if (
      !this.canManage() ||
      asset.asset_kind === 'model' ||
      !window.confirm(`Delete the licensing record for ${asset.display_name}?`)
    ) {
      return;
    }

    this.api
      .deleteLicensedAsset(asset.asset_kind as LicensedAssetKind, asset.asset_identifier)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.notifications.success(`${asset.display_name} was deleted.`);
          this.loadAssets();
          this.refreshSummary();
        },
        error: () => this.notifications.error(`${asset.display_name} could not be deleted.`),
      });
  }

  protected closeEditor(): void {
    this.editorKind.set(null);
    this.editingDefinitionId.set(null);
    this.editingAssetKey.set(null);
  }

  protected permissionLabel(status: string): string {
    switch (status) {
      case PermissionStatus.Allowed:
        return 'Allowed';
      case PermissionStatus.AllowedWithConditions:
        return 'Allowed with conditions';
      case PermissionStatus.Prohibited:
        return 'Prohibited';
      default:
        return 'Unknown';
    }
  }

  protected permissionClass(status: string): string {
    switch (status) {
      case PermissionStatus.Allowed:
        return 'permission permission--allowed';
      case PermissionStatus.AllowedWithConditions:
        return 'permission permission--conditional';
      case PermissionStatus.Prohibited:
        return 'permission permission--prohibited';
      default:
        return 'permission permission--unknown';
    }
  }

  protected categoryLabel(category: MODEL_REFERENCE_CATEGORY | null | undefined): string {
    return category
      ? (RECORD_DISPLAY_MAP[category] ?? this.assetKindLabel(category))
      : 'Non-model asset';
  }

  protected sourceSite(url: string): string {
    try {
      return new URL(url).hostname.replace(/^www\./i, '');
    } catch {
      return 'external site';
    }
  }

  protected isModelFileUrl(url: string): boolean {
    try {
      const pathname = decodeURIComponent(new URL(url).pathname);
      const extension = pathname.split('.').pop()?.toLowerCase();
      return extension ? MODEL_FILE_EXTENSIONS.has(extension) : false;
    } catch {
      return false;
    }
  }

  protected assetKindLabel(kind: string): string {
    if (kind === 'model') return 'Model';
    return kind
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  protected modelRoute(asset: LicensedAssetView): unknown[] | null {
    if (!asset.category) return null;
    const prefix = asset.category + ':';
    const modelName = asset.asset_identifier.startsWith(prefix)
      ? asset.asset_identifier.slice(prefix.length)
      : asset.display_name;
    return ['/categories', asset.category, 'model', modelName];
  }

  protected trackAsset(_index: number, asset: LicensedAssetView): string {
    return `${asset.asset_kind}:${asset.asset_identifier}`;
  }

  private loadInitialData(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      summary: this.api.getLicensingSummary(),
      definitions: this.api.listLicenseDefinitions(true),
      assets: this.api.listLicensedAssets({ offset: 0, limit: PAGE_SIZE }),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ summary, definitions, assets }) => {
          this.summary.set(summary);
          this.definitions.set(definitions.items);
          this.assets.set(assets.items);
          this.assetTotal.set(assets.total);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Licensing data could not be loaded. Please try again.');
          this.loading.set(false);
        },
      });
  }

  private loadAssets(): void {
    const value = this.filterForm.getRawValue();
    const filters: LicensedAssetFilters = {
      offset: this.assetOffset(),
      limit: PAGE_SIZE,
      ...(value.query.trim() ? { nameContains: value.query.trim() } : {}),
      ...(value.assetKind ? { assetKind: value.assetKind } : {}),
      ...(value.category ? { category: value.category as MODEL_REFERENCE_CATEGORY } : {}),
      ...(value.licenseId ? { licenseId: value.licenseId } : {}),
      ...(value.commercialUse ? { commercialUse: value.commercialUse as PermissionStatus } : {}),
      ...(value.redistribution ? { redistribution: value.redistribution as PermissionStatus } : {}),
    };

    this.assetsLoading.set(true);
    this.api
      .listLicensedAssets(filters)
      .pipe(
        finalize(() => this.assetsLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (page) => {
          this.assets.set(page.items);
          this.assetTotal.set(page.total);
        },
        error: () => this.notifications.error('Licensed assets could not be refreshed.'),
      });
  }

  private refreshSummary(): void {
    this.api
      .getLicensingSummary()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (summary) => this.summary.set(summary) });
  }

  private commaSeparated(value: string): string[] {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private obligationList(value: string): LicenseObligation[] {
    const known = new Set<string>(Object.values(LicenseObligation));
    return this.commaSeparated(value).filter((item): item is LicenseObligation => known.has(item));
  }

  private lineSeparated(value: string): string[] {
    return value
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
}
