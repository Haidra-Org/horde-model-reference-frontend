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
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import { StatTileComponent } from '../model-detail/stat-tile.component';
import {
  SegmentedControlComponent,
  SegmentedOption,
} from '../../../shared/design-system/components/segmented-control/segmented-control.component';
import { ModelReferenceApiService } from '../../services/model-reference-api.service';
import { domainOf } from '../../shared/domain';
import type { CategoryDeletionRiskResponse } from '../../api-client/model/categoryDeletionRiskResponse';
import type { ModelDeletionRiskInfo } from '../../api-client/model/modelDeletionRiskInfo';
import type { DeletionRiskFlags } from '../../api-client/model/deletionRiskFlags';

// ---------------------------------------------------------------------------
// Risk flag labels (mirroring prototype's HMR.RISK_FLAGS)
// ---------------------------------------------------------------------------

const RISK_FLAG_LABELS: Record<string, string> = {
  zero_usage_day: 'No usage (24h)',
  zero_usage_month: 'No usage (30d)',
  zero_usage_total: 'No usage (all time)',
  no_active_workers: 'No active workers',
  has_multiple_hosts: 'Multiple hosts',
  has_non_preferred_host: 'Non-preferred host',
  has_unknown_host: 'Unknown host',
  no_download_urls: 'No download URLs',
  missing_description: 'Missing description',
  missing_baseline: 'Missing baseline',
  low_usage: 'Low usage',
};

// ---------------------------------------------------------------------------
// Preset chips
// ---------------------------------------------------------------------------

