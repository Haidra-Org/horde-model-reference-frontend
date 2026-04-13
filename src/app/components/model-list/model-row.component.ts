import { Component, input, output, computed, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
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
import { ModelRowFieldsComponent } from './model-row-fields.component';
import { ModelRowShowcasesComponent } from './model-row-showcases.component';
import { ModelRowVariationsComponent } from './model-row-variations.component';
import { ModelRowActionsComponent } from './model-row-actions.component';
import { hasShowcases } from './model-row.utils';

@Component({
  selector: 'app-model-row',
  imports: [
    RouterLink,
    HordeButtonComponent,
    ModelRowFieldsComponent,
    ModelRowShowcasesComponent,
    ModelRowVariationsComponent,
    ModelRowActionsComponent,
  ],
  template: `
    <!-- Compact Table Mode -->
    <tr
      [class]="rowClass()"
      (click)="
        isGhost() ? viewPendingChange.emit(pendingOverlay()!.pendingChangeId) : toggleExpansion()
      "
    >
      <td class="model-row-expand-cell">
        <button
          type="button"
          class="model-row-expand-button"
          [attr.aria-label]="expanded() ? 'Collapse row details' : 'Expand row details'"
          (click)="
            $event.stopPropagation();
            isGhost() ? viewPendingChange.emit(pendingOverlay()!.pendingChangeId) : toggleExpansion()
          "
        >
          <svg
            class="model-row-expand-icon"
            [class.rotate-90]="expanded()"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 5l7 7-7 7"
            ></path>
          </svg>
        </button>
      </td>
      <td class="model-row-index-cell">
        <span class="model-row-index-pill">#{{ originalIndex() + 1 }}</span>
      </td>
      <td class="model-row-active-cell" [title]="workerCountTooltip()">
        <span class="model-row-active-badge">
          <span class="model-row-active-dot" [class]="activeIndicatorClass()"></span>
        </span>
      </td>
      <td class="model-row-model-cell">
        <div class="model-row-model-stack">
          <div class="model-row-model-head">
          @if (isGrouped()) {
            <a
              [routerLink]="['/categories', 'text_generation', 'group', model().name]"
              class="model-row-group-link"
              title="View group"
              (click)="$event.stopPropagation()"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </a>
          }

            <span class="model-row-model-name">{{ model().name }}</span>

            @if (modelVersion(); as version) {
              <span class="model-row-version-pill">v{{ version }}</span>
            }

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

          <p class="model-row-model-description">{{ modelDescription() }}</p>
        </div>
      </td>
      <td class="model-row-baseline-cell">
        @if (baselineText(); as baseline) {
          <span class="model-row-baseline-pill" [title]="baselineTooltip()">
            <span class="model-row-baseline-pill-text">{{ baseline }}</span>
          </span>
        } @else {
          <span class="model-row-muted">-</span>
        }
      </td>
      <td class="model-row-tags-cell">
        @if (tags().length > 0) {
          <div class="model-row-tag-list">
            @for (tag of tags().slice(0, 2); track tag) {
              <span class="model-row-tag-pill">{{ tag }}</span>
            }
            @if (tags().length > 2) {
              <span class="model-row-tag-more">+{{ tags().length - 2 }}</span>
            }
          </div>
        } @else {
          <span class="model-row-muted">No tags</span>
        }
      </td>
      @if (isTextGeneration()) {
        <td class="model-row-variations-cell">
          @if (isGrouped() && groupedModel()) {
            <div class="model-row-variation-stack">
              <span class="model-row-variation-count">{{ groupedModel()!.variations.length }} vars</span>
              @if (groupSizes().length > 0) {
                <span class="model-row-variation-meta">
                  {{ groupSizes().slice(0, 2).join(' · ') }}
                  @if (groupSizes().length > 3) {
                    +{{ groupSizes().length - 2 }}
                  }
                </span>
              }
            </div>
          } @else {
            <span class="model-row-variation-count">Single</span>
          }
        </td>
      }
      @if (!isTextGeneration()) {
        <td class="model-row-nsfw-cell">
          @if (legacyModel().nsfw === true) {
            <span class="model-row-state-pill model-row-state-pill-warning">NSFW</span>
          } @else if (legacyModel().nsfw === false) {
            <span class="model-row-state-pill model-row-state-pill-success">SFW</span>
          } @else {
            <span class="model-row-state-pill model-row-state-pill-secondary">Unknown</span>
          }
        </td>
      }
      <td class="model-row-workers-cell">
        <span class="model-row-workers-pill">{{ model().workerCount ?? 0 }}</span>
      </td>
      <td class="model-row-actions-cell">
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
      <tr [class]="(isEven() ? 'table-row-even' : 'table-row-odd') + ' detail-row model-detail-row'">
        <td [attr.colspan]="detailColspan()">
          <div class="detail-section model-detail-section">
            <div
              class="model-detail-hero"
              [class.model-detail-hero--text]="isTextModelContext()"
              [class.model-detail-hero--image]="isImageModel()"
            >
              <div class="model-detail-hero-main">
                <div class="model-detail-hero-title-row">
                  <h3 class="model-detail-hero-title">{{ model().name }}</h3>
                  <span class="model-detail-kind-badge">{{ detailKindLabel() }}</span>
                </div>
                <p class="model-detail-hero-description">
                  {{ detailDescription() }}
                </p>

                <div class="model-detail-kpi-strip">
                  @if (baselineText(); as baseline) {
                    <span
                      class="model-detail-kpi-pill model-detail-kpi-pill--baseline"
                      [title]="baselineTooltip()"
                    >
                      <span class="model-detail-kpi-key">Baseline</span>
                      <span class="model-detail-kpi-value-truncate">{{ baseline }}</span>
                    </span>
                  }

                  <span class="model-detail-kpi-pill">{{ model().workerCount ?? 0 }} workers</span>

                  @if (model().queuedJobs !== null && model().queuedJobs !== undefined) {
                    <span class="model-detail-kpi-pill">
                      {{ model().queuedJobs }} queued
                    </span>
                  }

                  @if (isGrouped() && groupedModel()) {
                    <span class="model-detail-kpi-pill">
                      {{ groupedVariationCount() }} variants
                    </span>
                    <span class="model-detail-kpi-pill">
                      {{ groupedBackendCount() }} backends
                    </span>
                    <span class="model-detail-kpi-pill">
                      {{ groupedAuthorCount() }} authors
                    </span>
                    @if (groupSizes().length > 0) {
                      <span class="model-detail-kpi-pill model-detail-kpi-pill--subtle">
                        {{ groupSizes().slice(0, 3).join(' · ') }}
                        @if (groupSizes().length > 3) {
                          +{{ groupSizes().length - 3 }}
                        }
                      </span>
                    }
                  } @else {
                    @if (tags().length > 0) {
                      @for (tag of tags().slice(0, 3); track tag) {
                        <span class="model-detail-kpi-pill model-detail-kpi-pill--subtle">
                          {{ tag }}
                        </span>
                      }
                      @if (tags().length > 3) {
                        <span class="model-detail-kpi-pill model-detail-kpi-pill--subtle">
                          +{{ tags().length - 3 }}
                        </span>
                      }
                    }
                    @if (legacyModel().nsfw === true) {
                      <span class="model-detail-kpi-pill model-detail-kpi-pill--warning">NSFW</span>
                    } @else if (legacyModel().nsfw === false) {
                      <span class="model-detail-kpi-pill model-detail-kpi-pill--success">SFW</span>
                    }
                  }
                </div>
              </div>

              <div class="model-detail-hero-actions">
                <app-model-row-actions
                  [model]="legacyModel()"
                  layout="horizontal"
                  [writable]="writable()"
                  (showJson)="showJson.emit($event)"
                  (edit)="edit.emit($event)"
                  (delete)="delete.emit($event)"
                />
                <a
                  [routerLink]="['/categories', category(), 'audit']"
                  [queryParams]="{ search: model().name }"
                  class="btn btn-sm btn-secondary model-row-audit-link"
                >
                  <svg class="model-row-audit-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-6m6 6V7m6 10V4M3 20h18" />
                  </svg>
                  <span>Audit</span>
                </a>
              </div>
            </div>

            <div class="model-detail-layout" [class.model-detail-layout--text]="isGrouped()">
              @if (isGrouped() && groupedModel()) {
                <div class="model-detail-column model-detail-column--primary">
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
                </div>

                <div class="model-detail-column">
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
                </div>
              } @else {
                <div class="model-detail-column model-detail-column--primary">
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
                </div>

                @if (hasShowcaseContent()) {
                  <div class="model-detail-column model-detail-column--media">
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
                  </div>
                }
              }
            </div>
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
  readonly rowClass = computed(() => {
    const classes = [
      'model-table-row',
      this.isEven() ? 'table-row-even' : 'table-row-odd',
      this.rowStateClass(),
    ];
    const pendingClass = this.pendingRowClass();
    if (pendingClass) {
      classes.push(pendingClass);
    }
    return classes.join(' ');
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

  readonly isImageModel = computed(() => this.isStableDiffusionRecord());

  readonly isTextModelContext = computed(() => this.isGrouped() || this.isTextGenerationRecord());

  readonly groupedModel = computed(() => {
    return this.isGrouped() ? (this.model() as GroupedTextModel) : null;
  });

  readonly groupedVariationCount = computed(() => this.groupedModel()?.variations.length ?? 0);

  readonly groupedBackendCount = computed(() => this.groupedModel()?.availableBackends.length ?? 0);

  readonly groupedAuthorCount = computed(() => this.groupedModel()?.availableAuthors.length ?? 0);

  readonly groupSizes = computed(() => this.groupedModel()?.groupSummary?.available_sizes ?? []);

  readonly detailKindLabel = computed(() => {
    if (this.isGrouped()) {
      return 'Grouped Text Model';
    }

    if (this.isStableDiffusionRecord()) {
      return 'Image Generation Model';
    }

    if (this.isTextGenerationRecord()) {
      return 'Text Model';
    }

    return 'Model';
  });

  readonly detailDescription = computed(() => {
    const raw = this.legacyModel().description?.trim();
    if (raw) {
      return raw;
    }

    if (this.isGrouped()) {
      return 'Grouped text model with multiple backend and author variations.';
    }

    if (this.isStableDiffusionRecord()) {
      return 'Image generation model. Expand technical sections for worker coverage and requirements.';
    }

    return 'No description provided.';
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

  readonly activeStateLabel = computed(() => {
    const statsState = this.hordeStatsState();
    const workerCount = this.model().workerCount ?? 0;

    if (statsState === 'loading') {
      return 'Syncing';
    }

    if (statsState === 'error' || statsState === 'idle') {
      return 'Unknown';
    }

    if (workerCount === 0) {
      return 'Idle';
    }

    if (workerCount <= 3) {
      return 'Warm';
    }

    return 'Hot';
  });

  readonly rowStateClass = computed(() => {
    const statsState = this.hordeStatsState();
    const workerCount = this.model().workerCount ?? 0;

    if (statsState === 'loading') return 'row-state-loading';
    if (statsState === 'error' || statsState === 'idle') return 'row-state-unknown';
    if (workerCount === 0) return 'row-state-idle';
    if (workerCount <= 3) return 'row-state-warm';
    return 'row-state-hot';
  });

  readonly legacyModel = computed(() => this.model() as LegacyRecordUnion);

  readonly modelVersion = computed(() => {
    const model = this.legacyModel();
    if (!model.version || this.isTextGenerationRecord()) {
      return null;
    }
    return model.version;
  });

  readonly modelDescription = computed(() => {
    return this.legacyModel().description?.trim() || 'No description provided';
  });

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

  readonly baselineText = computed(() => {
    const model = this.legacyModel();
    if (isLegacyStableDiffusionRecord(model) && model.baseline) {
      return this.baselineDisplay();
    }

    if (isLegacyTextGenerationRecord(model)) {
      return model.baseline || null;
    }

    return null;
  });

  readonly baselineTooltip = computed(() => {
    const model = this.legacyModel();
    if (isLegacyStableDiffusionRecord(model)) {
      return model.baseline || '';
    }
    if (isLegacyTextGenerationRecord(model)) {
      return model.baseline || '';
    }
    return '';
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

  readonly detailColspan = computed(() => 9);

  toggleExpansion(): void {
    this.toggleRow.emit(this.model().name);
  }
}
