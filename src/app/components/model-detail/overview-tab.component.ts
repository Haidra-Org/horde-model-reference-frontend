import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { BASELINE_DISPLAY_MAP } from '../../models/maps';
import type { BrowseModel } from '../../services/browse-models.service';

@Component({
  selector: 'app-overview-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="glass-inflow overview-tab">
      @if (isImage()) {
        <div class="kv-row">
          <span class="kv-label">Baseline</span>
          <span class="kv-value">{{ baselineDisplay() }}</span>
        </div>
        <div class="kv-row">
          <span class="kv-label">Style</span>
          <span class="kv-value">{{ model().style || '—' }}</span>
        </div>
        <div class="kv-row">
          <span class="kv-label">Inpainting</span>
          <span class="kv-value">{{ inpainting() ? 'Yes' : 'No' }}</span>
        </div>
        <div class="kv-row">
          <span class="kv-label">Min bridge version</span>
          <span class="kv-value">{{ minBridgeVersion() }}</span>
        </div>
        <div class="kv-row">
          <span class="kv-label">Tags</span>
          <span class="kv-value">
            @if (model().tags?.length) {
              <span style="display:flex;gap:6px;flex-wrap:wrap">
                @for (t of model().tags ?? []; track t) {
                  <span class="badge badge-gray">{{ t }}</span>
                }
              </span>
            } @else {
              —
            }
          </span>
        </div>
        <div class="kv-row">
          <span class="kv-label">Trigger words</span>
          <span class="kv-value">
            @if (triggerWords().length) {
              <span style="display:flex;gap:6px;flex-wrap:wrap">
                @for (t of triggerWords(); track t) {
                  <span class="badge badge-blue mono">{{ t }}</span>
                }
              </span>
            } @else {
              None
            }
          </span>
        </div>
        <div class="kv-row">
          <span class="kv-label">Homepage</span>
          <span class="kv-value">
            @if (homepage()) {
              <a [href]="homepage()" target="_blank" rel="noopener" class="link">{{
                homepage()
              }}</a>
            } @else {
              —
            }
          </span>
        </div>
      } @else if (isText()) {
        <div class="kv-row">
          <span class="kv-label">Base model group</span>
          <span class="kv-value">
            @if (textGroup()) {
              <span class="badge badge-purple mono">{{ textGroup() }}</span>
            } @else {
              —
            }
          </span>
        </div>
        <div class="kv-row">
          <span class="kv-label">Family</span>
          <span class="kv-value">{{ model().family || '—' }}</span>
        </div>
        <div class="kv-row">
          <span class="kv-label">Backend</span>
          <span class="kv-value">
            @if (backend()) {
              <span class="badge badge-gray mono">{{ backend() }}</span>
            } @else {
              —
            }
          </span>
        </div>
        <div class="kv-row">
          <span class="kv-label">Parameters</span>
          <span class="kv-value">{{ paramsDisplay() }}</span>
        </div>
        <div class="kv-row">
          <span class="kv-label">Instruct format</span>
          <span class="kv-value">{{ instructFormat() }}</span>
        </div>
        <div class="kv-row">
          <span class="kv-label">Baseline arch</span>
          <span class="kv-value">{{ model().baseline || '—' }}</span>
        </div>
        <div class="kv-row">
          <span class="kv-label">Tags</span>
          <span class="kv-value">
            @if (model().tags?.length) {
              <span style="display:flex;gap:6px;flex-wrap:wrap">
                @for (t of model().tags ?? []; track t) {
                  <span class="badge badge-gray">{{ t }}</span>
                }
              </span>
            } @else {
              —
            }
          </span>
        </div>
      } @else {
        <div class="kv-row">
          <span class="kv-label">Record type</span>
          <span class="kv-value mono">{{ recordType() }}</span>
        </div>
        @if (controlnetStyle()) {
          <div class="kv-row">
            <span class="kv-label">ControlNet style</span>
            <span class="kv-value">{{ controlnetStyle() }}</span>
          </div>
        }
        @if (pretrainedName()) {
          <div class="kv-row">
            <span class="kv-label">Pretrained name</span>
            <span class="kv-value mono">{{ pretrainedName() }}</span>
          </div>
        }
        <div class="kv-row">
          <span class="kv-label">Purpose</span>
          <span class="kv-value">{{ purpose() }}</span>
        </div>
        <div class="kv-row">
          <span class="kv-label">Homepage</span>
          <span class="kv-value">
            @if (homepage()) {
              <a [href]="homepage()" target="_blank" rel="noopener" class="link">{{
                homepage()
              }}</a>
            } @else {
              —
            }
          </span>
        </div>
      }
    </div>
  `,
})
export class OverviewTabComponent {
  readonly model = input.required<BrowseModel>();
  readonly isImage = input(false);
  readonly isText = input(false);

  private raw() {
    return (this.model()._raw ?? {}) as Record<string, unknown>;
  }

  protected readonly baselineDisplay = computed(() => {
    const b = this.model().baseline;
    if (!b) return '—';
    return BASELINE_DISPLAY_MAP[b] ?? b;
  });

  protected readonly inpainting = computed(() => this.raw()['inpainting'] === true);
  protected readonly minBridgeVersion = computed(() => this.raw()['min_bridge_version'] ?? '—');
  protected readonly triggerWords = computed(() => (this.raw()['trigger'] as string[]) ?? []);
  protected readonly homepage = computed(() => (this.raw()['homepage'] as string) ?? null);

  protected readonly textGroup = computed(() => (this.raw()['text_model_group'] as string) ?? null);
  protected readonly backend = computed(() => (this.raw()['backend'] as string) ?? null);
  protected readonly paramsDisplay = computed(() => {
    const p = this.model().parameters_count;
    if (p == null) return '—';
    return `${p.toLocaleString()} (${this.fmtParams(p)})`;
  });
  protected readonly instructFormat = computed(
    () => (this.raw()['instruct_format'] as string) ?? '—',
  );
  protected readonly recordType = computed(() => (this.raw()['record_type'] as string) ?? '—');
  protected readonly controlnetStyle = computed(
    () => (this.raw()['controlnet_style'] as string) ?? null,
  );
  protected readonly pretrainedName = computed(
    () => (this.raw()['pretrained_name'] as string) ?? null,
  );
  protected readonly purpose = computed(() => {
    const cls = this.raw()['model_classification'] as { purpose?: string } | undefined;
    return cls?.purpose ?? '—';
  });

  private fmtParams(n: number): string {
    if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
    if (n >= 1e6) return `${(n / 1e6).toFixed(0)}M`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
    return String(n);
  }
}
