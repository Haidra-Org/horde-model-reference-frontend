import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { StatTileComponent } from '../model-detail/stat-tile.component';
import { BarRowComponent } from '../common/bar-row.component';
import { ModelReferenceApiService } from '../../services/model-reference-api.service';
import { HordeApiService } from '../../services/horde-api.service';
import { domainOf } from '../../shared/domain';
import type { CategoryStatistics } from '../../api-client/model/categoryStatistics';
import type { BackendStatisticsResponse } from '../../models/api.models';
import { BASELINE_SHORTHAND_MAP } from '../../models/maps';
import { catchError, combineLatest, of } from 'rxjs';
import { Router } from '@angular/router';

/**
 * Human-readable labels for baseline values (falls back to raw baseline name).
 */
function baselineLabel(raw: string): string {
  return BASELINE_SHORTHAND_MAP[raw] ?? raw;
}

/**
 * Format bytes to a human-readable string.
 */
function fmtBytes(bytes: number | null | undefined): string {
  if (bytes == null || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let val = bytes;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i++;
  }
  return `${val.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/**
 * Format a number with compact notation.
 */
function fmtNum(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

@Component({
  selector: 'app-analytics-statistics',
  imports: [StatTileComponent, BarRowComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="analytics-tab-content">
      <div class="analytics-action-row">
        <p class="text-muted">
          Select a distribution row to inspect the matching models in the catalog.
        </p>
        <button type="button" class="btn btn-secondary btn-sm" (click)="browseAll()">
          Browse all models
        </button>
      </div>

      <!-- Stat tiles -->
      <div class="analytics-stat-tiles">
        <app-stat-tile
          icon="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
          label="Models"
          [value]="totalModels()"
          [accent]="accentColor()"
        />
        <app-stat-tile
          icon="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
          label="Total on disk"
          [value]="totalSize()"
          [sub]="avgSize()"
          [accent]="accentColor()"
        />
        <app-stat-tile
          icon="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"
          label="Active workers"
          [value]="activeWorkers()"
          [accent]="accentColor()"
        />
        <app-stat-tile
          icon="M13 10V3L4 14h7v7l9-11h-7z"
          label="Usage 30d"
          [value]="usageMonth()"
          [accent]="accentColor()"
        />
      </div>

      <!-- Loading / empty states -->
      @if (loading()) {
        <div class="glass-inflow" style="padding:24px;text-align:center">
          <p style="color:var(--color-content-muted)">Loading statistics…</p>
        </div>
      } @else if (error()) {
        <div class="glass-inflow" style="padding:24px;text-align:center">
          <p style="color:var(--color-danger-600)">Failed to load statistics.</p>
        </div>
      }

      <!-- Distribution cards -->
      @if (!loading() && !error()) {
        <div class="analytics-distributions">
          <!-- Baseline / Parameter buckets -->
          @if (isImageDomain()) {
            @if (baselineBars().length) {
              <div class="glass-inflow analytics-dist-card">
                <h3 class="analytics-section-title">Baseline distribution</h3>
                @for (bar of baselineBars(); track bar.label) {
                  <app-bar-row
                    [label]="bar.label"
                    [count]="bar.count"
                    [percentage]="bar.percentage"
                    [accent]="accentColor()"
                    [actionLabel]="'Browse ' + bar.label + ' models'"
                    (activated)="drillDown('baselines', bar.value)"
                  />
                }
              </div>
            }
          } @else if (isTextDomain()) {
            @if (paramBucketBars().length) {
              <div class="glass-inflow analytics-dist-card">
                <h3 class="analytics-section-title">Parameter buckets</h3>
                @for (bar of paramBucketBars(); track bar.label) {
                  <app-bar-row
                    [label]="bar.label"
                    [count]="bar.count"
                    [percentage]="bar.percentage"
                    [accent]="accentColor()"
                  />
                }
              </div>
            }
          }

          <!-- Style / Tag distribution -->
          @if (styleBars().length) {
            <div class="glass-inflow analytics-dist-card">
              <h3 class="analytics-section-title">
                {{ isImageDomain() ? 'Style distribution' : 'Tag distribution' }}
              </h3>
              @for (bar of styleBars(); track bar.label) {
                <app-bar-row
                  [label]="bar.label"
                  [count]="bar.count"
                  [percentage]="bar.percentage"
                  [accent]="accentColor()"
                  [actionLabel]="'Browse models tagged ' + bar.label"
                  (activated)="drillDown(isImageDomain() ? 'styles' : 'tags', bar.value)"
                />
              }
            </div>
          }

          <!-- Download hosts -->
          @if (hostBars().length) {
            <div class="glass-inflow analytics-dist-card">
              <h3 class="analytics-section-title">Download hosts</h3>
              @for (bar of hostBars(); track bar.label) {
                <app-bar-row
                  [label]="bar.label"
                  [count]="bar.count"
                  [percentage]="bar.percentage"
                  [accent]="hostAccent(bar.label)"
                />
              }
            </div>
          }

          <!-- Safety mix -->
          @if (safetyBars().length) {
            <div class="glass-inflow analytics-dist-card">
              <h3 class="analytics-section-title">Safety mix</h3>
              @for (bar of safetyBars(); track bar.label) {
                <app-bar-row
                  [label]="bar.label"
                  [count]="bar.count"
                  [percentage]="bar.percentage"
                  [accent]="safetyAccent(bar.label)"
                  [actionLabel]="'Browse ' + bar.label + ' models'"
                  (activated)="drillDown('nsfw', bar.label.toLocaleLowerCase())"
                />
              }
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class AnalyticsStatisticsComponent implements OnInit {
  readonly category = input.required<string>();

  private readonly api = inject(ModelReferenceApiService);
  private readonly hordeApi = inject(HordeApiService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly statistics = signal<CategoryStatistics | null>(null);
  protected readonly statsResponse = signal<BackendStatisticsResponse | null>(null);

  // Domain
  protected readonly isImageDomain = computed(() => domainOf(this.category()) === 'image');
  protected readonly isTextDomain = computed(() => domainOf(this.category()) === 'text');
  protected readonly accentColor = computed(() =>
    this.isImageDomain()
      ? 'var(--color-accent-image)'
      : this.isTextDomain()
        ? 'var(--color-accent-text)'
        : 'var(--color-accent-utility)',
  );

  // Stat tiles
  protected readonly totalModels = computed(() => this.statistics()?.total_models ?? '—');
  protected readonly totalSize = computed(() => {
    const ds = this.statistics()?.download_stats;
    if (ds?.total_size_bytes) return fmtBytes(ds.total_size_bytes);
    return '—';
  });
  protected readonly avgSize = computed(() => {
    const ds = this.statistics()?.download_stats;
    if (ds?.average_size_bytes) return `avg ${fmtBytes(ds.average_size_bytes)}`;
    return undefined;
  });
  protected readonly activeWorkers = computed(() => {
    // Derive from the stats response — count models with workers
    const resp = this.statsResponse();
    if (!resp) return '—';
    let count = 0;
    Object.values(resp).forEach((m) => {
      if (m.worker_count && m.worker_count > 0) count++;
    });
    return String(count);
  });
  protected readonly usageMonth = computed(() => {
    const resp = this.statsResponse();
    if (!resp) return '—';
    let total = 0;
    Object.values(resp).forEach((m) => {
      total += m.usage_stats?.month ?? 0;
    });
    return fmtNum(total);
  });

  // Distribution bars
  protected readonly baselineBars = computed(() => {
    const dist = this.statistics()?.baseline_distribution;
    if (!dist) return [];
    return Object.entries(dist)
      .map(([key, val]) => ({
        value: key,
        label: baselineLabel(key),
        count: val.count,
        percentage: val.percentage,
      }))
      .sort((a, b) => b.count - a.count);
  });

  protected readonly paramBucketBars = computed(() => {
    const buckets = this.statistics()?.parameter_buckets;
    if (!buckets) return [];
    return buckets.map((b) => ({
      label: b.bucket_label,
      count: b.count,
      percentage: b.percentage,
    }));
  });

  protected readonly styleBars = computed(() => {
    const stats = this.statistics();
    if (!stats) return [];
    // For image: use top_styles; for text: use top_tags
    const items = this.isImageDomain() ? (stats.top_styles ?? stats.top_tags) : stats.top_tags;
    if (!items) return [];
    return items.map((t) => ({
      value: t.tag,
      label: t.tag,
      count: t.count,
      percentage: t.percentage,
    }));
  });

  protected readonly hostBars = computed(() => {
    const hosts = this.statistics()?.download_stats?.hosts;
    if (!hosts) return [];
    const total = Object.values(hosts).reduce((s, c) => s + c, 0);
    return Object.entries(hosts)
      .map(([host, count]) => ({
        label: host,
        count,
        percentage: total > 0 ? (count / total) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);
  });

  protected readonly safetyBars = computed(() => {
    const stats = this.statistics();
    if (!stats) return [];
    const nsfw = stats.nsfw_count ?? 0;
    const total = stats.total_models;
    if (total === 0) return [];
    const sfw = total - nsfw;
    return [
      { label: 'SFW', count: sfw, percentage: total > 0 ? (sfw / total) * 100 : 0 },
      { label: 'NSFW', count: nsfw, percentage: total > 0 ? (nsfw / total) * 100 : 0 },
    ];
  });

  /** Accent color for host bar: highlight preferred hosts */
  protected hostAccent(host: string): string {
    if (host === 'huggingface.co') return 'var(--color-success-600)';
    return undefined!;
  }

  /** Accent color for safety bar */
  protected safetyAccent(label: string): string {
    return label === 'NSFW' ? 'var(--color-warning-600)' : 'var(--color-accent-image)';
  }

  protected browseAll(): void {
    void this.router.navigate(['/categories', this.category()]);
  }

  protected drillDown(filter: 'baselines' | 'styles' | 'tags' | 'nsfw', value: string): void {
    void this.router.navigate(['/categories', this.category()], {
      queryParams: { [filter]: value },
    });
  }

  ngOnInit(): void {
    const category = this.category();

    combineLatest({
      stats: this.api.getCategoryStatistics(category).pipe(
        catchError(() => {
          this.error.set(true);
          return of(null);
        }),
      ),
      usage: this.hordeApi
        .getCombinedModelData(category.startsWith('text') ? 'text' : 'image', undefined, false)
        .pipe(catchError(() => of(null))),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ stats, usage }) => {
        this.statistics.set(stats);
        this.statsResponse.set(usage as BackendStatisticsResponse | null);
        this.loading.set(false);
      });
  }
}