interface PresetChip {
  key: string;
  label: string;
  preset?: string; // backend preset value
  clientFilter?: (m: ModelDeletionRiskInfo) => boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtNum(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function fmtSize(gb: number | null | undefined): string {
  if (gb == null) return '—';
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  return `${((gb ?? 0) * 1024).toFixed(0)} MB`;
}

function fmtPct(v: number | null | undefined): string {
  if (v == null) return '—';
  if (v < 0.01) return '<0.01%';
  return `${v.toFixed(1)}%`;
}

function fmtCostBenefit(score: number | null | undefined): string {
  if (score == null) return '—';
  return score.toFixed(1);
}

function activeFlags(
  flags: DeletionRiskFlags | null | undefined,
): { key: string; label: string }[] {
  if (!flags) return [];
  const result: { key: string; label: string }[] = [];
  for (const [key, label] of Object.entries(RISK_FLAG_LABELS)) {
    if ((flags as Record<string, boolean | undefined>)[key]) {
      result.push({ key, label });
    }
  }
  // Sort by severity: no workers → no usage → host issues → missing data → low usage
  return result;
}

// ---------------------------------------------------------------------------
// Preset definitions
// ---------------------------------------------------------------------------

const PRESETS: PresetChip[] = [
  { key: 'all', label: 'All', preset: undefined },
  { key: 'at_risk', label: 'At Risk', clientFilter: (m) => m.at_risk },
  { key: 'critical', label: 'Critical', preset: 'critical' },
  { key: 'no_workers', label: 'No Workers', preset: 'no_workers' },
  { key: 'low_usage', label: 'Low Usage', preset: 'low_usage' },
  { key: 'bad_host', label: 'Bad Host', preset: 'host_issues' },
];

@Component({
  selector: 'app-analytics-risk',
  imports: [RouterLink, StatTileComponent, SegmentedControlComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="analytics-tab-content">
      <!-- Info banner -->
      <div
        class="glass-inflow"
        style="padding:14px 18px;font-size:13px;color:var(--color-content-secondary)"
      >
        <strong>Deletion risk</strong> scoring flags models with no workers, no usage, non-preferred
        hosts, or missing data — enriched with live Horde worker/usage stats.
      </div>

      <!-- Group variants toggle (text only) -->
      @if (isTextDomain()) {
        <div
          style="display:flex;justify-content:flex-end;align-items:center;gap:10px;margin-top:8px"
        >
          <span style="font-size:12.5px;color:var(--color-content-muted)">Group variants</span>
          <app-segmented-control
            [options]="groupToggleOptions"
            [(value)]="groupMode"
            ariaLabel="Text model grouping"
            size="sm"
          />
        </div>
      }

      <!-- Loading / error -->
      @if (loading()) {
        <div class="glass-inflow" style="padding:24px;text-align:center">
          <p style="color:var(--color-content-muted)">Loading risk analysis…</p>
        </div>
      } @else if (loadError()) {
        <div class="glass-inflow" style="padding:24px;text-align:center">
          <p style="color:var(--color-danger-600)">Failed to load risk data.</p>
        </div>
      }

      <!-- Loaded -->
      @if (!loading() && !loadError()) {
        <!-- Risk stat cards -->
        <div class="analytics-stat-tiles">
          <app-stat-tile
            icon="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            label="Total models"
            [value]="riskSummary()?.total_models ?? '—'"
            [accent]="accentColor()"
          />
          <app-stat-tile
            icon="M12 9v3m0 4h.01M12 2l9.66 17.5H2.34L12 2z"
            label="At risk"
            [value]="riskSummary()?.models_at_risk ?? '—'"
            accent="#b45309"
          />
          <app-stat-tile
            icon="M12 9v3m0 4h.01M12 2l9.66 17.5H2.34L12 2z"
            label="Critical"
            [value]="riskSummary()?.models_critical ?? '—'"
            accent="#dc2626"
          />
          <app-stat-tile
            icon="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
            label="No workers"
            [value]="riskSummary()?.models_with_no_active_workers ?? '—'"
            accent="#d97706"
          />
          <app-stat-tile
            icon="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            label="Avg risk score"
            [value]="fmtAvgRisk()"
            accent="#6b7280"
          />
        </div>

        <!-- Preset filter chips -->
        <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:12px">
          <span class="filter-chips-label" style="font-size:12px;color:var(--color-content-muted)"
            >Filter</span
          >
          @for (chip of presetChips(); track chip.key) {
            <button
              type="button"
              class="filter-chip"
              style="--chip-accent:var(--color-accent-pending)"
              [class.filter-chip--active]="activePreset() === chip.key"
              [attr.aria-pressed]="activePreset() === chip.key"
              (click)="selectPreset(chip)"
            >
              {{ chip.label }}<span class="filter-chip__count">{{ chip.count }}</span>
            </button>
          }
        </div>

        <!-- Risk table -->
        @if (tableRows().length) {
          <div class="glass-inflow analytics-risk-table-wrapper">
            <table class="analytics-risk-table">
              <thead>
                <tr>
                  <th style="width:32px"><span class="sr-only">Risk</span></th>
                  <th>Model</th>
                  <th>Flags</th>
                  <th>Workers</th>
                  <th>Usage 30d</th>
                  <th>% Cat</th>
                  <th>Size</th>
                  <th>Cost/benefit</th>
                </tr>
              </thead>
              <tbody>
                @for (row of tableRows(); track row.model.name) {
                  <tr
                    class="analytics-risk-row"
                    [class.analytics-risk-row--critical]="row.isCritical"
                  >
                    <!-- RiskDot -->
                    <td>
                      <span
                        class="risk-dot"
                        [style.--risk-color]="row.riskColor"
                        [attr.aria-label]="'Risk score ' + row.model.risk_score"
                      ></span>
                    </td>
                    <!-- Model name with link -->
                    <td>
                      @if (groupedTextView()) {
                        <a
                          class="link"
                          [routerLink]="['/text-groups/group']"
                          [queryParams]="{ name: row.model.name }"
                          >{{ row.model.name }}</a
                        >
                        <a
                          class="analytics-risk-related-link"
                          [routerLink]="['/categories', 'text_generation']"
                          [queryParams]="{ groups: row.model.name }"
                          >Browse exact models</a
                        >
                      } @else {
                        <a
                          class="link"
                          [routerLink]="['/categories', category(), 'model', row.model.name]"
                          [queryParams]="{ tab: 'risk' }"
                          >{{ row.model.name }}</a
                        >
                      }
                    </td>
                    <!-- Flags -->
                    <td>
                      <div style="display:flex;flex-wrap:wrap;gap:4px">
                        @if (row.flagList.length === 0) {
                          <span class="badge badge-success" style="font-size:10px">healthy</span>
                        } @else {
                          @for (flag of row.flagList.slice(0, 3); track flag.key) {
                            <span class="badge badge-warning" style="font-size:10px">{{
                              flag.label
                            }}</span>
                          }
                          @if (row.flagList.length > 3) {
                            <span class="badge badge-secondary" style="font-size:10px"
                              >+{{ row.flagList.length - 3 }}</span
                            >
                          }
                        }
                      </div>
                    </td>
                    <!-- Workers -->
                    <td
                      [style.color]="row.model.worker_count === 0 ? 'var(--color-danger-600)' : ''"
                    >
                      {{ row.model.worker_count ?? '—' }}
                    </td>
                    <!-- Usage 30d -->
                    <td>{{ fmtNum(row.model.usage_month) }}</td>
                    <!-- % Cat -->
                    <td>{{ fmtPct(row.model.usage_percentage_of_category) }}</td>
                    <!-- Size -->
                    <td>{{ fmtSize(row.model.size_gb) }}</td>
                    <!-- Cost/benefit -->
                    <td>{{ fmtCostBenefit(row.model.cost_benefit_score) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else {
          <div class="glass-inflow" style="padding:24px;text-align:center">
            <p style="color:var(--color-content-muted)">No models match the current filter.</p>
          </div>
        }
      }
    </div>
  `,
})
export class AnalyticsRiskComponent implements OnInit {
  readonly category = input.required<string>();

  private readonly api = inject(ModelReferenceApiService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly loadError = signal(false);
  protected readonly riskResponse = signal<CategoryDeletionRiskResponse | null>(null);
  protected readonly activePreset = signal<string>('all');
  protected readonly groupMode = signal<string>('grouped');

  protected readonly groupToggleOptions: SegmentedOption[] = [
    { value: 'grouped', label: 'Grouped' },
    { value: 'ungrouped', label: 'Ungrouped' },
  ];

  protected readonly isTextDomain = computed(() => domainOf(this.category()) === 'text');
  protected readonly groupedTextView = computed(
    () => this.isTextDomain() && this.groupMode() === 'grouped',
  );
  protected readonly accentColor = computed(() => {
    const d = domainOf(this.category());
    return d === 'image' ? '#1d4ed8' : d === 'text' ? '#9333ea' : '#0891b2';
  });

  protected readonly riskSummary = computed(() => this.riskResponse()?.summary ?? null);

  // Preset chips with live counts
  protected readonly presetChips = computed(() => {
    const resp = this.riskResponse();
    if (!resp) return PRESETS.map((p) => ({ ...p, count: 0 }));

    const models = resp.models ?? [];
    const summary = resp.summary;

    return PRESETS.map((p) => {
      let count = 0;
      switch (p.key) {
        case 'all':
          count = summary.total_models;
          break;
        case 'at_risk':
          count = summary.models_at_risk;
          break;
        case 'critical':
          count = summary.models_critical;
          break;
        case 'no_workers':
          count = summary.models_with_no_active_workers ?? 0;
          break;
        case 'low_usage':
          count = summary.models_with_low_usage ?? 0;
          break;
        case 'bad_host':
          count = summary.models_with_non_preferred_hosts ?? 0;
          break;
        default:
          count = models.length;
      }
      return { ...p, count };
    });
  });

  // Table rows — filtered by active preset
  protected readonly tableRows = computed(() => {
    const resp = this.riskResponse();
    if (!resp?.models) return [];

    const presetKey = this.activePreset();
    const preset = PRESETS.find((p) => p.key === presetKey);

    let models = resp.models;

    // Apply client-side filter if defined
    if (preset?.clientFilter) {
      models = models.filter(preset.clientFilter);
    }

    return models.map((model) => {
      const flags = activeFlags(model.deletion_risk_flags);
      const score = model.risk_score ?? 0;
      let riskColor = '#22c55e'; // healthy green
      if (score >= 5)
        riskColor = '#ef4444'; // critical red
      else if (score >= 3)
        riskColor = '#f59e0b'; // warning amber
      else if (score >= 1) riskColor = '#3b82f6'; // info blue

      return {
        model,
        flagList: flags,
        isCritical: score >= 5,
        riskColor,
        riskScore: score,
      };
    });
  });

  protected fmtAvgRisk(): string {
    const s = this.riskSummary();
    if (!s) return '—';
    return s.average_risk_score.toFixed(1);
  }

  // Expose helpers to template
  protected readonly fmtNum = fmtNum;
  protected readonly fmtPct = fmtPct;
  protected readonly fmtSize = fmtSize;
  protected readonly fmtCostBenefit = fmtCostBenefit;

  selectPreset(chip: PresetChip): void {
    this.activePreset.set(chip.key);
    // Re-fetch from backend with preset if needed
    if (chip.preset) {
      this.fetchRiskData(chip.preset);
    } else {
      this.fetchRiskData(undefined);
    }
  }

  ngOnInit(): void {
    this.fetchRiskData(undefined);
  }

  private fetchRiskData(preset?: string): void {
    const category = this.category();
    const isText = this.isTextDomain();
    const groupText = this.groupMode() === 'grouped' && isText;

    this.loading.set(true);
    this.api
      .getCategoryAudit(category, groupText, preset, !groupText && isText)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError((err) => {
          console.warn('Failed to load risk data:', err);
          this.loadError.set(true);
          return of(null);
        }),
      )
      .subscribe((resp) => {
        this.riskResponse.set(resp);
        this.loading.set(false);
      });
  }
}
