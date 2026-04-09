import { Component, input, output, computed, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HordeBadgeComponent } from '@haidra/design-system/badge';
import { HordeButtonComponent } from '@haidra/design-system/button';
import {
  LegacyRecordUnion,
  isLegacyStableDiffusionRecord,
  isLegacyTextGenerationRecord,
} from '../../models';
import type { PendingChangeOverlay } from '../../models/pending-change-overlay';
import {
  UnifiedModelData,
  hasActiveWorkers,
  GroupedTextModel,
  isGroupedTextModel,
} from '../../models/unified-model';
import { BASELINE_SHORTHAND_MAP } from '../../models/maps';
import { ModelRowHeaderComponent } from './model-row-header.component';
import { ModelRowFieldsComponent } from './model-row-fields.component';
import { ModelRowShowcasesComponent } from './model-row-showcases.component';
import { ModelRowVariationsComponent } from './model-row-variations.component';
import { ModelRowActionsComponent } from './model-row-actions.component';
import { hasShowcases } from './model-row.utils';

@Component({
  selector: 'app-model-row',
  imports: [
    RouterLink,
    HordeBadgeComponent,
    HordeButtonComponent,
    ModelRowHeaderComponent,
    ModelRowFieldsComponent,
    ModelRowShowcasesComponent,
    ModelRowVariationsComponent,
    ModelRowActionsComponent,
  ],
  template: `
    <!-- Compact Table Mode -->
    <tr
      [class]="
        'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ' +
        (isEven() ? 'table-row-even' : 'table-row-odd') +
        (pendingRowClass() ? ' ' + pendingRowClass() : '')
      "
      (click)="
        isGhost() ? viewPendingChange.emit(pendingOverlay()!.pendingChangeId) : toggleExpansion()
      "
    >
      <td class="text-center">
        <svg
          class="w-4 h-4 inline-block transition-transform duration-200"
          [class.rotate-90]="expanded()"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 5l7 7-7 7"
          ></path>
        </svg>
      </td>
      <td class="text-center text-xs text-muted">
        {{ originalIndex() + 1 }}
      </td>
      <td class="text-center" [title]="workerCountTooltip()">
        <span class="inline-block w-3 h-3 rounded-full" [class]="activeIndicatorClass()"></span>
      </td>
      <td class="font-medium text-gray-900 dark:text-gray-100">
        <div class="flex items-center gap-2">
          @if (isGrouped()) {
            <a
              [routerLink]="['/categories', 'text_generation', 'group', model().name]"
              class="text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300 flex-shrink-0"
              title="View group"
              (click)="$event.stopPropagation()"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </a>
          }
          <app-model-row-header [model]="model()" [allModels]="allModels()" mode="compact" />
          @if (pendingOverlay()) {
            <button
              type="button"
              [class]="pendingBadgeClass()"
              (click)="
                $event.stopPropagation(); viewPendingChange.emit(pendingOverlay()!.pendingChangeId)
              "
              [title]="'View pending change #' + pendingOverlay()!.pendingChangeId"
            >
              {{ pendingBadgeText() }}
            </button>
          }
        </div>
      </td>
      <td class="field-value">
        <div class="truncate">
          {{ legacyModel().description || '-' }}
        </div>
      </td>
      <td class="text-sm whitespace-normal break-words">
        @if (isStableDiffusionRecord()) {
          {{ baselineDisplay() }}
        } @else if (isTextGenerationRecord()) {
          {{ legacyModel().baseline || '-' }}
        } @else {
          -
        }
      </td>
      <td class="text-sm">
        @if (tags().length > 0) {
          <div class="truncate">
            <span class="text-muted">
              {{ tags().slice(0, 3).join(', ') }}
              @if (tags().length > 3) {
                <span class="text-muted italic ml-1"> +{{ tags().length - 3 }} </span>
              }
            </span>
          </div>
        } @else {
          -
        }
      </td>
      @if (isTextGeneration()) {
        <td class="text-center text-sm text-gray-700 dark:text-gray-300">
          @if (isGrouped() && groupedModel()) {
            <div class="flex flex-col items-center gap-0.5">
              <span>{{ groupedModel()!.variations.length }}</span>
              @if (groupSizes().length > 0) {
                <div class="flex flex-wrap justify-center gap-0.5">
                  @for (size of groupSizes().slice(0, 3); track size) {
                    <span class="tag tag-info text-[10px] py-0 px-1">{{ size }}</span>
                  }
                  @if (groupSizes().length > 3) {
                    <span class="text-[10px] text-muted">+{{ groupSizes().length - 3 }}</span>
                  }
                </div>
              }
            </div>
          } @else {
            1
          }
        </td>
      }
      @if (!isTextGeneration()) {
        <td>
          @if (legacyModel().nsfw === true) {
            <horde-badge variant="warning">NSFW</horde-badge>
          } @else if (legacyModel().nsfw === false) {
            <horde-badge variant="success">SFW</horde-badge>
          } @else {
            <horde-badge variant="secondary">Unknown</horde-badge>
          }
        </td>
      }
      <td class="text-center text-sm text-gray-700 dark:text-gray-300">
        {{ model().workerCount ?? 0 }}
      </td>
      <td class="text-center">
        @if (isGhost()) {
          <horde-button
            variant="secondary"
            size="xs"
            (click)="
              $event.stopPropagation(); viewPendingChange.emit(pendingOverlay()!.pendingChangeId)
            "
          >
            View Pending
          </horde-button>
        } @else {
          <app-model-row-actions
            [model]="legacyModel()"
            layout="horizontal"
            [writable]="writable()"
            (showJson)="showJson.emit($event)"
            (edit)="edit.emit($event)"
            (delete)="delete.emit($event)"
          />
        }
      </td>
    </tr>

    <!-- Expanded Details Row -->
    @if (expanded() && !isGhost()) {
      <tr [class]="(isEven() ? 'table-row-even' : 'table-row-odd') + ' detail-row'">
        <td [attr.colspan]="detailColspan()">
          <div class="detail-section">
            <!-- Overview Banner -->
            <div class="detail-header">
              <div class="detail-header-content">
                <h3 class="text-lg font-bold text-gray-900 dark:text-gray-100">
                  {{ model().name }}
                </h3>
                <p class="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                  {{ legacyModel().description || 'No description available' }}
                </p>
                <div class="flex flex-wrap items-center gap-2 mt-2">
                  @if (legacyModel().nsfw === true) {
                    <horde-badge variant="warning">NSFW</horde-badge>
                  } @else if (legacyModel().nsfw === false) {
                    <horde-badge variant="success">SFW</horde-badge>
                  } @else {
                    <horde-badge variant="secondary">Unknown</horde-badge>
                  }
                  @if (tags().length > 0) {
                    @for (tag of tags(); track tag) {
                      <span class="tag tag-primary">{{ tag }}</span>
                    }
                  }
                </div>
              </div>
              <div class="flex flex-col gap-2 flex-shrink-0">
                <app-model-row-actions
                  [model]="model()"
                  layout="vertical"
                  [writable]="writable()"
                  (showJson)="showJson.emit($event)"
                  (edit)="edit.emit($event)"
                  (delete)="delete.emit($event)"
                />
                <a
                  [routerLink]="['/categories', category(), 'audit']"
                  [queryParams]="{ search: model().name }"
                  class="btn btn-sm btn-secondary w-full"
                >
                  Performance Info
                </a>
              </div>
            </div>

            <!-- Main Content -->
            @defer (on viewport; prefetch on hover) {
              <app-model-row-fields [model]="model()" mode="grid" />
            } @placeholder {
              <div class="py-4">
                <div class="animate-pulse space-y-3">
                  <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                  <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                  <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
                </div>
              </div>
            }

            <!-- Backend/Author Variations Section (Grouped Text Models) -->
            @if (isGrouped() && groupedModel()) {
              @defer (on viewport; prefetch on hover) {
                <app-model-row-variations
                  [variations]="groupedModel()!.variations"
                  [groupName]="groupedModel()!.name"
                  [groupSummary]="groupedModel()!.groupSummary"
                />
              } @placeholder {
                <div class="py-4">
                  <div class="animate-pulse space-y-2">
                    <div class="h-6 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    <div class="h-6 bg-gray-200 dark:bg-gray-700 rounded"></div>
                  </div>
                </div>
              }
            }

            <!-- Showcases Section -->
            @if (hasShowcaseContent()) {
              @defer (on viewport; prefetch on hover) {
                <app-model-row-showcases
                  [showcases]="showcases()"
                  [modelName]="model().name"
                  layout="grid"
                  [initiallyExpanded]="showcaseExpanded()"
                />
              } @placeholder {
                <div class="py-4">
                  <div class="animate-pulse">
                    <div class="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
                  </div>
                </div>
              }
            }
          </div>
        </td>
      </tr>
    }
  `,
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModelRowComponent {
  readonly model = input.required<UnifiedModelData | GroupedTextModel>();
  readonly allModels = input<(UnifiedModelData | GroupedTextModel)[]>([]);
  readonly writable = input<boolean>(false);
  readonly isEven = input<boolean>(false);
  readonly isTextGeneration = input<boolean>(false);
  readonly category = input<string>('');
  readonly expandedRows = input<Set<string>>(new Set());
  readonly expandedShowcases = input<Set<string>>(new Set());
  readonly hordeStatsState = input<'idle' | 'loading' | 'success' | 'error'>('idle');

  readonly pendingOverlay = input<PendingChangeOverlay | undefined>(undefined);

  readonly showJson = output<LegacyRecordUnion>();
  readonly edit = output<string>();
  readonly delete = output<string>();
  readonly toggleRow = output<string>();
  readonly viewPendingChange = output<number>();

  readonly isGhost = computed(() => !!this.pendingOverlay()?.isGhost);
  readonly hasPendingIndicator = computed(() => {
    const overlay = this.pendingOverlay();
    return !!overlay && !overlay.isGhost;
  });
  readonly pendingRowClass = computed(() => {
    const overlay = this.pendingOverlay();
    if (!overlay) return '';
    if (overlay.isGhost) return 'ghost-row';
    if (overlay.pendingOperation === 'delete') return 'pending-indicator-delete';
    if (overlay.pendingOperation === 'update') return 'pending-indicator-update';
    return '';
  });
  readonly pendingBadgeText = computed(() => {
    const overlay = this.pendingOverlay();
    if (!overlay) return '';
    if (overlay.isGhost) return 'Pending Creation';
    if (overlay.pendingOperation === 'delete') return 'Pending Deletion';
    if (overlay.pendingOperation === 'update') return 'Pending Update';
    return '';
  });
  readonly pendingBadgeClass = computed(() => {
    const overlay = this.pendingOverlay();
    if (!overlay) return '';
    if (overlay.isGhost) return 'badge badge-warning badge-xs';
    if (overlay.pendingOperation === 'delete') return 'badge badge-danger badge-xs';
    if (overlay.pendingOperation === 'update') return 'badge badge-warning badge-xs';
    return '';
  });

  readonly expanded = computed(() => this.expandedRows().has(this.model().name));

  readonly hasShowcaseContent = computed(() => hasShowcases(this.model()));

  readonly isActive = computed(() => hasActiveWorkers(this.model()));

  readonly activeIndicatorClass = computed(() => {
    const statsState = this.hordeStatsState();
    const workerCount = this.model().workerCount ?? 0;

    // Show loading indicator (pulsing blue)
    if (statsState === 'loading') {
      return {
        'animate-pulse': true,
        'bg-primary-500': true,
        'dark:bg-primary-400': true,
      };
    }

    // Show error/unknown state (grey)
    if (statsState === 'error' || statsState === 'idle') {
      return {
        'bg-gray-400': true,
        'dark:bg-gray-500': true,
      };
    }

    // Show normal states based on worker count
    if (workerCount === 0) {
      return {
        'bg-danger-500': true,
        'dark:bg-danger-400': true,
      };
    } else if (workerCount >= 1 && workerCount <= 3) {
      return {
        'bg-warning-500': true,
        'dark:bg-warning-400': true,
      };
    } else {
      return {
        'bg-success-500': true,
        'dark:bg-success-400': true,
      };
    }
  });

  readonly isGrouped = computed(() => isGroupedTextModel(this.model()));

  readonly groupedModel = computed(() => {
    return this.isGrouped() ? (this.model() as GroupedTextModel) : null;
  });

  readonly groupSizes = computed(() => this.groupedModel()?.groupSummary?.available_sizes ?? []);

  readonly workerCountTooltip = computed(() => {
    const statsState = this.hordeStatsState();
    const count = this.model().workerCount ?? 0;
    const suffix = this.isGrouped() ? ' (across all backends/authors)' : '';

    if (statsState === 'loading') {
      return 'Loading Horde statistics...';
    }

    if (statsState === 'error') {
      return 'Failed to load Horde statistics';
    }

    if (statsState === 'idle') {
      return 'Horde statistics not available for this category';
    }

    return `${count} worker${count === 1 ? '' : 's'} serving this model${suffix}`;
  });

  readonly legacyModel = computed(() => this.model() as LegacyRecordUnion);

  readonly baselineDisplay = computed(() => {
    const model = this.legacyModel();
    if (isLegacyStableDiffusionRecord(model) && model.baseline) {
      return BASELINE_SHORTHAND_MAP[model.baseline] || model.baseline;
    }
    return '';
  });

  readonly isStableDiffusionRecord = computed(() =>
    isLegacyStableDiffusionRecord(this.legacyModel()),
  );

  readonly isTextGenerationRecord = computed(() =>
    isLegacyTextGenerationRecord(this.legacyModel()),
  );

  readonly tags = computed(() => {
    const model = this.legacyModel();
    if (isLegacyStableDiffusionRecord(model) && model.tags) {
      return model.tags;
    }
    if (isLegacyTextGenerationRecord(model) && model.tags) {
      return model.tags;
    }
    return [];
  });

  readonly originalIndex = computed(() => {
    return ((this.model() as Record<string, unknown>)['originalIndex'] as number) ?? 0;
  });

  readonly showcases = computed(() => {
    const model = this.legacyModel();
    if (isLegacyStableDiffusionRecord(model)) {
      return model.showcases ?? null;
    }
    return null;
  });

  readonly showcaseExpanded = computed(() => this.expandedShowcases().has(this.model().name));

  readonly detailColspan = computed(() => (this.isTextGeneration() ? 10 : 10));

  toggleExpansion(): void {
    this.toggleRow.emit(this.model().name);
  }
}
