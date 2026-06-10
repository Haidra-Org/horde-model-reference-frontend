import {
  ChangeDetectionStrategy,
  Component,
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
import { CategoryRailComponent } from '../browse/category-rail/category-rail.component';
import { AnalyticsStatisticsComponent } from './analytics-statistics.component';
import { AnalyticsRiskComponent } from './analytics-risk.component';
import { AnalyticsShowcasesComponent } from './analytics-showcases.component';
import { ShellContextService } from '../../services/shell-context.service';
import { ModelReferenceApiService } from '../../services/model-reference-api.service';
import { RECORD_DISPLAY_MAP } from '../../models/maps';
import { DEFAULT_CATEGORY } from '../../shared/constants';

type AnalyticsTab = 'statistics' | 'risk' | 'showcases';

const TAB_OPTIONS: SegmentedOption[] = [
  { value: 'statistics', label: 'Statistics' },
  { value: 'risk', label: 'Deletion Risk' },
  { value: 'showcases', label: 'Showcases' },
];

@Component({
  selector: 'app-analytics',
  imports: [
    SegmentedControlComponent,
    CategoryRailComponent,
    AnalyticsStatisticsComponent,
    AnalyticsRiskComponent,
    AnalyticsShowcasesComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="analytics-page">
      <!-- Category rail (reused from Phase 2) -->
      <app-category-rail
        [categories]="categories()"
        [activeCategory]="category()"
        [counts]="categoryCounts()"
      />

      <!-- Tab control + cache badge -->
      <div class="analytics-header">
        <app-segmented-control
          [options]="tabOptions"
          [(value)]="activeTab"
          ariaLabel="Analytics view"
          size="md"
        />
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
      </div>

      <!-- Active tab content -->
      <div class="analytics-content">
        @switch (activeTab()) {
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

  protected readonly category = signal<string>(DEFAULT_CATEGORY);
  protected readonly activeTab = signal<AnalyticsTab>('statistics');
  protected readonly cacheTtl = signal<number>(300);

  /** All model reference categories for the category rail */
  protected readonly categories = signal<string[]>([]);
  protected readonly categoryCounts = signal<Map<string, number>>(new Map());

  protected readonly tabOptions = TAB_OPTIONS;

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
          breadcrumb: [{ label: 'Analytics', route: ['/analytics'] }, { label: displayName }],
          title: 'Model analytics',
          sub: `Aggregate statistics & deletion-risk · public, cached (stale-while-revalidate)`,
          actions: [],
        });
      });

    // Detect cache TTL from backend capabilities
    this.cacheTtl.set(300); // default 300s matching backend cache TTL
  }
}
