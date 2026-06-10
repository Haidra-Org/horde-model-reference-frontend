import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IconComponent } from '../../common/icon.component';
import { prettyBaseline } from '../../../models/maps';
import { domainMeta } from '../../../shared/domain';
import type { BrowseModel } from '../../../services/browse-models.service';
import type { PendingChangeOverlay } from '../../../models/pending-change-overlay';

@Component({
  selector: 'app-model-cards',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="browse-cards-grid">
      @for (m of models(); track m.name) {
        @let dm = metaFor(m.category ?? '');
        <div
          class="glass-inflow browse-card"
          [class.browse-card--ghost]="m._ghost"
          [class.accent-top-image]="dm.domain === 'image'"
          [class.accent-top-text]="dm.domain === 'text'"
          [class.accent-top-utility]="dm.domain === 'utility'"
          (click)="modelOpen.emit(m)"
          (keydown.enter)="modelOpen.emit(m)"
          tabindex="0"
          role="link"
        >
          @if (m._pending && !m._ghost) {
            <div style="position:absolute;top:10px;left:10px;z-index:2">
              <button
                type="button"
                class="badge badge-warning badge-sm"
                style="cursor:pointer;border:1px solid var(--color-pending-border)"
                (click)="pendingOpen.emit(m._pending); $event.stopPropagation()"
              >
                <app-icon name="clock" />{{ pendingLabel(m._pending) }}
              </button>
            </div>
          }

          <!-- Showcase placeholder -->
          <div class="browse-card-showcase">
            <span>{{ initials(m.display_name ?? m.name) }}</span>
          </div>

          <div style="padding:14px">
            <div
              style="font-weight:700;font-size:14.5px;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"
            >
              {{ m.display_name ?? m.name }}
            </div>
            <div
              style="font-size:12px;color:var(--color-content-secondary);line-height:1.45;height:34px;overflow:hidden;margin-bottom:10px"
            >
              {{ m.description || 'No description provided.' }}
            </div>

            <!-- Badges -->
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:11px">
              @if (m.baseline) {
                <span class="badge badge-blue">{{ baselineLabel(m.baseline) }}</span>
              }
              @if (isText() && m.family) {
                <span class="badge badge-purple">{{ m.family }}</span>
              }
              @if (m.style) {
                <span class="badge badge-gray">{{ m.style }}</span>
              }
            </div>

            <div class="divider" style="margin-bottom:10px"></div>

            <!-- Stats row -->
            <div
              style="display:flex;justify-content:space-between;font-size:12px;color:var(--color-content-secondary)"
            >
              <span style="display:inline-flex;align-items:center;gap:5px">
                <app-icon name="server" />{{ m._ghost ? '—' : (m._stats?.worker_count ?? '…') }}
              </span>
              <span style="display:inline-flex;align-items:center;gap:5px">
                <app-icon name="bolt" />{{
                  m._ghost ? '—' : formatUsage(m._stats?.usage_stats?.month)
                }}
              </span>
              <span style="display:inline-flex;align-items:center;gap:5px">
                {{
                  isText() ? formatParams(m.parameters_count) : formatBytes(m.size_on_disk_bytes)
                }}
              </span>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class ModelCardsComponent {
  readonly models = input.required<BrowseModel[]>();
  readonly isText = input(false);
  readonly modelOpen = output<BrowseModel>();
  readonly pendingOpen = output<PendingChangeOverlay>();

  metaFor(cat: string) {
    return domainMeta(cat);
  }

  protected initials(name: string): string {
    return (
      (name ?? '??')
        .replace(/[^A-Za-z0-9]/g, '')
        .slice(0, 2)
        .toUpperCase() || '??'
    );
  }

  protected baselineLabel(baseline: string): string {
    return prettyBaseline(baseline);
  }

  protected formatUsage(n: number | null | undefined): string {
    if (n == null) return '…';
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
    return String(n);
  }

  protected formatParams(n: number | null | undefined): string {
    if (n == null) return '—';
    if (n >= 1e9) return `${parseFloat((n / 1e9).toFixed(1))}B`;
    if (n >= 1e6) return `${Math.round(n / 1e6)}M`;
    return String(n);
  }

  protected formatBytes(bytes: number | null | undefined): string {
    if (bytes == null) return '—';
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  protected pendingLabel(pending: PendingChangeOverlay): string {
    switch (pending.pendingOperation) {
      case 'create':
        return 'Pending add';
      case 'delete':
        return 'Pending removal';
      default:
        return 'Pending edit';
    }
  }
}
