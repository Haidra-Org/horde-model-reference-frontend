import { Component, input, computed, ChangeDetectionStrategy, inject } from '@angular/core';
import { HordeBadgeComponent, type BadgeVariant } from '@haidra/design-system/badge';
import {
  LegacyRecordUnion,
  isLegacyStableDiffusionRecord,
  isLegacyTextGenerationRecord,
  isLegacyClipRecord,
} from '../../models';
import {
  UnifiedModelData,
  GroupedTextModel,
  hasHordeData,
  isGroupedTextModel,
} from '../../models/unified-model';
import { BASELINE_SHORTHAND_MAP } from '../../models/maps';
import { getFieldsForModel, ModelFieldConfig } from './model-row-field.config';
import { formatRequirements, hasRequirements, getObjectKeysLength } from './model-row.utils';
import {
  getParameterHeatmapClass,
  formatParametersInBillions,
} from '../../utils/parameter-heatmap.utils';
import { formatAsMegapixelsteps } from '../../utils/pixelstep-formatting.utils';
import { TooltipDirective } from '../common/tooltip.directive';
import { HordeApiService } from '../../services/horde-api.service';

@Component({
  selector: 'app-model-row-fields',
  imports: [TooltipDirective, HordeBadgeComponent],
  template: `
    @if (mode() === 'grid') {
      <div>
        <!-- Technical Specifications -->
        <section class="detail-panel">
          <h4 class="detail-section-heading">Technical Specifications</h4>
          <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-3">
            @for (field of technicalFields(); track field.label) {
              <div>
                <div class="field-label">{{ field.label }}</div>
                <div [class]="getValueClass(field)">
                  {{ getDisplayValue(field) }}
                  @if (field.label === 'Baseline' && optimization()) {
                    <span class="text-muted text-xs ml-1">({{ optimization() }})</span>
                  }
                </div>
              </div>
            }
          </div>
        </section>

        <!-- Horde Status -->
        @if (showHordeStatus() || isHordeLoading()) {
          <section class="detail-panel">
            <h4 class="detail-section-heading">
              Horde Status
              @if (isGroupedWithAggregatedStats()) {
                <horde-badge
                  variant="info"
                  class="text-xs ml-2 normal-case tracking-normal"
                  title="Statistics aggregated from {{
                    groupedModel()!.variations.length
                  }} model variations"
                >
                  Aggregated ({{ groupedModel()!.variations.length }} variants)
                </horde-badge>
              }
            </h4>
            @if (isHordeLoading()) {
              <div class="flex items-center py-4 text-gray-500 dark:text-gray-400">
                <svg class="animate-spin h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24">
                  <circle
                    class="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    stroke-width="4"
                  ></circle>
                  <path
                    class="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                <span class="text-sm">Loading Horde status...</span>
              </div>
            } @else {
              <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-3">
                <div>
                  <div class="field-label">Active Workers</div>
                  <div class="field-value">
                    <horde-badge [variant]="workerCountVariant()">
                      {{ model().workerCount ?? 0 }}
                    </horde-badge>
                  </div>
                </div>
                @if (model().queuedJobs !== null && model().queuedJobs !== undefined) {
                  <div>
                    <div class="field-label">Queued Jobs</div>
                    <div class="field-value">
                      {{ model().queuedJobs }}
                      <span class="text-muted text-sm">{{ queuedJobsUnit() }}</span>
                    </div>
                  </div>
                }
                @if (model().performance !== null && model().performance !== undefined) {
                  <div>
                    <div class="field-label">Performance</div>
                    <div class="field-value">
                      @if (isImageModel()) {
                        <span [appTooltip]="performanceTooltip()">
                          {{ performanceDisplay() }}
                          <span class="text-muted text-sm">megapixelsteps</span>
                        </span>
                      } @else {
                        {{ performanceFormatted() }}
                        <span class="text-muted text-sm">tokens/s</span>
                      }
                    </div>
                  </div>
                }
                @if (model().eta !== null && model().eta !== undefined) {
                  <div>
                    <div class="field-label">Estimated Wait Time</div>
                    <div class="field-value">{{ etaDisplay() }}</div>
                  </div>
                }
                @if (model().queued !== null && model().queued !== undefined) {
                  <div>
                    <div class="field-label">Queued {{ queuedUnit() }}</div>
                    <div class="field-value">
                      @if (isImageModel()) {
                        <span [appTooltip]="queuedTooltip()">
                          {{ queuedDisplay() }}
                          <span class="text-muted text-sm">megapixelsteps</span>
                        </span>
                      } @else {
                        {{ model().queued?.toLocaleString() }}
                        <span class="text-muted text-sm">tokens</span>
                      }
                    </div>
                  </div>
                }
              </div>
              @if (model().usageStats) {
                <div class="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                  <div class="field-label mb-2">Usage Statistics</div>
                  <div class="grid grid-cols-3 gap-4">
                    <div>
                      <div class="text-xs text-muted">Last 24h</div>
                      <div class="text-base font-semibold text-gray-900 dark:text-gray-100">
                        {{ usageStatsDay().toLocaleString() }}
                        <span class="text-xs text-muted">{{ usageStatsUnit() }}</span>
                      </div>
                    </div>
                    <div>
                      <div class="text-xs text-muted">Last 30d</div>
                      <div class="text-base font-semibold text-gray-900 dark:text-gray-100">
                        {{ usageStatsMonth().toLocaleString() }}
                        <span class="text-xs text-muted">{{ usageStatsUnit() }}</span>
                      </div>
                    </div>
                    <div>
                      <div class="text-xs text-muted">All Time</div>
                      <div class="text-base font-semibold text-gray-900 dark:text-gray-100">
                        {{ usageStatsTotal().toLocaleString() }}
                        <span class="text-xs text-muted">{{ usageStatsUnit() }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              }
            }
          </section>
        }

        <!-- Links & Resources -->
        @if (linkFieldsWithValues().length > 0 || arrayFieldsWithValues().length > 0) {
          <section class="detail-panel">
            <h4 class="detail-section-heading">Links & Resources</h4>
            <div class="space-y-3">
              @for (field of linkFieldsWithValues(); track field.label) {
                <div>
                  <div class="field-label">{{ field.label }}</div>
                  <div class="field-value">
                    <a
                      [href]="getValue(field)"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="link inline-flex items-center gap-1 break-all"
                    >
                      {{ getValue(field) }}
                      <svg
                        class="w-3.5 h-3.5 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                        ></path>
                      </svg>
                    </a>
                  </div>
                </div>
              }
              @for (field of arrayFieldsWithValues(); track field.label) {
                <div>
                  <div class="field-label">{{ field.label }}</div>
                  <div class="field-value">
                    <div class="flex flex-wrap gap-1.5">
                      @for (item of getArrayValue(field); track item) {
                        <span class="tag tag-success">{{ item }}</span>
                      }
                    </div>
                  </div>
                </div>
              }
            </div>
          </section>
        }

        <!-- Requirements -->
        @if (showRequirements()) {
          <section class="detail-panel">
            <h4 class="detail-section-heading">Model Parameter Requirements</h4>
            <div class="code-block">
              <pre>{{ getRequirementsText() }}</pre>
            </div>
          </section>
        }
      </div>
    } @else {
      <div class="flex flex-wrap gap-2">
        @for (badge of badges(); track badge.label) {
          <span class="badge" [class]="badge.class">{{ badge.label }}: {{ badge.value }}</span>
        }
      </div>

      <div class="grid md:grid-cols-2 gap-4">
        @for (field of detailFieldsWithValues(); track field.label) {
          <div [class.md:col-span-2]="field.colspan === 4">
            <div class="field-label">{{ field.label }}</div>
            <div [class]="getValueClass(field)">
              @if (field.type === 'link') {
                <a [href]="getValue(field)" target="_blank" rel="noopener noreferrer" class="link">
                  {{ getValue(field) }}
                </a>
              } @else if (field.type === 'array') {
                {{ getArrayValue(field)!.join(', ') }}
              } @else {
                {{ getDisplayValue(field) }}
              }
            </div>
          </div>
        }

        @if (showRequirements()) {
          <div class="md:col-span-2">
            <div class="field-label">Requirements</div>
            <div class="code-block">
              <pre>{{ getRequirementsText() }}</pre>
            </div>
          </div>
        }
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModelRowFieldsComponent {
  private readonly hordeApi = inject(HordeApiService);

  readonly model = input.required<UnifiedModelData | GroupedTextModel>();
  readonly mode = input<'grid' | 'card'>('grid');

  readonly isGrouped = computed(() => isGroupedTextModel(this.model()));
  readonly groupedModel = computed(() => {
    return this.isGrouped() ? (this.model() as GroupedTextModel) : null;
  });
  readonly isGroupedWithAggregatedStats = computed(() => {
    const grouped = this.groupedModel();
    return grouped !== null && grouped.hasAggregatedStats === true;
  });

  readonly fields = computed(() => getFieldsForModel(this.model() as LegacyRecordUnion));

  readonly showRequirements = computed(() => hasRequirements(this.model() as LegacyRecordUnion));

  readonly showHordeStatus = computed(() => hasHordeData(this.model()));

  readonly isHordeLoading = computed(() => {
    // Only show loading if we haven't loaded data yet and it's for a category that has Horde data
    const hasData = hasHordeData(this.model());
    const isLoading = this.hordeApi.isLoading();
    // Show loading only when we're loading and don't have data yet
    return isLoading && !hasData;
  });

  readonly workerCountVariant = computed((): BadgeVariant => {
    const count = this.model().workerCount ?? 0;
    return count > 0 ? 'success' : 'secondary';
  });

  readonly queuedUnit = computed(() => {
    const model = this.model();
    if (isLegacyStableDiffusionRecord(model as LegacyRecordUnion)) {
      return 'megapixelsteps';
    }
    if (isLegacyTextGenerationRecord(model as LegacyRecordUnion)) {
      return 'tokens';
    }
    return 'items';
  });

  readonly etaDisplay = computed(() => {
    const eta = this.model().eta as number | null | undefined;
    if (eta == null) return '-';
    if (eta < 60) return `${Math.round(eta)}s`;
    if (eta < 3600) return `${Math.round(eta / 60)}m`;
    return `${Math.round(eta / 3600)}h`;
  });

  readonly optimization = computed(() => {
    const model = this.model() as LegacyRecordUnion;
    if (isLegacyStableDiffusionRecord(model) && model.optimization) {
      const opt = model.optimization.trim();
      return opt !== '' ? opt : null;
    }
    return null;
  });

  readonly isImageModel = computed(() => {
    return isLegacyStableDiffusionRecord(this.model() as LegacyRecordUnion);
  });

  readonly performanceDisplay = computed(() => {
    const performance = this.model().performance as number | null | undefined;
    if (performance == null) return '-';
    if (this.isImageModel()) {
      return formatAsMegapixelsteps(performance);
    }
    return performance.toFixed(2);
  });

  readonly performanceTooltip = computed(() => {
    return 'A typical image requires 20 steps on average.';
  });

  readonly queuedDisplay = computed(() => {
    const queued = this.model().queued as number | null | undefined;
    if (queued == null) return '-';
    if (this.isImageModel()) {
      return formatAsMegapixelsteps(queued);
    }
    return queued.toLocaleString();
  });

  readonly queuedTooltip = computed(() => {
    return 'A megapixel is 1 million pixels (a 1024x1025 pixel image). A typical image requires 20 steps on average. Image generations take time proportional to the number of megapixelsteps times steps.';
  });

  readonly queuedJobsUnit = computed(() => {
    if (this.isImageModel()) {
      return 'images';
    }
    return 'requests';
  });

  readonly usageStatsUnit = computed(() => {
    if (this.isImageModel()) {
      return 'images';
    }
    return 'requests';
  });

  readonly performanceFormatted = computed(() => {
    const performance = this.model().performance as number | null | undefined;
    return performance?.toFixed(2) ?? null;
  });

  readonly usageStatsDay = computed(() => {
    const model = this.model();
    const stats = model.usageStats as
      | { day?: number; month?: number; total?: number }
      | null
      | undefined;
    return stats?.day ?? 0;
  });

  readonly usageStatsMonth = computed(() => {
    const model = this.model();
    const stats = model.usageStats as
      | { day?: number; month?: number; total?: number }
      | null
      | undefined;
    return stats?.month ?? 0;
  });

  readonly usageStatsTotal = computed(() => {
    const model = this.model();
    const stats = model.usageStats as
      | { day?: number; month?: number; total?: number }
      | null
      | undefined;
    return stats?.total ?? 0;
  });

  readonly badges = computed(() => {
    const model = this.model() as LegacyRecordUnion;
    const result: { label: string; value: string; class: string }[] = [];

    if (isLegacyStableDiffusionRecord(model)) {
      result.push({
        label: 'Baseline',
        value: BASELINE_SHORTHAND_MAP[model.baseline] || model.baseline,
        class: 'badge-info',
      });
      if (model.type) {
        result.push({ label: 'Type', value: model.type, class: 'badge-secondary' });
      }
      if (model.style) {
        result.push({ label: 'Style', value: model.style, class: 'badge-secondary' });
      }
      if (model.optimization) {
        result.push({
          label: 'Optimization',
          value: model.optimization,
          class: 'badge-secondary',
        });
      }
      if (model.min_bridge_version) {
        result.push({
          label: 'Min Bridge',
          value: model.min_bridge_version.toString(),
          class: 'badge-secondary',
        });
      }
      if (model.size_on_disk_bytes) {
        result.push({
          label: 'Size',
          value: (model.size_on_disk_bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB',
          class: 'badge-secondary',
        });
      }
      result.push({
        label: 'Requirements',
        value: model.requirements ? getObjectKeysLength(model.requirements).toString() : '0',
        class: 'badge-secondary',
      });
    } else if (isLegacyTextGenerationRecord(model)) {
      if (model.baseline) {
        result.push({ label: 'Baseline', value: model.baseline, class: 'badge-info' });
      }
      if (model.text_model_group) {
        result.push({ label: 'Group', value: model.text_model_group, class: 'badge-info' });
      }
      if (model.type) {
        result.push({ label: 'Type', value: model.type, class: 'badge-secondary' });
      }
      if (model.style) {
        result.push({ label: 'Style', value: model.style, class: 'badge-secondary' });
      }
      if (model.parameters) {
        result.push({
          label: 'Parameters',
          value: formatParametersInBillions(model.parameters),
          class: `pc-badge ${getParameterHeatmapClass(model.parameters)}`,
        });
      }
      if (model.settings) {
        result.push({
          label: 'Settings',
          value: getObjectKeysLength(model.settings).toString(),
          class: 'badge-secondary',
        });
      }
    } else if (isLegacyClipRecord(model)) {
      if (model.type) {
        result.push({ label: 'Type', value: model.type, class: 'badge-info' });
      }
      if (model.style) {
        result.push({ label: 'Style', value: model.style, class: 'badge-secondary' });
      }
      if (model.version) {
        result.push({ label: 'Model Version', value: model.version, class: 'badge-secondary' });
      }
    }

    return result;
  });

  readonly technicalFields = computed(() => {
    const allFields = this.fields();
    return allFields.filter((f) => f.type !== 'link' && f.type !== 'array');
  });

  readonly linkFields = computed(() => {
    const allFields = this.fields();
    return allFields.filter((f) => f.type === 'link');
  });

  readonly arrayFields = computed(() => {
    const allFields = this.fields();
    return allFields.filter((f) => f.type === 'array');
  });

  readonly detailFields = computed(() => {
    const allFields = this.fields();
    return allFields.filter((f) => f.type === 'link' || f.type === 'array' || f.colspan === 4);
  });

  readonly linkFieldsWithValues = computed(() => {
    return this.linkFields().filter((field) => {
      const value = this.getValue(field);
      return value && value.trim() !== '';
    });
  });

  readonly arrayFieldsWithValues = computed(() => {
    const mode = this.mode();
    return this.arrayFields().filter((field) => {
      // Skip triggers in card mode
      if (mode === 'card' && field.label === 'Triggers') {
        return false;
      }
      const arrayValue = this.getArrayValue(field);
      return arrayValue && arrayValue.length > 0;
    });
  });

  readonly detailFieldsWithValues = computed(() => {
    return this.detailFields().filter((field) => {
      if (field.type === 'link') {
        const value = this.getValue(field);
        return value && value.trim() !== '';
      } else if (field.type === 'array') {
        const arrayValue = this.getArrayValue(field);
        return arrayValue && arrayValue.length > 0;
      }
      return true;
    });
  });

  getValue(field: ModelFieldConfig): string {
    const value = field.getValue(this.model() as LegacyRecordUnion);
    if (value == null) return '';
    return String(value);
  }

  getArrayValue(field: ModelFieldConfig): string[] | null {
    const value = field.getValue(this.model() as LegacyRecordUnion);
    if (Array.isArray(value)) {
      return value;
    }
    return null;
  }

  getDisplayValue(field: ModelFieldConfig): string {
    const rawValue = field.getValue(this.model() as LegacyRecordUnion);
    if (rawValue == null) return '-';

    if (field.formatValue) {
      return field.formatValue(rawValue);
    }

    return String(rawValue);
  }

  getValueClass(field: ModelFieldConfig): string {
    if (field.type === 'link') {
      return 'text-gray-600 dark:text-gray-400 break-all';
    }
    return 'field-value';
  }

  getRequirementsText(): string {
    const model = this.model() as LegacyRecordUnion;
    if (isLegacyStableDiffusionRecord(model) && model.requirements) {
      return formatRequirements(model.requirements);
    }
    return '';
  }
}
