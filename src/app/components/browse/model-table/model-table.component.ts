import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../common/icon.component';
import { prettyBaseline } from '../../../models/maps';
import {
  browseModelDisplayName,
  type BrowseModel,
  type SortDirection,
  type SortKey,
} from '../../../services/browse-models.service';
import type { PendingChangeOverlay } from '../../../models/pending-change-overlay';

export interface BrowseTableColumn {
  label: string;
  alignment: 'left' | 'right';
  width: string;
  sortKey?: SortKey;
}

@Component({
  selector: 'app-model-table',
  imports: [ScrollingModule, RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="glass-inflow browse-table-shell">
      <div class="browse-table-header">
        <table class="browse-model-table">
          <colgroup>
            @for (col of columns(); track col.label) {
              <col [style.width]="col.width" />
            }
          </colgroup>
          <thead>
            <tr>
              @for (col of columns(); track col.label) {
                <th
                  scope="col"
                  [class.browse-cell--right]="col.alignment === 'right'"
                  [attr.aria-sort]="ariaSort(col)"
                >
                  @if (col.sortKey) {
                    <button
                      type="button"
                      class="browse-table-sort"
                      [class.browse-table-sort--active]="sortKey() === col.sortKey"
                      (click)="sortChange.emit(col.sortKey)"
                    >
                      {{ col.label }}
                      <span aria-hidden="true">{{ sortIndicator(col) }}</span>
                    </button>
                  } @else {
                    {{ col.label }}
                  }
                </th>
              }
            </tr>
          </thead>
        </table>
      </div>

      <cdk-virtual-scroll-viewport
        [itemSize]="58"
        class="browse-table-viewport"
        aria-label="Model catalog results"
      >
        <table class="browse-model-table">
          <colgroup>
            @for (col of columns(); track col.label) {
              <col [style.width]="col.width" />
            }
          </colgroup>
          <tbody>
            <tr
              *cdkVirtualFor="let m of models(); trackBy: trackByName"
              class="browse-table-row"
              [class.row--pending]="!!m._pending && !m._ghost"
              [class.ghost-row]="!!m._ghost"
              tabindex="0"
              (click)="modelOpen.emit(m)"
              (keydown.enter)="modelOpen.emit(m)"
              (keydown.space)="modelOpen.emit(m); $event.preventDefault()"
            >
              <!-- Model name + showcase -->
              <td style="padding:10px 16px">
                <div style="display:flex;align-items:center;gap:11px">
                  <div
                    class="browse-table-showcase"
                    [class.browse-table-showcase--ghost]="m._ghost"
                  >
                    @if (!m._ghost) {
                      <span>{{ initials(displayName(m)) }}</span>
                    }
                  </div>
                  <div style="min-width:0">
                    <button
                      type="button"
                      class="browse-table-model-link"
                      (click)="modelOpen.emit(m); $event.stopPropagation()"
                      [attr.aria-label]="
                        'Open ' + displayName(m) + (m._group ? ' model group' : '')
                      "
                    >
                      {{ displayName(m) }}
                      @if (m.nsfw) {
                        <span class="badge badge-danger badge-xs">NSFW</span>
                      }
                      @if (m._group) {
                        <span class="badge badge-gray badge-xs"
                          >{{ m._group.variantCount }} variants</span
                        >
                      }
                    </button>
                    <div
                      style="font-size:11px;color:var(--color-content-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:360px;font-family:monospace"
                    >
                      @if (m._group) {
                        text model group
                      } @else {
                        {{ m.name }}
                      }
                    </div>
                  </div>
                </div>
              </td>

              <!-- Baseline / text-group column -->
              @if (isText()) {
                <td style="padding:10px 16px">
                  @if (m.text_model_group) {
                    <a
                      class="badge badge-purple concept-badge"
                      [routerLink]="['/text-groups/group']"
                      [queryParams]="{ name: m.text_model_group }"
                      (click)="$event.stopPropagation()"
                    >
                      {{ m.text_model_group }}
                    </a>
                    @if (m.text_group_family) {
                      <a
                        class="browse-table-family-link"
                        [routerLink]="['/text-groups']"
                        [queryParams]="{ families: m.text_group_family }"
                        (click)="$event.stopPropagation()"
                      >
                        {{ m.text_group_family }}
                      </a>
                    }
                  } @else {
                    <span style="color:var(--color-content-muted)">Ungrouped</span>
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

              <!-- Licensing -->
              <td class="browse-table-license-cell">
                @if (m._licensingMixed) {
                  <span class="browse-table-license">
                    <span class="browse-table-license__name">Multiple licenses</span>
                    <span
                      class="browse-table-license__commercial browse-table-license__commercial--conditional"
                      title="Variants have different licensing conclusions"
                    >
                      Commercial terms vary
                    </span>
                  </span>
                } @else if (m.licensing?.license_expression === 'NOASSERTION' || !m.licensing) {
                  <span class="browse-table-license" title="Unknown does not mean permitted">
                    <span class="browse-table-license__name">Not reviewed</span>
                    <span
                      class="browse-table-license__commercial browse-table-license__commercial--unknown"
                    >
                      Commercial use unknown
                    </span>
                  </span>
                } @else {
                  <span class="browse-table-license">
                    <span class="browse-table-license__name">
                      {{ m.licensing.license_expression }}
                    </span>
                    <span
                      class="browse-table-license__commercial"
                      [class]="
                        'browse-table-license__commercial browse-table-license__commercial--' +
                        commercialModifier(m)
                      "
                      [title]="'Commercial use: ' + commercialLabel(m)"
                    >
                      {{ commercialLabel(m) }}
                    </span>
                  </span>
                }
              </td>

              <!-- Params (text only) -->
              @if (isText()) {
                <td style="padding:10px 16px;text-align:right;font-weight:600">
                  @if (m._group) {
                    {{ m._group.sizeLabel || '—' }}
                  } @else {
                    {{ formatParams(m.parameters_count) }}
                  }
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
                  {{ formatUsage($safeNavigationMigration(m._stats?.usage_stats?.month)) }}
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
  readonly sortChange = output<SortKey>();

  readonly columns = input.required<BrowseTableColumn[]>();
  readonly sortKey = input.required<SortKey>();
  readonly sortDirection = input.required<SortDirection>();

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

  protected displayName(model: BrowseModel): string {
    return browseModelDisplayName(model);
  }

  protected ariaSort(column: BrowseTableColumn): 'ascending' | 'descending' | null {
    if (!column.sortKey || column.sortKey !== this.sortKey()) return null;
    return this.sortDirection() === 'asc' ? 'ascending' : 'descending';
  }

  protected sortIndicator(column: BrowseTableColumn): string {
    if (column.sortKey !== this.sortKey()) return '↕';
    return this.sortDirection() === 'asc' ? '↑' : '↓';
  }

  protected baselineLabel(baseline: string): string {
    return prettyBaseline(baseline);
  }

  protected commercialLabel(model: BrowseModel): string {
    switch (model.licensing?.commercial_use) {
      case 'allowed':
        return 'commercial allowed';
      case 'allowed_with_conditions':
        return 'commercial conditional';
      case 'prohibited':
        return 'commercial prohibited';
      default:
        return 'commercial unknown';
    }
  }

  protected commercialModifier(model: BrowseModel): string {
    switch (model.licensing?.commercial_use) {
      case 'allowed':
        return 'allowed';
      case 'allowed_with_conditions':
        return 'conditional';
      case 'prohibited':
        return 'prohibited';
      default:
        return 'unknown';
    }
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
