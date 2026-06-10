import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { IconComponent } from '../../common/icon.component';
import { prettyBaseline } from '../../../models/maps';
import type { BrowseModel } from '../../../services/browse-models.service';
import type { PendingChangeOverlay } from '../../../models/pending-change-overlay';

@Component({
  selector: 'app-model-table',
  imports: [ScrollingModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="glass-inflow" style="overflow:hidden;padding:0">
      <cdk-virtual-scroll-viewport [itemSize]="52" style="height:60vh">
        <table style="width:100%;border-collapse:collapse;font-size:13.5px">
          <thead>
            <tr style="border-bottom:1px solid var(--color-border-hairline-strong)">
              @for (col of columns(); track col[0]) {
                <th
                  style="text-align:{{
                    col[1]
                  }};padding:11px 16px;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:var(--color-content-muted);font-weight:700;white-space:nowrap"
                >
                  {{ col[0] }}
                </th>
              }
            </tr>
          </thead>
          <tbody>
            <tr
              *cdkVirtualFor="let m of models(); trackBy: trackByName"
              class="browse-table-row"
              [class.row--pending]="!!m._pending && !m._ghost"
              [class.ghost-row]="!!m._ghost"
              (click)="modelOpen.emit(m)"
              (keydown.enter)="modelOpen.emit(m)"
              tabindex="0"
            >
              <!-- Model name + showcase -->
              <td style="padding:10px 16px">
                <div style="display:flex;align-items:center;gap:11px">
                  <div
                    class="browse-table-showcase"
                    [class.browse-table-showcase--ghost]="m._ghost"
                  >
                    @if (!m._ghost) {
                      <span>{{ initials(m.display_name ?? m.name) }}</span>
                    }
                  </div>
                  <div style="min-width:0">
                    <div
                      style="font-weight:600;display:flex;align-items:center;gap:7px;white-space:nowrap"
                    >
                      {{ m.display_name ?? m.name }}
                      @if (m.nsfw) {
                        <span class="badge badge-danger badge-xs">NSFW</span>
                      }
                    </div>
                    <div
                      style="font-size:11px;color:var(--color-content-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:360px;font-family:monospace"
                    >
                      {{ m.name }}
                    </div>
                  </div>
                </div>
              </td>

              <!-- Baseline / Family column -->
              @if (isText()) {
                <td style="padding:10px 16px">
                  @if (m.family) {
                    <span class="badge badge-purple">{{ m.family }}</span>
                  } @else {
                    <span style="color:var(--color-content-muted)">—</span>
                  }
                </td>
              } @else {
                <td style="padding:10px 16px">
                  @if (m.baseline) {
                    <span class="badge badge-blue">{{ baselineLabel(m.baseline) }}</span>
                  } @else {
                    <span style="color:var(--color-content-muted)">—</span>
                  }
                </td>
              }

              <!-- Params (text only) -->
              @if (isText()) {
                <td style="padding:10px 16px;text-align:right;font-weight:600">
                  {{ formatParams(m.parameters_count) }}
                </td>
              }

              <!-- Workers -->
              <td style="padding:10px 16px;text-align:right">
                @if (m._ghost) {
                  <span style="color:var(--color-content-muted)">—</span>
                } @else {
                  <span
                    [style.color]="
                      (m._stats?.worker_count ?? 0) === 0 ? 'var(--color-content-muted)' : 'inherit'
                    "
                    [style.font-weight]="(m._stats?.worker_count ?? 0) === 0 ? 400 : 600"
                  >
                    {{ m._stats?.worker_count ?? '…' }}
                  </span>
                }
              </td>

              <!-- Usage 30d -->
              <td style="padding:10px 16px;text-align:right;color:var(--color-content-secondary)">
                @if (m._ghost) {
                  <span>—</span>
                } @else {
                  {{ formatUsage(m._stats?.usage_stats?.month) }}
                }
              </td>

              <!-- Size -->
              <td style="padding:10px 16px;text-align:right;color:var(--color-content-secondary)">
                @if (m._ghost) {
                  <span>—</span>
                } @else {
                  {{ formatBytes(m.size_on_disk_bytes) }}
                }
              </td>

              <!-- Status / Pending tag -->
              <td style="padding:10px 16px">
                @if (m._pending) {
                  <button
                    type="button"
                    class="badge badge-warning badge-sm"
                    style="cursor:pointer;border:1px solid var(--color-pending-border)"
                    (click)="pendingOpen.emit(m._pending); $event.stopPropagation()"
                  >
                    <app-icon name="clock" />{{ pendingLabel(m._pending) }}
                  </button>
                } @else if (!m._ghost) {
                  <span
                    style="display:inline-flex;align-items:center;gap:6px;font-size:12.5px;color:var(--color-content-secondary)"
                  >
                    <span
                      style="width:7px;height:7px;border-radius:999px;background:{{
                        (m._stats?.worker_count ?? 0) > 0
                          ? 'var(--color-success-500)'
                          : 'var(--color-content-muted)'
                      }}"
                    ></span>
                    {{ (m._stats?.worker_count ?? 0) > 0 ? 'Live' : 'Idle' }}
                  </span>
                }
              </td>
            </tr>
          </tbody>
        </table>
      </cdk-virtual-scroll-viewport>
    </div>
  `,
})
export class ModelTableComponent {
  readonly models = input.required<BrowseModel[]>();
  readonly isImage = input(false);
  readonly isText = input(false);
  readonly modelOpen = output<BrowseModel>();
  readonly pendingOpen = output<PendingChangeOverlay>();

  readonly columns = input.required<[string, string][]>();

  protected trackByName(_index: number, model: BrowseModel): string {
    return model.name;
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

  protected formatParams(n: number | null | undefined): string {
    if (n == null) return '—';
    if (n >= 1e9) return `${parseFloat((n / 1e9).toFixed(1))}B`;
    if (n >= 1e6) return `${Math.round(n / 1e6)}M`;
    return String(n);
  }

  protected formatUsage(n: number | null | undefined): string {
    if (n == null) return '…';
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
    return String(n);
  }

  protected formatBytes(bytes: number | null | undefined): string {
    if (bytes == null) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
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
