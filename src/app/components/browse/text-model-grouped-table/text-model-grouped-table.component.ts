import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  browseModelDisplayName,
  type BrowseModel,
  type BrowseTextGroup,
} from '../../../services/browse-models.service';
import { ViewerCapabilitiesService } from '../../../services/viewer-capabilities.service';

@Component({
  selector: 'app-text-model-grouped-table',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="glass-inflow text-pivot-shell">
      <div class="text-pivot-intro">
        <div>
          <strong>Grouped comparison</strong>
          <span
            >Groups organize related records; each model row remains a selectable runtime
            target.</span
          >
        </div>
        <span>{{ groups().length }} groups</span>
      </div>
      <div class="text-pivot-scroll" tabindex="0" aria-label="Text models grouped for comparison">
        <table class="text-pivot-table">
          <thead>
            <tr>
              <th scope="col">Group</th>
              <th scope="col">Exact model record</th>
              <th scope="col" class="browse-cell--right">Parameters</th>
              <th scope="col" class="browse-cell--right">Context</th>
              <th scope="col">How to use it</th>
              <th scope="col" class="browse-cell--right">Workers</th>
            </tr>
          </thead>
          <tbody>
            @for (group of groups(); track group.name) {
              @for (model of group.members; track model.name; let first = $first) {
                <tr
                  class="text-pivot-model-row"
                  [class.row--pending]="!!model._pending"
                  (click)="modelOpen.emit(model)"
                >
                  @if (first) {
                    <th
                      class="text-pivot-group"
                      scope="rowgroup"
                      [attr.rowspan]="group.members.length"
                    >
                      <a
                        [routerLink]="['/text-groups/group']"
                        [queryParams]="{ name: group.name }"
                        (click)="$event.stopPropagation()"
                        >{{ group.name }}</a
                      >
                      <span
                        >{{ group.members.length }} model{{
                          group.members.length === 1 ? '' : 's'
                        }}</span
                      >
                      <span>{{ liveLabel(group) }}</span>
                    </th>
                  }
                  <td>
                    <button
                      type="button"
                      class="browse-table-model-link"
                      (click)="modelOpen.emit(model); $event.stopPropagation()"
                    >
                      {{ displayName(model) }}
                    </button>
                    <code>{{ model.name }}</code>
                    <div class="text-pivot-badges">
                      @if (model.nsfw) {
                        <span class="badge badge-danger badge-xs">NSFW</span>
                      }
                      @if (licenseLabel(model); as license) {
                        <span class="badge badge-gray badge-xs">{{ license }}</span>
                      }
                    </div>
                  </td>
                  <td class="browse-cell--right text-pivot-number">
                    {{ formatParams(model.parameters_count) }}
                  </td>
                  <td class="browse-cell--right text-pivot-number">{{ formatContext(model) }}</td>
                  <td>
                    @if (guidanceLabel(model); as guidance) {
                      <span [class]="'guidance-state guidance-state--' + guidanceState(model)">
                        {{ guidance }}
                      </span>
                    }
                    @if (model.interaction_modes?.length) {
                      <small>{{ model.interaction_modes!.join(' · ') }}</small>
                    } @else if (!guidanceLabel(model)) {
                      <span class="text-muted">—</span>
                    }
                  </td>
                  <td class="browse-cell--right text-pivot-number">
                    {{ model._stats?.worker_count ?? '…' }}
                  </td>
                </tr>
              }
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
})
export class TextModelGroupedTableComponent {
  readonly groups = input.required<BrowseTextGroup[]>();
  readonly modelOpen = output<BrowseModel>();

  private readonly viewer = inject(ViewerCapabilitiesService);

  /**
   * Whether curation signals belong in this table.
   *
   * The catalog states what is known about a model. What is *missing* from a record is
   * a job queue, meaningful to whoever maintains the data and misleading to everyone
   * else: a reader has no way to tell an undocumented model from a bad one.
   */
  protected readonly showCurationSignals = this.viewer.canSeeCuration;

  protected displayName(model: BrowseModel): string {
    return browseModelDisplayName(model);
  }

  protected formatParams(value: number | null | undefined): string {
    if (value == null) return '—';
    return value >= 1e9 ? `${Number((value / 1e9).toFixed(1))}B` : `${Math.round(value / 1e6)}M`;
  }

  protected formatContext(model: BrowseModel): string {
    const tokens = model.context_window?.maximum_tokens;
    return tokens ? `${tokens.toLocaleString()} tokens` : '—';
  }

  protected guidanceState(model: BrowseModel): string {
    return model.guidance?.status ?? 'undocumented';
  }

  /**
   * Guidance chip, or null when there is nothing worth saying to this viewer.
   */
  protected guidanceLabel(model: BrowseModel): string | null {
    const state = this.guidanceState(model);
    if (state === 'published') {
      return 'Usage guide';
    }
    if (!this.showCurationSignals()) {
      return null;
    }
    return state === 'legacy_label' ? 'Legacy format label' : 'Guidance needed';
  }

  /**
   * License chip, or null when no reviewed conclusion exists and the viewer is not a
   * curator. An absent conclusion is not a licence finding, so it is not stated as one.
   */
  protected licenseLabel(model: BrowseModel): string | null {
    const expression = model.licensing?.license_expression;
    if (expression && expression !== 'NOASSERTION') {
      return expression;
    }
    return this.showCurationSignals() ? 'License not reviewed' : null;
  }

  protected liveLabel(group: BrowseTextGroup): string {
    const live = group.members.filter((member) => (member._stats?.worker_count ?? 0) > 0).length;
    return `${live} available now`;
  }
}
