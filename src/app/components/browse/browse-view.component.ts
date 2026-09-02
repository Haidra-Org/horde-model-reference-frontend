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
import { CdkOverlayOrigin, CdkConnectedOverlay, ConnectedPosition } from '@angular/cdk/overlay';
import { CategorySelectorComponent } from './category-selector/category-selector.component';
import { BrowseToolbarComponent } from './browse-toolbar/browse-toolbar.component';
import { FilterChipsComponent } from './filter-chips/filter-chips.component';
import { IconComponent } from '../common/icon.component';
import { ModelTableComponent } from './model-table/model-table.component';
import { ModelCardsComponent } from './model-cards/model-cards.component';
import { ModelGalleryComponent } from './model-gallery/model-gallery.component';
import { TextModelGroupedTableComponent } from './text-model-grouped-table/text-model-grouped-table.component';
import type { BrowseTableColumn } from './model-table/model-table.component';
import { BrowseModelsStore } from '../../services/browse-models.service';
import type { BrowseModel } from '../../services/browse-models.service';
import { ShellContextService } from '../../services/shell-context.service';
import { ModelReferenceApiService } from '../../services/model-reference-api.service';
import { ViewerCapabilitiesService } from '../../services/viewer-capabilities.service';
import { RECORD_DISPLAY_MAP } from '../../models/maps';
import { domainMeta } from '../../shared/domain';
import { DEFAULT_CATEGORY } from '../../shared/constants';
import type { SegmentedOption } from '../../../shared/design-system/components/segmented-control/segmented-control.component';
import type { PendingChangeOverlay } from '../../models/pending-change-overlay';

const CATEGORY_GUIDANCE: Record<string, string> = {
  image_generation: 'Generation checkpoints, architecture compatibility, styles, and prompting.',
  text_generation: 'Language-model groups and variants, prompt formats, sizes, and architectures.',
  controlnet: 'Control-signal adapters for guided image generation.',
  esrgan: 'Super-resolution models for image upscaling.',
  gfpgan: 'Face-restoration models for image post-processing.',
  codeformer: 'Identity-aware face restoration and reconstruction.',
  clip: 'Vision-language encoders for prompt and image representation.',
  blip: 'Image-captioning models for natural-language descriptions.',
  safety_checker: 'Content-safety classifiers used in image workflows.',
  video_generation: 'Models for temporal and video generation.',
  audio_generation: 'Models for audio generation.',
  miscellaneous: 'Supporting runtime models and specialized utilities.',
};

/** A single active facet selection, rendered as a removable chip. */
interface ActiveFilterChip {
  kind: 'baseline' | 'style' | 'group' | 'family' | 'tag' | 'nsfw' | 'pending';
  value: string;
  label: string;
}

