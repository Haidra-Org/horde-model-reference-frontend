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
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CategoryRailComponent } from './category-rail/category-rail.component';
import { BrowseToolbarComponent } from './browse-toolbar/browse-toolbar.component';
import { FilterChipsComponent } from './filter-chips/filter-chips.component';
import { ModelTableComponent } from './model-table/model-table.component';
import { ModelCardsComponent } from './model-cards/model-cards.component';
import { ModelGalleryComponent } from './model-gallery/model-gallery.component';
import { BrowseModelsStore } from '../../services/browse-models.service';
import type { BrowseModel } from '../../services/browse-models.service';
import { ShellContextService } from '../../services/shell-context.service';
import { ModelReferenceApiService } from '../../services/model-reference-api.service';
import { AuthService } from '../../services/auth.service';
import { RECORD_DISPLAY_MAP } from '../../models/maps';
import { domainMeta } from '../../shared/domain';
import { DEFAULT_CATEGORY } from '../../shared/constants';
import type { SegmentedOption } from '../../../shared/design-system/components/segmented-control/segmented-control.component';
import type { PendingChangeOverlay } from '../../models/pending-change-overlay';

@Component({
  selector: 'app-browse-view',
  imports: [
    CategoryRailComponent,
    BrowseToolbarComponent,
    FilterChipsComponent,
    ModelTableComponent,
    ModelCardsComponent,
    ModelGalleryComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="browse-layout">
      <!-- Category rail -->
      <app-category-rail
        [activeCategory]="store.category()"
        [counts]="store.categoryCounts()"
        [categories]="allCategoryNames()"
      />

      <!-- Toolbar -->
      <app-browse-toolbar
        [searchQuery]="store.searchQuery()"
        (searchQueryChange)="store.searchQuery.set($event)"
        [sortKey]="store.sortKey()"
        (sortKeyChange)="store.sortKey.set($event)"
        [viewMode]="store.viewMode()"
        (viewModeChange)="store.viewMode.set($event)"
        [isImageDomain]="store.isImageDomain()"
        [resultCount]="store.resultCount()"
        [placeholderCategory]="categoryDisplayName()"
        [sortOptions]="sortOptions()"
        [layoutOptions]="layoutOptions()"
      />

      <!-- Filter chips -->
      @if ((store.isImageDomain() || store.isTextDomain()) && !store.loading()) {
        <app-filter-chips
          [facets]="store.facets()"
          [(activeBaselines)]="store.activeBaselines"
          [(activeStyles)]="store.activeStyles"
          [(activeFamilies)]="store.activeFamilies"
          [(nsfwFilter)]="store.nsfwFilter"
          [(pendingOnly)]="store.pendingOnly"
          [hasPending]="store.pendingCount() > 0"
          [isImageDomain]="store.isImageDomain()"
          [isTextDomain]="store.isTextDomain()"
          [showBaselines]="store.isImageDomain() && store.facets().baselines.length > 0"
          [showStyles]="store.isImageDomain() && store.facets().styles.length > 0"
          [showFamilies]="store.isTextDomain() && store.facets().families.length > 0"
          [showSafety]="store.isImageDomain() || store.isTextDomain()"
        />
      }

      <!-- Result count -->
      @if (!store.loading()) {
        <div
          style="font-size:12.5px;color:var(--color-content-muted);margin:0 2px 12px;font-weight:500"
        >
          {{ store.resultCount() }} result{{ store.resultCount() === 1 ? '' : 's' }}
        </div>
      }

      <!-- Loading skeleton -->
      @if (store.loading()) {
        <div class="glass-inflow" style="padding:40px;text-align:center">
          <p style="color:var(--color-content-muted)">Loading models…</p>
        </div>
      }

      <!-- Error state -->
      @if (store.error()) {
        <div class="alert alert--danger">
          {{ store.error() }}
        </div>
      }

      <!-- Empty state -->
      @if (!store.loading() && !store.error() && store.resultCount() === 0) {
        <div class="glass-inflow" style="padding:40px;text-align:center">
          <p style="font-size:15px;font-weight:600;color:var(--color-content-secondary)">
            No models match
          </p>
          <p style="font-size:13px;color:var(--color-content-muted);margin-top:4px">
            Try clearing filters or search.
          </p>
        </div>
      }

      <!-- Active renderer -->
      @if (!store.loading() && !store.error() && store.resultCount() > 0) {
        @switch (store.viewMode()) {
          @case ('table') {
            <app-model-table
              [models]="store.filteredModels()"
              [isImage]="store.isImageDomain()"
              [isText]="store.isTextDomain()"
              [columns]="tableColumns()"
              (modelOpen)="openModel($event)"
              (pendingOpen)="openPending($event)"
            />
          }
          @case ('cards') {
            <app-model-cards
              [models]="store.filteredModels()"
              [isText]="store.isTextDomain()"
              (modelOpen)="openModel($event)"
              (pendingOpen)="openPending($event)"
            />
          }
          @case ('gallery') {
            <app-model-gallery
              [models]="store.filteredModels()"
              (modelOpen)="openModel($event)"
              (pendingOpen)="openPending($event)"
            />
          }
        }
      }
    </div>
  `,
})
export class BrowseViewComponent implements OnInit {
  readonly store: BrowseModelsStore = inject(BrowseModelsStore);
  private readonly shellContext: ShellContextService = inject(ShellContextService);
  private readonly api: ModelReferenceApiService = inject(ModelReferenceApiService);
  readonly auth: AuthService = inject(AuthService);
  private readonly route: ActivatedRoute = inject(ActivatedRoute);
  private readonly router: Router = inject(Router);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  /** All category names from the API for the rail. */
  readonly allCategoryNames = signal<string[]>([]);

  protected readonly categoryDisplayName = computed(() => {
    return RECORD_DISPLAY_MAP[this.store.category()]?.toLowerCase() ?? 'models';
  });

  protected readonly sortOptions = computed<SegmentedOption[]>(() => {
    const opts: SegmentedOption[] = [
      { value: 'usage', label: 'Most used' },
      { value: 'workers', label: 'Most workers' },
      { value: 'name', label: 'Name A–Z' },
    ];
    if (this.store.isTextDomain()) {
      opts.push({ value: 'params', label: 'Parameters' });
    } else {
      opts.push({ value: 'size', label: 'Largest' });
    }
    return opts;
  });

  protected readonly layoutOptions = computed<SegmentedOption[]>(() => {
    const opts: SegmentedOption[] = [
      { value: 'table', label: 'Table', icon: 'table' },
      { value: 'cards', label: 'Cards', icon: 'grid' },
    ];
    if (this.store.isImageDomain()) {
      opts.push({ value: 'gallery', label: 'Gallery', icon: 'image' });
    }
    return opts;
  });

  protected readonly tableColumns = computed<[string, string][]>(() => {
    if (this.store.isTextDomain()) {
      return [
        ['Model', 'left'],
        ['Family', 'left'],
        ['Params', 'right'],
        ['Workers', 'right'],
        ['Usage 30d', 'right'],
        ['Size', 'right'],
        ['Status', 'left'],
      ];
    }
    if (this.store.isImageDomain()) {
      return [
        ['Model', 'left'],
        ['Baseline', 'left'],
        ['Workers', 'right'],
        ['Usage 30d', 'right'],
        ['Size', 'right'],
        ['Status', 'left'],
      ];
    }
    return [
      ['Model', 'left'],
      ['Type', 'left'],
      ['Workers', 'right'],
      ['Usage 30d', 'right'],
      ['Size', 'right'],
      ['Status', 'left'],
    ];
  });

  readonly canWrite = computed(
    () => this.api.backendCapabilities().writable && this.auth.isRequestor(),
  );

  constructor() {
    // Keep the topbar in sync with category, live/pending counts, backend mode
    // and write capability — all of which can change after first render.
    effect(() => {
      this.setShellContext(this.store.category());
    });
  }

  ngOnInit(): void {
    // Load category list for the rail
    this.api
      .getCategories()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (cats) => this.allCategoryNames.set(cats),
      });

    // Load category counts for the rail
    this.store.loadAllCategoryCounts();

    // Subscribe to route params (shell context follows via the constructor effect)
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const cat = params.get('category') || DEFAULT_CATEGORY;
      this.store.loadCategory(cat);
    });

    // Hydrate filters from query params
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((qp) => {
      const params: Record<string, string> = {};
      qp.keys.forEach((k) => {
        const v = qp.get(k);
        if (v !== null) params[k] = v;
      });
      this.store.hydrateFromParams(params);
    });
  }

  private setShellContext(cat: string): void {
    const dm = domainMeta(cat);
    const displayName = RECORD_DISPLAY_MAP[cat] ?? cat;
    const caps = this.api.backendCapabilities();
    const liveCount = this.store.mergedModels().filter((m) => !m._ghost).length;
    const pendingCount = this.store.pendingCount();
    const sub = this.store.loading()
      ? ''
      : `${liveCount} live model${liveCount === 1 ? '' : 's'}` +
        (pendingCount > 0 ? ` · ${pendingCount} pending` : '') +
        (caps.mode !== 'UNKNOWN'
          ? ` · ${caps.mode}${caps.canonicalFormat !== 'UNKNOWN' ? ' ' + caps.canonicalFormat : ''}`
          : '');
    this.shellContext.setContext({
      breadcrumb: [
        { label: 'Catalog', route: ['/categories', DEFAULT_CATEGORY] },
        { label: dm.label },
      ],
      title: displayName,
      sub,
      actions: this.canWrite()
        ? [
            {
              id: 'propose',
              label: 'Propose model',
              icon: 'plus',
              kind: 'primary' as const,
              action: () => this.router.navigate(['/categories', cat, 'create']),
            },
          ]
        : [],
    });
  }

  protected openModel(model: BrowseModel): void {
    if (model._ghost && model._pending) {
      this.router.navigate(['/pending-queue'], {
        queryParams: { focus: model._pending.pendingChangeId },
      });
    } else {
      this.router.navigate(['/categories', this.store.category(), 'model', model.name]);
    }
  }

  protected openPending(pending: PendingChangeOverlay): void {
    this.router.navigate(['/pending-queue'], {
      queryParams: { focus: pending.pendingChangeId },
    });
  }
}
