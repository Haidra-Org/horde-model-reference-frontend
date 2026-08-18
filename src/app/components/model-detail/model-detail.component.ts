import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { ModelReferenceApiService } from '../../services/model-reference-api.service';
import { ShellContextService } from '../../services/shell-context.service';
import { PendingQueueSummaryService } from '../../services/pending-queue-summary.service';
import { ViewerCapabilitiesService } from '../../services/viewer-capabilities.service';
import { ModelIdentityRailComponent } from './identity-rail.component';
import { StatTileComponent } from './stat-tile.component';
import { OverviewTabComponent } from './overview-tab.component';
import { FilesTabComponent } from './files-tab.component';
import { RawJsonTabComponent } from './raw-json-tab.component';
import { RiskTabComponent } from './risk-tab.component';
import { LicensingTabComponent } from './licensing-tab.component';
import { TextGuidanceTabComponent } from './text-guidance-tab.component';
import { ConfirmationModalComponent } from '../common/confirmation-modal/confirmation-modal.component';
import { RECORD_DISPLAY_MAP, BASELINE_SHORTHAND_MAP } from '../../models/maps';
import { domainMeta } from '../../shared/domain';
import { toBrowseModel } from '../../services/browse-models.service';
import type { BrowseModel } from '../../services/browse-models.service';
import type { BackendCombinedModelStatistics } from '../../models/api.models';
import type { ModelDeletionRiskInfo } from '../../api-client/model/modelDeletionRiskInfo';
import type { PendingChangeOverlay } from '../../models/pending-change-overlay';
import { NotificationService } from '../../services/notification.service';
import { MODEL_REFERENCE_CATEGORY, type GroupMembersResponse } from '../../api-client';

type DetailTab = 'overview' | 'guidance' | 'licensing' | 'files' | 'json' | 'risk';

const TAB_LABELS: { id: DetailTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'guidance', label: 'Usage guidance' },
  { id: 'licensing', label: 'Licensing' },
  { id: 'files', label: 'Files & checksums' },
  { id: 'json', label: 'Raw JSON' },
  { id: 'risk', label: 'Availability' },
];

/** Label for the availability tab once it also carries the deletion-risk verdict. */
const CURATION_RISK_TAB_LABEL = 'Availability & risk';

const HORDE_RUNTIME_CATEGORIES = new Set(['image_generation', 'text_generation']);

