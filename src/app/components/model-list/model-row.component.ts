import { Component, input, output, computed, ChangeDetectionStrategy } from '@angular/core';
import {
  LegacyRecordUnion,
  isLegacyStableDiffusionRecord,
  isLegacyTextGenerationRecord,
} from '../../models';
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
import { ModelRowActionsComponent } from './model-row-actions.component';
import { hasShowcases } from './model-row.utils';

@Component({
  selector: 'app-model-row',
  imports: [
    ModelRowHeaderComponent,
    ModelRowFieldsComponent,
    ModelRowShowcasesComponent,
    ModelRowActionsComponent,
  ],
  template: `
    <!-- Compact Table Mode -->
    <tr
      [class]="
        'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ' +
        (isEven() ? 'table-row-even' : 'table-row-odd')
      "
      (click)="toggleExpansion()"
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
        <app-model-row-header [model]="model()" [allModels]="allModels()" mode="compact" />
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
      @if (!isTextGeneration()) {
        <td>
          @if (legacyModel().nsfw === true) {
            <span class="badge badge-warning">NSFW</span>
          } @else if (legacyModel().nsfw === false) {
            <span class="badge badge-success">SFW</span>
          } @else {
            <span class="badge badge-secondary">Unknown</span>
          }
        </td>
      }
      <td class="text-right whitespace-nowrap" (click)="$event.stopPropagation()">
        <app-model-row-actions
          [model]="model()"
          layout="horizontal"
          [writable]="writable()"
          (showJson)="showJson.emit($event)"
          (edit)="edit.emit($event)"
          (delete)="delete.emit($event)"
        />
      </td>
    </tr>

    <!-- Expanded Details Row -->
    @if (expanded()) {
      <tr [class]="(isEven() ? 'table-row-even' : 'table-row-odd') + ' detail-row'">
        <td [attr.colspan]="detailColspan()">
          <div class="detail-section">
            <!-- Overview Header -->
            <div class="card-overview">
              <div class="detail-header">
                <div class="detail-header-content">
                  <div class="flex items-center gap-2 mb-1">
                    <svg
                      class="card-overview-icon"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      ></path>
                    </svg>
                    <h3 class="card-overview-title">
                      {{ model().name }}
                    </h3>
                  </div>
                  <p class="card-overview-description mt-0.5 mb-0">
                    {{ legacyModel().description || 'No description available' }}
                  </p>
                </div>
                <div class="detail-header-meta">
                  @if (legacyModel().nsfw === true) {
                    <span class="badge badge-warning">NSFW</span>
                  } @else if (legacyModel().nsfw === false) {
                    <span class="badge badge-success">SFW</span>
                  } @else {
                    <span class="badge badge-secondary">Unknown</span>
                  }
                  @if (tags().length > 0) {
                    <div class="tag-container">
                      @for (tag of tags(); track tag) {
                        <span class="tag tag-primary">{{ tag }}</span>
                      }
                    </div>
                  }
                </div>
              </div>
            </div>

            <!-- Main Content -->
            @defer (on viewport; prefetch on hover) {
              <div>
                <app-model-row-fields [model]="model()" mode="grid" />
              </div>
            } @placeholder {
              <div class="p-4">
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
                <div class="card">
                  <div class="card-header">
                    <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Backend & Author Variations
                      <span class="label-hint">
                        ({{ groupedModel()!.variations.length }} total)
                      </span>
                    </h4>
                  </div>
                  <div class="card-body p-0">
                    <div class="overflow-x-auto">
                      <table class="w-full text-sm">
                        <thead class="bg-gray-50 dark:bg-gray-800">
                          <tr>
                            <th
                              class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                            >
                              Full Name
                            </th>
                            <th
                              class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                            >
                              Backend
                            </th>
                            <th
                              class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                            >
                              Author
                            </th>
                            <th
                              class="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                            >
                              Workers
                            </th>
                            <th
                              class="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                            >
                              Queued
                            </th>
                            <th
                              class="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                            >
                              Usage (Total)
                            </th>
                          </tr>
                        </thead>
                        <tbody
                          class="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700"
                        >
                          @for (variation of groupedModel()!.variations; track variation.name) {
                            <tr class="hover:bg-gray-50 dark:hover:bg-gray-800">
                              <td
                                class="px-4 py-2 font-mono text-xs text-gray-900 dark:text-gray-100"
                              >
                                {{ variation.name }}
                              </td>
                              <td class="px-4 py-2">
                                @if (variation.parsedName?.backend) {
                                  <span class="badge badge-info text-xs">{{
                                    variation.parsedName?.backend
                                  }}</span>
                                } @else {
                                  <span class="text-gray-400 dark:text-gray-500 text-xs">-</span>
                                }
                              </td>
                              <td class="px-4 py-2 text-gray-700 dark:text-gray-300">
                                {{ variation.parsedName?.author ?? '-' }}
                              </td>
                              <td class="px-4 py-2 text-center text-gray-700 dark:text-gray-300">
                                {{ variation.workerCount ?? 0 }}
                              </td>
                              <td class="px-4 py-2 text-center text-gray-700 dark:text-gray-300">
                                {{ variation.queuedJobs ?? 0 }}
                              </td>
                              <td class="px-4 py-2 text-right text-gray-700 dark:text-gray-300">
                                {{ variation.usageStats?.total ?? 0 }}
                              </td>
                            </tr>
                          }
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              } @placeholder {
                <div class="card">
                  <div class="card-body">
                    <div class="animate-pulse space-y-2">
                      <div class="h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
                      <div class="h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
                      <div class="h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    </div>
                  </div>
                </div>
              }
            }

            <!-- Showcases Section -->
            @if (hasShowcaseContent()) {
              @defer (on viewport; prefetch on hover) {
                <div class="card">
                  <div class="card-body p-0">
                    <app-model-row-showcases
                      [showcases]="showcases()"
                      [modelName]="model().name"
                      layout="grid"
                      [initiallyExpanded]="showcaseExpanded()"
                    />
                  </div>
                </div>
              } @placeholder {
                <div class="card">
                  <div class="card-body">
                    <div class="animate-pulse">
                      <div class="h-48 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    </div>
                  </div>
                </div>
              }
            }
          </div>
        </td>
      </tr>
    }
  `,
  styles: [':host { display: contents; }'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModelRowComponent {
  readonly model = input.required<UnifiedModelData | GroupedTextModel>();
  readonly allModels = input<(UnifiedModelData | GroupedTextModel)[]>([]);
  readonly writable = input<boolean>(false);
  readonly isEven = input<boolean>(false);
  readonly isTextGeneration = input<boolean>(false);
  readonly expandedRows = input<Set<string>>(new Set());
  readonly expandedShowcases = input<Set<string>>(new Set());
  readonly hordeStatsState = input<'idle' | 'loading' | 'success' | 'error'>('idle');

  readonly showJson = output<LegacyRecordUnion>();
  readonly edit = output<string>();
  readonly delete = output<string>();
  readonly toggleRow = output<string>();

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
        'bg-blue-500': true,
        'dark:bg-blue-400': true,
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

  readonly detailColspan = computed(() => (this.isTextGeneration() ? 8 : 9));

  toggleExpansion(): void {
    this.toggleRow.emit(this.model().name);
  }
}
