import { Component, input, ChangeDetectionStrategy, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HordeBadgeComponent } from '@haidra/design-system/badge';
import { HordeButtonComponent } from '@haidra/design-system/button';
import type { UnifiedModelData, GroupedTextModel } from '../../models/unified-model';

@Component({
  selector: 'app-model-row-variations',
  imports: [RouterLink, HordeBadgeComponent, HordeButtonComponent],
  template: `
    <section class="detail-panel">
      <div class="flex items-center justify-between mb-3">
        <h4 class="detail-section-heading">
          Backend & Author Variations
          <span class="text-gray-400 normal-case tracking-normal font-normal">
            ({{ variations().length }} total)
          </span>
        </h4>
        <a
          class="btn btn-sm btn-primary"
          [routerLink]="['/categories', 'text_generation', 'group', groupName()]"
        >
          View Full Group
        </a>
      </div>

      <!-- Size/Quant Summary -->
      @if (availableSizes().length > 0 || availableQuants().length > 0) {
        <div class="flex flex-wrap items-center gap-2 mb-3">
          @if (availableSizes().length > 0) {
            <span class="text-xs text-muted mr-1">Sizes:</span>
            @for (size of availableSizes(); track size) {
              <span class="tag tag-info">{{ size }}</span>
            }
          }
          @if (availableQuants().length > 0) {
            <span class="text-xs text-muted mr-1 ml-2">Quants:</span>
            @for (quant of availableQuants(); track quant) {
              <span class="tag tag-primary">{{ quant }}</span>
            }
          }
        </div>
      }

      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="table-head-subtle">
            <tr class="border-b border-gray-200 dark:border-gray-700">
              <th class="table-header-cell-xs-caps">Full Name</th>
              <th class="table-header-cell-xs-caps">Backend</th>
              <th class="table-header-cell-xs-caps">Author</th>
              <th class="table-header-cell-xs-center-caps">Workers</th>
              <th class="table-header-cell-xs-center-caps">Queued</th>
              <th class="table-header-cell-xs-right-caps">Usage (Total)</th>
            </tr>
          </thead>
          <tbody class="table-body-default">
            @for (variation of variations(); track variation.name) {
              <tr class="table-row-hover-subtle">
                <td class="table-cell-mono-xs">
                  {{ variation.name }}
                </td>
                <td class="table-cell-xs">
                  @if (variation.parsedName?.backend) {
                    <horde-badge variant="info" class="text-xs">{{
                      variation.parsedName?.backend
                    }}</horde-badge>
                  } @else {
                    <span class="table-cell-muted-xs-inline">-</span>
                  }
                </td>
                <td class="table-cell-xs">
                  {{ variation.parsedName?.author ?? '-' }}
                </td>
                <td class="table-cell-xs-center">
                  {{ variation.workerCount ?? 0 }}
                </td>
                <td class="table-cell-xs-center">
                  {{ variation.queuedJobs ?? 0 }}
                </td>
                <td class="table-cell-xs-right">
                  {{ variation.usageStats?.total ?? 0 }}
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </section>
  `,
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModelRowVariationsComponent {
  readonly variations = input.required<UnifiedModelData[]>();
  readonly groupName = input.required<string>();
  readonly groupSummary = input<GroupedTextModel['groupSummary']>();

  readonly availableSizes = computed(() => this.groupSummary()?.available_sizes ?? []);

  readonly availableQuants = computed(() => this.groupSummary()?.available_quants ?? []);
}