@Component({
  selector: 'app-model-detail',
  imports: [
    RouterLink,
    ModelIdentityRailComponent,
    StatTileComponent,
    OverviewTabComponent,
    FilesTabComponent,
    RawJsonTabComponent,
    RiskTabComponent,
    LicensingTabComponent,
    TextGuidanceTabComponent,
    ConfirmationModalComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Topbar breadcrumb, title, and actions are set via ShellContextService in ngOnInit -->

    <div class="detail-layout">
      <!-- Loading -->
      @if (loading()) {
        <div class="glass-inflow" style="padding:40px;text-align:center">
          <p style="color:var(--color-content-muted)">Loading model…</p>
        </div>
      }

      <!-- Not found -->
      @if (!loading() && !model()) {
        <div class="glass-inflow" style="padding:40px;text-align:center;margin:26px">
          <p style="font-size:15px;font-weight:600;color:var(--color-content-secondary)">
            Model not found
          </p>
          <p style="font-size:13px;color:var(--color-content-muted);margin-top:4px">
            It may have been removed.
          </p>
        </div>
      }

      <!-- Model loaded -->
      @if (model(); as m) {
        <!-- Pending banner -->
        @if (pendingOverlay()) {
          <div
            class="detail-pending-banner"
            style="background:var(--color-pending-surface);border:1px solid var(--color-pending-border)"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--color-accent-pending)"
              style="flex-shrink:0"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div style="flex:1">
              <div style="font-weight:700;font-size:13.5px;color:var(--color-accent-pending)">
                This model has a {{ pendingOpLabel() }} (#{{ pendingOverlay()!.pendingChangeId }})
              </div>
              <div style="font-size:12.5px;color:var(--color-content-secondary)">
                Proposed · status {{ pendingOverlay()!.pendingRecord.status ?? 'pending' }}
              </div>
            </div>
            <a
              class="btn btn-ghost btn-sm"
              [routerLink]="['/pending-queue']"
              [queryParams]="{ focus: pendingOverlay()!.pendingChangeId }"
            >
              Review change
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </a>
          </div>
        }

        @if (isText()) {
          <nav
            class="text-hierarchy-path text-hierarchy-path--detail"
            aria-label="Text model hierarchy"
          >
            @if (textFamilyName(); as familyName) {
              <a [routerLink]="['/text-groups']" [queryParams]="{ families: familyName }">
                <span>Family</span><strong>{{ familyName }}</strong>
              </a>
              <span aria-hidden="true">›</span>
            }
            @if (textGroupName(); as groupName) {
              <a [routerLink]="['/text-groups/group']" [queryParams]="{ name: groupName }">
                <span>Group</span><strong>{{ groupName }}</strong>
              </a>
              <span aria-hidden="true">›</span>
            }
            <div>
              <span>Exact model record</span><strong>{{ m.name }}</strong>
            </div>
            @if (textGroupName(); as groupName) {
              <a
                class="text-hierarchy-path__catalog-link"
                [routerLink]="['/categories', 'text_generation']"
                [queryParams]="{ groups: groupName }"
                >Compare group models</a
              >
            }
          </nav>
        }

        <div class="detail-grid">
          <!-- LEFT: Identity rail -->
          <app-model-identity-rail [model]="m" [showcaseSrc]="showcaseSrc()" />

          <!-- RIGHT: Content -->
          <div>
            <!-- Stat tiles -->
            <div class="detail-stat-tiles">
              <app-stat-tile
                icon="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"
                label="Workers"
                [value]="workerCount()"
                [accent]="dmn().accentClass"
                [sub]="workerSub()"
                [loading]="statsLoading()"
              />
              <app-stat-tile
                icon="M13 10V3L4 14h7v7l9-11h-7z"
                label="Usage 30d"
                [value]="usageMonth()"
                [accent]="dmn().accentClass"
                [sub]="usageSub()"
                [loading]="statsLoading()"
              />
              @if (isText()) {
                <app-stat-tile
                  icon="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                  label="Parameters"
                  [value]="paramsDisplay()"
                  [accent]="dmn().accentClass"
                  [sub]="instructFormat()"
                />
              } @else {
                <app-stat-tile
                  icon="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"
                  label="Baseline"
                  [value]="baselineShort()"
                  [accent]="dmn().accentClass"
                />
              }
              <app-stat-tile
                icon="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                label="On disk"
                [value]="diskSize()"
                [accent]="dmn().accentClass"
                [sub]="downloadCount()"
              />
            </div>

            @if (isText() && runtimeCeilings(); as runtime) {
              <section class="runtime-ceilings" aria-label="Live worker capabilities">
                <div>
                  <span>Live worker ceiling</span><strong>{{ runtime.context }}</strong
                  ><small>maximum context observed</small>
                </div>
                <div>
                  <span>Output ceiling</span><strong>{{ runtime.output }}</strong
                  ><small>maximum generation length</small>
                </div>
                <div>
                  <span>Worker software</span><strong>{{ runtime.bridges }}</strong
                  ><small>public bridge variants</small>
                </div>
                <p>
                  Live worker limits can change and do not replace the reviewed model metadata in
                  Overview.
                </p>
              </section>
            }

            <!-- Tabs -->
            <nav class="detail-tabs" role="tablist" [attr.aria-label]="'Model detail sections'">
              @for (tab of tabList(); track tab.id) {
                <button
                  type="button"
                  class="detail-tab"
                  role="tab"
                  [id]="'model-detail-tab-' + tab.id"
                  [attr.aria-controls]="'model-detail-panel-' + tab.id"
                  [attr.aria-selected]="activeTab() === tab.id"
                  [attr.tabindex]="activeTab() === tab.id ? 0 : -1"
                  [style.color]="activeTab() === tab.id ? dmn().accentClass : ''"
                  [style.borderBottomColor]="activeTab() === tab.id ? dmn().accentClass : ''"
                  (click)="setTab(tab.id)"
                  (keydown)="onTabKeydown($event, $index)"
                >
                  {{ tab.label }}
                </button>
              }
            </nav>

            <!-- Tab panels -->
            <div
              class="detail-tab-panel"
              role="tabpanel"
              tabindex="0"
              [id]="'model-detail-panel-' + activeTab()"
              [attr.aria-labelledby]="'model-detail-tab-' + activeTab()"
            >
              @switch (activeTab()) {
                @case ('overview') {
                  <app-overview-tab [model]="m" [isImage]="isImage()" [isText]="isText()" />
                }
                @case ('licensing') {
                  <app-licensing-tab [model]="m" />
                }
                @case ('guidance') {
                  <app-text-guidance-tab [modelName]="m.name" />
                }
                @case ('files') {
                  <app-files-tab [model]="m" />
                }
                @case ('json') {
                  <app-raw-json-tab [model]="m" />
                }
                @case ('risk') {
                  <app-risk-tab [riskData]="riskData()" [showRisk]="showCurationSignals()" />
                }
              }
            </div>
          </div>
        </div>
      }

      <app-confirmation-modal
        [open]="deleteDialogOpen()"
        severity="delete"
        title="Propose model removal"
        [message]="'This submits a reviewable deletion; the model is not removed until an approver applies it.'"
        confirmText="Submit removal proposal"
        [loading]="deleteSubmitting()"
        [confirmDisabled]="deleteConfirmationText() !== _modelName()"
        (confirmed)="confirmDeletion()"
        (cancelled)="closeDeleteDialog()"
      >
        <div class="form-group">
          <label class="form-label" for="delete-model-confirmation">
            Type <strong>{{ _modelName() }}</strong> to confirm
          </label>
          <input
            id="delete-model-confirmation"
            class="form-input"
            autocomplete="off"
            [value]="deleteConfirmationText()"
            (input)="updateDeleteConfirmation($event)"
          />
          @if (deleteError()) {
            <p class="form-error" role="alert">{{ deleteError() }}</p>
          }
        </div>
      </app-confirmation-modal>
    </div>
  `,
})
export class ModelDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(ModelReferenceApiService);
  private readonly shellContext = inject(ShellContextService);
  private readonly pendingSummary = inject(PendingQueueSummaryService);
  private readonly viewer = inject(ViewerCapabilitiesService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly model = signal<BrowseModel | null>(null);
  protected readonly stats = signal<BackendCombinedModelStatistics | null>(null);
  protected readonly statsLoading = signal(false);
  protected readonly riskData = signal<ModelDeletionRiskInfo | null>(null);
  protected readonly textGroupData = signal<GroupMembersResponse | null>(null);
  protected readonly activeTab = signal<DetailTab>('overview');
  protected readonly deleteDialogOpen = signal(false);
  protected readonly deleteConfirmationText = signal('');
  protected readonly deleteSubmitting = signal(false);
  protected readonly deleteError = signal<string | null>(null);

  private readonly _category = signal('');
  protected readonly _modelName = signal('');

  protected readonly dmn = computed(() => domainMeta(this._category()));
  protected readonly isImage = computed(() => this.dmn().domain === 'image');
  protected readonly isText = computed(() => this.dmn().domain === 'text');
  protected readonly textGroupName = computed(() => this.model()?.text_model_group ?? null);
  protected readonly textFamilyName = computed(
    () =>
      this.textGroupData()?.related_family?.family_name ?? this.model()?.text_group_family ?? null,
  );

  protected readonly showCurationSignals = this.viewer.canSeeCuration;

  protected readonly tabList = computed(() =>
    TAB_LABELS.filter((tab) => tab.id !== 'guidance' || this.isText()).map((tab) =>
      tab.id === 'risk' && this.showCurationSignals()
        ? { ...tab, label: CURATION_RISK_TAB_LABEL }
        : tab,
    ),
  );

  protected readonly canWrite = this.viewer.canPropose;
  protected readonly canProposeDeletion = computed(
    () => this.canWrite() && this.pendingOverlay() === null,
  );

  protected readonly showcaseSrc = computed(() => {
    const raw = this.model()?._raw as Record<string, unknown> | undefined;
    const showcases = raw?.['showcases'] as string[] | undefined;
    return showcases?.[0] ?? null;
  });

  // ---- Stat tile values ----

  protected readonly workerCount = computed(() => {
    const s = this.stats();
    if (s?.worker_count != null) return s.worker_count;
    return '—';
  });

  protected readonly workerSub = computed(() => {
    const w = this.stats()?.worker_count;
    if (w == null) return undefined;
    return w === 0 ? 'none serving' : 'serving now';
  });

  protected readonly usageMonth = computed(() => {
    const u = this.stats()?.usage_stats?.month;
    return u != null ? this.fmtNum(u) : '—';
  });

  protected readonly usageSub = computed(() => {
    const u = this.stats()?.usage_stats?.total;
    return u != null ? `${this.fmtNum(u)} all-time` : undefined;
  });

  protected readonly diskSize = computed(() => {
    const b = this.model()?.size_on_disk_bytes;
    return b != null ? this.fmtBytes(b) : '—';
  });

  protected readonly downloadCount = computed(() => {
    const raw = this.model()?._raw as Record<string, unknown> | undefined;
    const dl = (raw?.['config'] as { download?: unknown[] } | undefined)?.download;
    return dl?.length ? `${dl.length} file(s)` : undefined;
  });

  protected readonly baselineShort = computed(() => {
    const b = this.model()?.baseline;
    if (!b) return '—';
    return BASELINE_SHORTHAND_MAP[b] ?? b;
  });

  protected readonly paramsDisplay = computed(() => {
    const p = this.model()?.parameters_count;
    if (p == null) return '—';
    return this.fmtParams(p);
  });

  protected readonly instructFormat = computed(() => {
    const raw = this.model()?._raw as Record<string, unknown> | undefined;
    return (raw?.['instruct_format'] as string) ?? undefined;
  });

  protected readonly runtimeCeilings = computed(() => {
    const summaries = Object.values(this.stats()?.worker_summaries ?? {});
    if (summaries.length === 0) return null;
    const maximumContext = Math.max(...summaries.map((worker) => worker.max_context_length ?? 0));
    const maximumOutput = Math.max(...summaries.map((worker) => worker.max_length ?? 0));
    const bridgeVariants = new Set(summaries.map((worker) => worker.bridge_agent).filter(Boolean))
      .size;
    return {
      context: maximumContext ? `${maximumContext.toLocaleString()} tokens` : 'Not advertised',
      output: maximumOutput ? `${maximumOutput.toLocaleString()} tokens` : 'Not advertised',
      bridges: bridgeVariants ? String(bridgeVariants) : 'Not advertised',
    };
  });

  // ---- Pending overlay ----

  protected readonly pendingOverlay = computed<PendingChangeOverlay | null>(() => {
    const m = this.model();
    if (!m?._pending) return null;
    return m._pending;
  });

  protected readonly pendingOpLabel = computed(() => {
    const op = this.pendingOverlay()?.pendingOperation;
    switch (op) {
      case 'create':
        return 'pending addition';
      case 'delete':
        return 'pending removal';
      default:
        return 'pending edit';
    }
  });

  // ---- Lifecycle ----

  constructor() {
    // Topbar actions depend on auth roles and backend capabilities, which can
    // resolve after the model loads — keep the shell context reactive to both.
    effect(() => {
      const m = this.model();
      if (m) this.setShellContext(this._category(), m);
    });
  }

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const cat = params.get('category') ?? '';
      const name = params.get('modelName') ?? '';
      this._category.set(cat);
      this._modelName.set(name);
      this.loadModel(cat, name);
    });

    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((qp) => {
      const tab = qp.get('tab') as DetailTab | null;
      if (tab && this.tabList().some((t) => t.id === tab)) {
        this.activeTab.set(tab);
      }
    });
  }

  // ---- Data loading ----

  private loadModel(category: string, modelName: string): void {
    this.loading.set(true);
    this.model.set(null);
    this.stats.set(null);
    this.riskData.set(null);
    this.textGroupData.set(null);
    this.statsLoading.set(false);

    const models$ =
      category === 'text_generation'
        ? this.api.getModelsInCategory(category).pipe(map((response) => Object.values(response)))
        : this.api.getDisplayModelsAsArray(category);

    models$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (models) => {
        const raw = models.find(
          (m) =>
            (m as Record<string, unknown>)['name'] === modelName ||
            (m as Record<string, unknown>)['display_name'] === modelName,
        );

        if (!raw) {
          this.loading.set(false);
          return;
        }

        const m = toBrowseModel(raw as Record<string, unknown>, category);
        this.model.set(m);
        this.loading.set(false);

        if (category === 'text_generation' && m.text_model_group) {
          this.loadTextHierarchy(m.text_model_group);
        }

        if (HORDE_RUNTIME_CATEGORIES.has(category)) {
          this.loadStats(category, modelName);
          this.loadRisk(category);
        }
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  private loadTextHierarchy(groupName: string): void {
    this.api
      .getGroupMembers(groupName)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (group) => {
          this.textGroupData.set(group);
          const current = this.model();
          if (current) {
            this.model.set({
              ...current,
              text_group_family: group.related_family?.family_name ?? null,
            });
          }
        },
      });
  }

  private loadStats(category: string, modelName: string): void {
    this.statsLoading.set(true);
    this.api
      // Match the query variant the browse view uses so the backend cache is shared
      .getModelsWithStats(category, category === 'text_generation', category === 'text_generation')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.statsLoading.set(false);
          if (response) {
            const entry = response[modelName] ?? response[this.model()?.display_name ?? ''];
            if (entry) this.stats.set(entry);
          }
        },
        error: () => {
          this.statsLoading.set(false);
        },
      });
  }

  private loadRisk(category: string): void {
    this.api
      .getCategoryAudit(category)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const match = response?.models?.find(
            (rm: ModelDeletionRiskInfo) => rm.name === this._modelName(),
          );
          if (match) this.riskData.set(match);
        },
      });
  }

  // ---- Shell context ----

  private setShellContext(category: string, model: BrowseModel): void {
    const catDisplay = RECORD_DISPLAY_MAP[category] ?? category;
    const displayName = model.display_name ?? model.name;

    this.shellContext.setContext({
      breadcrumb: [{ label: catDisplay, route: ['/categories', category] }, { label: displayName }],
      title: displayName,
      actions: [
        ...(this.canWrite()
          ? [
              {
                id: 'edit',
                label: 'Edit',
                icon: 'pencil',
                action: () => this.router.navigate(['/categories', category, 'edit', model.name]),
              },
            ]
          : []),
        ...(this.canProposeDeletion()
          ? [
              {
                id: 'delete',
                label: 'Propose removal',
                icon: 'trash',
                kind: 'ghost' as const,
                action: () => this.openDeleteDialog(),
              },
            ]
          : []),
        ...(this.homepage(model)
          ? [
              {
                id: 'homepage',
                label: 'Homepage',
                icon: 'external',
                action: () => window.open(this.homepage(model)!, '_blank', 'noopener'),
              },
            ]
          : []),
      ],
    });
  }

  private homepage(model: BrowseModel): string | null {
    return ((model._raw as Record<string, unknown>)?.['homepage'] as string) ?? null;
  }

  private openDeleteDialog(): void {
    this.deleteConfirmationText.set('');
    this.deleteError.set(null);
    this.deleteDialogOpen.set(true);
  }

  protected closeDeleteDialog(): void {
    if (this.deleteSubmitting()) return;
    this.deleteDialogOpen.set(false);
    this.deleteConfirmationText.set('');
    this.deleteError.set(null);
  }

  protected updateDeleteConfirmation(event: Event): void {
    this.deleteConfirmationText.set((event.target as HTMLInputElement).value);
  }

  protected confirmDeletion(): void {
    const modelName = this._modelName();
    if (this.deleteConfirmationText() !== modelName || this.deleteSubmitting()) return;

    this.deleteSubmitting.set(true);
    this.deleteError.set(null);
    this.api
      .submitProposal({
        operation: 'delete',
        category: this._category() as MODEL_REFERENCE_CATEGORY,
        model_name: modelName,
        payload: {},
        diff: [
          {
            field: '(model)',
            before: modelName,
            after: null,
            kind: 'delete',
          },
        ],
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (change) => {
          this.deleteSubmitting.set(false);
          this.deleteDialogOpen.set(false);
          this.notifications.success(`Removal proposal #${change.change_id} submitted for review`);
          void this.router.navigate(['/pending-queue'], {
            queryParams: { focus: change.change_id },
          });
        },
        error: (error: unknown) => {
          this.deleteSubmitting.set(false);
          const message =
            error instanceof Error ? error.message : 'Unable to submit removal proposal';
          this.deleteError.set(message);
          this.notifications.error(message);
        },
      });
  }

  // ---- Tab switching ----

  protected setTab(tab: DetailTab): void {
    this.activeTab.set(tab);
    this.router.navigate([], {
      queryParams: { tab },
      queryParamsHandling: 'merge',
      replaceUrl: true,
      relativeTo: this.route,
    });
  }

  protected onTabKeydown(event: KeyboardEvent, currentIndex: number): void {
    const tabsForModel = this.tabList();
    let nextIndex = currentIndex;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabsForModel.length;
    else if (event.key === 'ArrowLeft')
      nextIndex = (currentIndex - 1 + tabsForModel.length) % tabsForModel.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = tabsForModel.length - 1;
    else return;

    event.preventDefault();
    this.setTab(tabsForModel[nextIndex].id);
    const tabList = (event.currentTarget as HTMLElement).closest('[role="tablist"]');
    const tabs = tabList?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    tabs?.[nextIndex]?.focus();
  }

  // ---- Formatting helpers ----

  private fmtNum(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
    return String(n);
  }

  private fmtBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  private fmtParams(n: number): string {
    if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
    if (n >= 1e6) return `${(n / 1e6).toFixed(0)}M`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
    return String(n);
  }
}
