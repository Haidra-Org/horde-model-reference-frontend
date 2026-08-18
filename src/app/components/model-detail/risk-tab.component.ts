import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { StatTileComponent } from './stat-tile.component';
import type { ModelDeletionRiskInfo } from '../../api-client/model/modelDeletionRiskInfo';

/** Human-readable labels for deletion risk flags. Mirrors prototype's HMR.RISK_FLAGS. */
const RISK_FLAG_LABELS: [string, string][] = [
  ['zero_usage_day', 'No usage (24h)'],
  ['zero_usage_month', 'No usage (30d)'],
  ['zero_usage_total', 'No usage (all time)'],
  ['no_active_workers', 'No active workers'],
  ['has_multiple_hosts', 'Multiple hosts'],
  ['has_non_preferred_host', 'Non-preferred host'],
  ['has_unknown_host', 'Unknown host'],
  ['no_download_urls', 'No download URLs'],
  ['missing_description', 'Missing description'],
  ['missing_baseline', 'Missing baseline'],
  ['low_usage', 'Low usage'],
];

@Component({
  selector: 'app-risk-tab',
  imports: [StatTileComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div style="display:flex;flex-direction:column;gap:14px">
      <!-- Risk score card -->
      @if (showRisk()) {
        <div class="glass-inflow" style="padding:18px;display:flex;align-items:center;gap:18px">
          <div class="risk-score-panel">
            <div class="risk-score-label">Risk score</div>
            <div class="risk-score-value" [style.color]="riskColor()">{{ riskScore() }}</div>
            <div class="risk-score-desc">{{ riskLabel() }}</div>
          </div>
          <div style="flex:1">
            <div style="font-size:13px;color:var(--color-content-secondary);margin-bottom:10px">
              @if (activeFlags().length) {
                Flags raised by the deletion-risk analysis:
              } @else {
                No deletion-risk flags. This model is actively used and well-hosted.
              }
            </div>
            <div style="display:flex;gap:7px;flex-wrap:wrap">
              @for (flag of activeFlags(); track flag[0]) {
                <span class="badge badge-warning">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M12 9v3m0 4h.01M12 2l9.66 17.5H2.34L12 2z"
                    />
                  </svg>
                  {{ flag[1] }}
                </span>
              }
            </div>
          </div>
        </div>
      }

      <!-- Usage tiles -->
      <div class="detail-stat-tiles">
        <app-stat-tile
          icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          label="Usage 24h"
          [value]="fmtNum(usageDay())"
        />
        <app-stat-tile
          icon="M13 10V3L4 14h7v7l9-11h-7z"
          label="Usage 30d"
          [value]="fmtNum(usageMonth())"
        />
        <app-stat-tile
          icon="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          label="Usage all-time"
          [value]="fmtNum(usageTotal())"
        />
      </div>

      <!-- Detail KVs -->
      <div class="glass-inflow overview-tab">
        <div class="kv-row">
          <span class="kv-label">Active workers</span>
          <span class="kv-value">{{ workerCount() }}</span>
        </div>
        <div class="kv-row">
          <span class="kv-label">Download hosts</span>
          <span class="kv-value">{{ hosts() }}</span>
        </div>
        @if (showRisk()) {
          <div class="kv-row">
            <span class="kv-label">Cost / benefit</span>
            <span class="kv-value">{{ costBenefit() }}</span>
          </div>
        }
      </div>
    </div>
  `,
})
export class RiskTabComponent {
  readonly riskData = input.required<ModelDeletionRiskInfo | null>();

  /**
   * Whether to include the deletion-risk verdict alongside the usage figures.
   *
   * Usage counts and worker availability answer "can I run this model right now", which
   * every visitor needs. The risk score answers "should we keep hosting this", which is
   * a curation judgement and reads as a public verdict on someone's model.
   */
  readonly showRisk = input<boolean>(false);

  protected readonly riskScore = computed(() => this.riskData()?.risk_score ?? 0);
  protected readonly usageDay = computed(() => this.riskData()?.usage_day ?? 0);
  protected readonly usageMonth = computed(() => this.riskData()?.usage_month ?? 0);
  protected readonly usageTotal = computed(() => this.riskData()?.usage_total ?? 0);
  protected readonly workerCount = computed(() => this.riskData()?.worker_count ?? 0);
  protected readonly hosts = computed(() => {
    const h = this.riskData()?.download_hosts;
    return h?.length ? h.join(', ') : '—';
  });

  protected readonly riskColor = computed(() => {
    const s = this.riskScore();
    if (s >= 3) return 'var(--color-danger-600)';
    if (s >= 1) return 'var(--color-accent-pending)';
    return 'var(--color-success-600)';
  });

  protected readonly riskLabel = computed(() => {
    const d = this.riskData();
    if (!d) return 'Unknown';
    if (d.is_critical) return 'Critical';
    if (d.at_risk) return 'At risk';
    return 'Healthy';
  });

  protected readonly activeFlags = computed(() => {
    const flags = this.riskData()?.deletion_risk_flags;
    if (!flags) return [];
    return RISK_FLAG_LABELS.filter(([key]) => !!(flags as Record<string, unknown>)[key]);
  });

  protected readonly costBenefit = computed(() => {
    const d = this.riskData();
    if (!d || d.cost_benefit_score == null) return '—';
    return `${d.cost_benefit_score.toFixed(1)} uses / GB`;
  });

  protected fmtNum(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
  }
}
