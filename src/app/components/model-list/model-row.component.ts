import {
  Component,
  input,
  output,
  signal,
  computed,
  ChangeDetectionStrategy,
  OnInit,
  OnChanges,
} from '@angular/core';
import {
  LegacyRecordUnion,
  isLegacyStableDiffusionRecord,
  isLegacyTextGenerationRecord,
} from '../../models';
import { UnifiedModelData, hasActiveWorkers, GroupedTextModel, isGroupedTextModel } from '../../models/unified-model';
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
      <td class="text-center" [title]="workerCountTooltip()">
        <span
          class="inline-block w-3 h-3 rounded-full"
          [class]="activeIndicatorClass()"
        ></span>
      </td>
      <td class="font-medium text-gray-900 dark:text-gray-100">
        <app-model-row-header [model]="model()" mode="compact" />
      </td>
      <td class="field-value max-w-md truncate">
        {{ legacyModel().description || '-' }}
      </td>
      <td>
        @if (isStableDiffusionRecord(model())) {
          {{ baselineDisplay() }}
        } @else if (isTextGenerationRecord(model())) {
          {{ legacyModel().baseline || '-' }}
        } @else {
          -
        }
      </td>
      <td class="max-w-xs">
        @if (tags().length > 0) {
          <span class="text-sm text-muted">
            {{ tags().slice(0, 3).join(', ') }}
            @if (tags().length > 3) {
              <span class="text-muted italic ml-1"> +{{ tags().length - 3 }} </span>
            }
          </span>
        } @else {
          -
        }
      </td>
      <td>
        @if (legacyModel().nsfw === true) {
          <span class="badge badge-warning">NSFW</span>
        } @else if (legacyModel().nsfw === false) {
          <span class="badge badge-success">SFW</span>
        } @else {
          <span class="badge badge-secondary">Unknown</span>
        }
      </td>
      <td (click)="$event.stopPropagation()">
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
      <tr
        [class]="
          (isEven() ? 'bg-gray-50 dark:bg-gray-700/30' : 'bg-white dark:bg-gray-800') +
          ' detail-row'
        "
      >
        <td colspan="8">
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
            <div>
              <app-model-row-fields [model]="model()" mode="grid" />
            </div>

            <!-- Backend/Author Variations Section (Grouped Text Models) -->
            @if (isGrouped() && groupedModel()) {
              <div class="card">
                <div class="card-header">
                  <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Backend & Author Variations
                    <span class="text-xs font-normal text-gray-500 dark:text-gray-400 ml-2">
                      ({{ groupedModel()!.variations.length }} total)
                    </span>
                  </h4>
                </div>
                <div class="card-body p-0">
                  <div class="overflow-x-auto">
                    <table class="w-full text-sm">
                      <thead class="bg-gray-50 dark:bg-gray-800">
                        <tr>
                          <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Full Name
                          </th>
                          <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Backend
                          </th>
                          <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Author
                          </th>
                          <th class="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Workers
                          </th>
                          <th class="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Queued
                          </th>
                          <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Usage (Total)
                          </th>
                        </tr>
                      </thead>
                      <tbody class="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                        @for (variation of groupedModel()!.variations; track variation.name) {
                          <tr class="hover:bg-gray-50 dark:hover:bg-gray-800">
                            <td class="px-4 py-2 font-mono text-xs text-gray-900 dark:text-gray-100">
                              {{ variation.name }}
                            </td>
                            <td class="px-4 py-2">
                              @if (variation.parsedName?.backend) {
                                <span class="badge badge-info text-xs">{{ variation.parsedName?.backend }}</span>
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
            }

            <!-- Showcases Section -->
            @if (hasShowcases(model())) {
              <div class="card">
                <div class="card-body p-0">
                  <app-model-row-showcases
                    [showcases]="getShowcases()"
                    [modelName]="model().name"
                    layout="grid"
                    [initiallyExpanded]="isShowcaseExpanded()"
                  />
                </div>
              </div>
            }
          </div>
        </td>
      </tr>
    }
  `,
  styles: [':host { display: contents; }'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModelRowComponent implements OnInit, OnChanges {
  readonly model = input.required<UnifiedModelData | GroupedTextModel>();
  readonly writable = input<boolean>(false);
  readonly isEven = input<boolean>(false);
  readonly expandedRows = input<Set<string>>(new Set());
  readonly expandedShowcases = input<Set<string>>(new Set());

  readonly showJson = output<LegacyRecordUnion>();
  readonly edit = output<string>();
  readonly delete = output<string>();
  readonly toggleRow = output<string>();

  readonly expanded = signal(false);

  readonly hasShowcases = hasShowcases;

  readonly isActive = computed(() => hasActiveWorkers(this.model()));

  readonly activeIndicatorClass = computed(() => {
    const workerCount = this.model().workerCount ?? 0;
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
    const count = this.model().workerCount ?? 0;
    const suffix = this.isGrouped() ? ' (across all backends/authors)' : '';
    return `${count} worker${count === 1 ? '' : 's'} serving this model${suffix}`;
  });

  readonly legacyModel = computed(() => this.model() as LegacyRecordUnion);

  readonly baselineDisplay = computed(() => {
    const model = this.legacyModel();
    if (isLegacyStableDiffusionRecord(model)) {
      return this.getBaselineDisplay(model.baseline);
    }
    return '';
  });

  readonly parametersDisplay = computed(() => {
    const model = this.legacyModel();
    if (isLegacyTextGenerationRecord(model) && model.parameters) {
      return model.parameters.toLocaleString();
    }
    return null;
  });

  ngOnInit(): void {
    this.expanded.set(this.expandedRows().has(this.model().name));
  }

  ngOnChanges(): void {
    this.expanded.set(this.expandedRows().has(this.model().name));
  }

  toggleExpansion(): void {
    this.toggleRow.emit(this.model().name);
  }

  isStableDiffusionRecord(model: UnifiedModelData) {
    return isLegacyStableDiffusionRecord(model as LegacyRecordUnion);
  }

  isTextGenerationRecord(model: UnifiedModelData) {
    return isLegacyTextGenerationRecord(model as LegacyRecordUnion);
  }

  getBaselineDisplay(baseline: string): string {
    return BASELINE_SHORTHAND_MAP[baseline] || baseline;
  }

  tags(): string[] {
    const model = this.legacyModel();
    if (isLegacyStableDiffusionRecord(model) && model.tags) {
      return model.tags;
    }
    if (isLegacyTextGenerationRecord(model) && model.tags) {
      return model.tags;
    }
    return [];
  }

  getShowcases(): string[] | null | undefined {
    const model = this.legacyModel();
    if (isLegacyStableDiffusionRecord(model)) {
      return model.showcases;
    }
    return null;
  }

  isShowcaseExpanded(): boolean {
    return this.expandedShowcases().has(this.model().name);
  }
}