@Component({
  selector: 'app-browse-view',
  imports: [
    CategorySelectorComponent,
    BrowseToolbarComponent,
    FilterChipsComponent,
    ModelTableComponent,
    ModelCardsComponent,
    ModelGalleryComponent,
    TextModelGroupedTableComponent,
    RouterLink,
    CdkOverlayOrigin,
    CdkConnectedOverlay,
    IconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="browse-layout">
      <!-- Category selector -->
      <app-category-selector
        [activeCategory]="store.category()"
        [counts]="store.categoryCounts()"
        [categories]="allCategoryNames()"
      />

      @if (!store.loading()) {
        <section class="browse-context-strip" aria-label="Category context and related tools">
          <p>{{ categoryGuidance() }}</p>
          <nav aria-label="Related category tools">
            <a
              class="concept-link"
              [routerLink]="['/analytics']"
              [queryParams]="{ category: store.category() }"
              >Statistics</a
            >
            @if (showCurationSignals()) {
              <a class="concept-link" [routerLink]="['/categories', store.category(), 'audit']"
                >Curation review</a
              >
            }
            @if (store.isTextDomain()) {
              <a class="concept-link" [routerLink]="['/text-groups']">Group explorer</a>
            }
          </nav>
        </section>
      }

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

      <!-- Filters: compact popover trigger + active-filter chips -->
      @if ((store.isImageDomain() || store.isTextDomain()) && !store.loading()) {
        <div class="browse-filters-bar">
          <button
            type="button"
            class="browse-filters-trigger"
            [class.browse-filters-trigger--active]="filtersOpen() || activeFilterCount() > 0"
            cdkOverlayOrigin
            #filtersOrigin="cdkOverlayOrigin"
            (click)="filtersOpen.set(!filtersOpen())"
            [attr.aria-expanded]="filtersOpen()"
            aria-controls="browse-filter-panel"
          >
            <app-icon name="filter" />
            Filters
            @if (activeFilterCount() > 0) {
              <span class="browse-filters-count">{{ activeFilterCount() }}</span>
            }
          </button>

          @for (chip of activeFilterChips(); track chip.kind + ':' + chip.value) {
            <button
              type="button"
              class="browse-filter-active-chip"
              [class]="'browse-filter-active-chip--' + chip.kind"
              (click)="removeFilter(chip)"
              [attr.aria-label]="'Remove filter ' + chip.label"
            >
              {{ chip.label }}
              <app-icon name="x" />
            </button>
          }

          @if (activeFilterCount() > 0) {
            <button type="button" class="browse-filters-clear" (click)="clearAllFilters()">
              Clear all
            </button>
          }
        </div>

        <ng-template
          cdkConnectedOverlay
          [cdkConnectedOverlayOrigin]="filtersOrigin"
          [cdkConnectedOverlayOpen]="filtersOpen()"
          [cdkConnectedOverlayPositions]="overlayPositions"
          [cdkConnectedOverlayHasBackdrop]="false"
          (overlayOutsideClick)="filtersOpen.set(false)"
        >
          <div
            id="browse-filter-panel"
            class="browse-filters-popover glass-inflow"
            role="dialog"
            aria-label="Model filters"
          >
            <app-filter-chips
              [facets]="store.facets()"
              [(activeBaselines)]="store.activeBaselines"
              [(activeStyles)]="store.activeStyles"
              [(activeGroups)]="store.activeGroups"
              [(activeFamilies)]="store.activeFamilies"
              [(activeTags)]="store.activeTags"
              [(nsfwFilter)]="store.nsfwFilter"
              [(pendingOnly)]="store.pendingOnly"
              [hasPending]="store.pendingCount() > 0"
              [isImageDomain]="store.isImageDomain()"
              [isTextDomain]="store.isTextDomain()"
              [showBaselines]="store.isImageDomain() && store.facets().baselines.length > 0"
              [showStyles]="store.isImageDomain() && store.facets().styles.length > 0"
              [showGroups]="store.isTextDomain() && store.facets().groups.length > 0"
              [showFamilies]="store.isTextDomain() && store.facets().families.length > 0"
              [showTags]="store.facets().tags.length > 0"
              [showSafety]="store.isImageDomain() || store.isTextDomain()"
            />
          </div>
        </ng-template>
      }

      <!-- Result count -->
      @if (!store.loading()) {
        <div class="browse-result-count" aria-live="polite">
          {{ store.resultCount() }} result{{ store.resultCount() === 1 ? '' : 's' }}
        </div>
      }

      <!-- Loading skeleton -->
      @if (store.loading()) {
        <div class="glass-inflow catalog-state" role="status">Loading models…</div>
      }

      <!-- Error state -->
      @if (store.error()) {
        <div class="alert alert--danger">
          {{ store.error() }}
        </div>
      }

      <!-- Empty state -->
      @if (!store.loading() && !store.error() && store.resultCount() === 0) {
        <div class="glass-inflow catalog-state">
          <h2 class="heading-section">No models match</h2>
          <p class="text-muted">Try a broader search or clear the active filters.</p>
          @if (activeFilterCount() > 0) {
            <button type="button" class="btn btn-secondary btn-sm" (click)="clearAllFilters()">
              Clear filters
            </button>
          }
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
              [sortKey]="store.sortKey()"
              [sortDirection]="store.sortDirection()"
              (sortChange)="store.setSort($event)"
              (modelOpen)="openModel($event)"
              (pendingOpen)="openPending($event)"
            />
          }
          @case ('grouped') {
            <app-text-model-grouped-table
              [groups]="store.groupedTextModels()"
              (modelOpen)="openModel($event)"
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
  private readonly route: ActivatedRoute = inject(ActivatedRoute);
  private readonly router: Router = inject(Router);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);
  private readonly viewer = inject(ViewerCapabilitiesService);

  /** Whether curation entry points and quality signals belong on this page. */
  readonly showCurationSignals = this.viewer.canSeeCuration;

  /** All category names from the API for the rail. */
  readonly allCategoryNames = signal<string[]>([]);

  // ── Filters popover ───────────────────────────────────────────────────
  readonly filtersOpen = signal(false);
  private readonly filtersHydrated = signal(false);
  private lastFilterState = '';

  /** CDK overlay positions: prefer below the trigger, fall back to above. */
  readonly overlayPositions: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 6 },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -6 },
  ];

  /** Currently-active facet selections, flattened into removable chips. */
  readonly activeFilterChips = computed<ActiveFilterChip[]>(() => {
    const facets = this.store.facets();
    const labelFrom = (opts: { value: string; label: string }[], v: string): string =>
      opts.find((o) => o.value === v)?.label ?? v;
    const chips: ActiveFilterChip[] = [];
    for (const v of this.store.activeBaselines()) {
      chips.push({ kind: 'baseline', value: v, label: labelFrom(facets.baselines, v) });
    }
    for (const v of this.store.activeStyles()) {
      chips.push({ kind: 'style', value: v, label: labelFrom(facets.styles, v) });
    }
    for (const v of this.store.activeGroups()) {
      chips.push({ kind: 'group', value: v, label: 'Group: ' + labelFrom(facets.groups, v) });
    }
    for (const v of this.store.activeFamilies()) {
      chips.push({ kind: 'family', value: v, label: labelFrom(facets.families, v) });
    }
    for (const v of this.store.activeTags()) {
      chips.push({ kind: 'tag', value: v, label: 'Tag: ' + labelFrom(facets.tags, v) });
    }
    const nsfw = this.store.nsfwFilter();
    if (nsfw !== 'all') {
      chips.push({ kind: 'nsfw', value: nsfw, label: nsfw === 'sfw' ? 'SFW only' : 'NSFW only' });
    }
    if (this.store.pendingOnly()) {
      chips.push({ kind: 'pending', value: 'pending', label: 'Pending only' });
    }
    return chips;
  });

  readonly activeFilterCount = computed(() => this.activeFilterChips().length);

  removeFilter(chip: ActiveFilterChip): void {
    switch (chip.kind) {
      case 'baseline':
        this.store.activeBaselines.update((a) => a.filter((v) => v !== chip.value));
        break;
      case 'style':
        this.store.activeStyles.update((a) => a.filter((v) => v !== chip.value));
        break;
      case 'group':
        this.store.activeGroups.update((a) => a.filter((v) => v !== chip.value));
        break;
      case 'family':
        this.store.activeFamilies.update((a) => a.filter((v) => v !== chip.value));
        break;
      case 'tag':
        this.store.activeTags.update((tags) => tags.filter((value) => value !== chip.value));
        break;
      case 'nsfw':
        this.store.nsfwFilter.set('all');
        break;
      case 'pending':
        this.store.pendingOnly.set(false);
        break;
    }
  }

  clearAllFilters(): void {
    this.store.activeBaselines.set([]);
    this.store.activeStyles.set([]);
    this.store.activeGroups.set([]);
    this.store.activeFamilies.set([]);
    this.store.activeTags.set([]);
    this.store.nsfwFilter.set('all');
    this.store.pendingOnly.set(false);
  }

  protected readonly categoryDisplayName = computed(() => {
    return RECORD_DISPLAY_MAP[this.store.category()]?.toLowerCase() ?? 'models';
  });

  protected readonly categoryGuidance = computed(
    () =>
      CATEGORY_GUIDANCE[this.store.category()] ??
      'Curated runtime metadata, downloads, licensing, and operational status.',
  );

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
    if (this.store.isTextDomain()) {
      return [
        { value: 'table', label: 'Models', icon: 'table' },
        { value: 'grouped', label: 'Grouped', icon: 'grid' },
      ];
    }
    const opts: SegmentedOption[] = [
      { value: 'table', label: 'Table', icon: 'table' },
      { value: 'cards', label: 'Cards', icon: 'grid' },
    ];
    if (this.store.isImageDomain()) {
      opts.push({ value: 'gallery', label: 'Gallery', icon: 'image' });
    }
    return opts;
  });

  protected readonly tableColumns = computed<BrowseTableColumn[]>(() => {
    if (this.store.isTextDomain()) {
      return [
        { label: 'Model', alignment: 'left', width: '26%', sortKey: 'name' },
        { label: 'Group', alignment: 'left', width: '15%' },
        { label: 'License', alignment: 'left', width: '18%' },
        { label: 'Params', alignment: 'right', width: '8%', sortKey: 'params' },
        { label: 'Workers', alignment: 'right', width: '8%', sortKey: 'workers' },
        { label: 'Usage 30d', alignment: 'right', width: '9%', sortKey: 'usage' },
        { label: 'Size', alignment: 'right', width: '8%', sortKey: 'size' },
        { label: 'Status', alignment: 'left', width: '8%' },
      ];
    }
    if (this.store.isImageDomain()) {
      return [
        { label: 'Model', alignment: 'left', width: '31%', sortKey: 'name' },
        { label: 'Baseline', alignment: 'left', width: '14%' },
        { label: 'License', alignment: 'left', width: '20%' },
        { label: 'Workers', alignment: 'right', width: '8%', sortKey: 'workers' },
        { label: 'Usage 30d', alignment: 'right', width: '10%', sortKey: 'usage' },
        { label: 'Size', alignment: 'right', width: '9%', sortKey: 'size' },
        { label: 'Status', alignment: 'left', width: '8%' },
      ];
    }
    return [
      { label: 'Model', alignment: 'left', width: '31%', sortKey: 'name' },
      { label: 'Type', alignment: 'left', width: '14%' },
      { label: 'License', alignment: 'left', width: '20%' },
      { label: 'Workers', alignment: 'right', width: '8%', sortKey: 'workers' },
      { label: 'Usage 30d', alignment: 'right', width: '10%', sortKey: 'usage' },
      { label: 'Size', alignment: 'right', width: '9%', sortKey: 'size' },
      { label: 'Status', alignment: 'left', width: '8%' },
    ];
  });

  readonly canWrite = this.viewer.canPropose;

  constructor() {
    // Keep the topbar in sync with category, live/pending counts, backend mode
    // and write capability — all of which can change after first render.
    effect(() => {
      this.setShellContext(this.store.category());
    });

    effect(() => {
      if (!this.filtersHydrated()) return;
      const queryParams = this.store.toQueryParams();
      const filterState = JSON.stringify(queryParams);
      if (filterState === this.lastFilterState) return;
      this.lastFilterState = filterState;
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams,
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
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
      this.lastFilterState = JSON.stringify(this.store.toQueryParams());
      this.filtersHydrated.set(true);
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
    } else if (model._group) {
      this.router.navigate(['/text-groups/group'], { queryParams: { name: model.name } });
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
