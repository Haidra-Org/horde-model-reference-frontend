import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import {
  SegmentedControlComponent,
  SegmentedOption,
} from '../../../shared/design-system/components/segmented-control/segmented-control.component';
import { CategorySelectorComponent } from '../browse/category-selector/category-selector.component';
import { AnalyticsStatisticsComponent } from './analytics-statistics.component';
import { AnalyticsRiskComponent } from './analytics-risk.component';
import { AnalyticsShowcasesComponent } from './analytics-showcases.component';
import { ShellContextService } from '../../services/shell-context.service';
import { ModelReferenceApiService } from '../../services/model-reference-api.service';
import { RECORD_DISPLAY_MAP } from '../../models/maps';
import { DEFAULT_CATEGORY } from '../../shared/constants';
import { ViewerCapabilitiesService } from '../../services/viewer-capabilities.service';

type AnalyticsTab = 'statistics' | 'risk' | 'showcases';

const PUBLIC_TABS: SegmentedOption[] = [
  { value: 'statistics', label: 'Statistics' },
  { value: 'showcases', label: 'Showcases' },
];

/**
 * Deletion risk ranks models by how defensible their continued hosting is. That is a
 * curation judgement about candidates for removal, and reads as a public verdict on
 * someone's model when shown to a general audience.
 */
const CURATION_TAB: SegmentedOption = { value: 'risk', label: 'Deletion risk' };

@Component({
  selector: 'app-analytics',
  imports: [
    SegmentedControlComponent,
    CategorySelectorComponent,
    AnalyticsStatisticsComponent,
    AnalyticsRiskComponent,
    AnalyticsShowcasesComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="analytics-page">
      <!-- Category selector (shared with Browse) -->
      <app-category-selector
        variant="analytics"
        [categories]="categories()"
        [activeCategory]="category()"
        [counts]="categoryCounts()"
      />

      <!-- Tab control + cache badge -->
      <div class="analytics-header">
        <app-segmented-control
          [options]="tabOptions()"
          [value]="resolvedTab()"
          (valueChange)="setActiveTab($event)"
          ariaLabel="Analytics view"
          size="md"
        />
        @if (showRiskTab()) {
          <div class="analytics-cache-badge" title="Statistics cache TTL: {{ cacheTtl() }}s">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Cache {{ cacheTtl() }}s
          </div>
        }
      </div>

      <!-- Active tab content -->
      <div class="analytics-content">
        @switch (resolvedTab()) {
          @case ('statistics') {
            <app-analytics-statistics [category]="category()" />
          }
          @case ('risk') {
            <app-analytics-risk [category]="category()" />
          }
          @case ('showcases') {
            <app-analytics-showcases [category]="category()" />
          }
        }
      </div>
    </div>
  `,
})
export class AnalyticsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly shellContext = inject(ShellContextService);
  private readonly api = inject(ModelReferenceApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly viewer = inject(ViewerCapabilitiesService);

  protected readonly category = signal<string>(DEFAULT_CATEGORY);
  protected readonly activeTab = signal<AnalyticsTab>('statistics');
  protected readonly cacheTtl = signal<number>(300);

  /** All model reference categories for the category rail */
  protected readonly categories = signal<string[]>([]);
  protected readonly categoryCounts = signal<Map<string, number>>(new Map());

  protected readonly showRiskTab = this.viewer.canSeeCuration;

  protected readonly tabOptions = computed<SegmentedOption[]>(() =>
    this.showRiskTab() ? [...PUBLIC_TABS, CURATION_TAB] : PUBLIC_TABS,
  );

  /**
   * The risk tab is reachable by query param, including from bookmarks made before the
   * tab was gated, so entitlement is re-checked on every resolution rather than only
   * when the tab strip is clicked.
   */
  protected readonly resolvedTab = computed<AnalyticsTab>(() => {
    const tab = this.activeTab();
    return tab === 'risk' && !this.showRiskTab() ? 'statistics' : tab;
  });

  constructor() {
    // Seed categories from the model reference API
    this.api
      .getCategories()
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (cats) => this.categories.set(cats),
      });
  }

  ngOnInit(): void {
    // Read category and tab from query params
    this.route.queryParamMap
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        map((params) => ({
          category: params.get('category') ?? DEFAULT_CATEGORY,
          tab: (params.get('tab') as AnalyticsTab) ?? 'statistics',
        })),
      )
      .subscribe(({ category, tab }) => {
        this.category.set(category);
        if (tab === 'statistics' || tab === 'risk' || tab === 'showcases') {
          this.activeTab.set(tab);
        }

        // Set shell context (topbar)
        const displayName = RECORD_DISPLAY_MAP[category] ?? category;
        this.shellContext.setContext({
          breadcrumb: [{ label: 'Statistics', route: ['/analytics'] }, { label: displayName }],
          title: 'Catalog statistics',
          sub: 'Aggregate figures across the catalog. Updated periodically.',
          actions: [],
        });
      });

    // Detect cache TTL from backend capabilities
    this.cacheTtl.set(300); // default 300s matching backend cache TTL
  }

  protected setActiveTab(tab: string): void {
    if (tab !== 'statistics' && tab !== 'risk' && tab !== 'showcases') return;
    this.activeTab.set(tab);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: tab === 'statistics' ? null : tab },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
