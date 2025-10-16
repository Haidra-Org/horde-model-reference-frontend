import { Component, input, computed, ChangeDetectionStrategy } from '@angular/core';
import {
  LegacyRecordUnion,
  isLegacyStableDiffusionRecord,
  isLegacyTextGenerationRecord,
  isLegacyClipRecord,
} from '../../models';
import { BASELINE_SHORTHAND_MAP } from '../../models/maps';
import { getFieldsForModel, ModelFieldConfig } from './model-row-field.config';
import { formatRequirements, hasRequirements, getObjectKeysLength } from './model-row.utils';
import {
  getParameterHeatmapClass,
  formatParametersInBillions,
} from '../../utils/parameter-heatmap.utils';

@Component({
  selector: 'app-model-row-fields',
  template: `
    @if (mode() === 'grid') {
      <div class="grid xl:grid-cols-2 gap-2">
        <!-- Technical Specifications Card -->
        <div class="card">
          <div class="card-header">
            <h4 class="heading-card flex items-center gap-2">
              <svg
                class="w-5 h-5 text-primary-600 dark:text-primary-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
                ></path>
              </svg>
              Technical Specifications
            </h4>
          </div>
          <div class="card-body">
            <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
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
          </div>
        </div>

        <!-- Links & Resources Card -->
        @if (linkFieldsWithValues().length > 0 || arrayFieldsWithValues().length > 0) {
          <div class="card" [class.xl:col-span-2]="!showRequirements()">
            <div class="card-header">
              <h4 class="heading-card flex items-center gap-2">
                <svg
                  class="w-5 h-5 text-success-600 dark:text-success-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                  ></path>
                </svg>
                Links & Resources
              </h4>
            </div>
            <div class="card-body space-y-4">
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
                        class="w-4 h-4 flex-shrink-0"
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
          </div>
        }

        <!-- Requirements Card -->
        @if (showRequirements()) {
          <div class="card xl:col-span-2">
            <div class="card-header">
              <h4 class="heading-card flex items-center gap-2">
                <svg
                  class="w-5 h-5 text-warning-600 dark:text-warning-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  ></path>
                </svg>
                Model Parameter Requirements
              </h4>
            </div>
            <div class="card-body">
              <div class="code-block">
                <pre>{{ getRequirementsText() }}</pre>
              </div>
            </div>
          </div>
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
  readonly model = input.required<LegacyRecordUnion>();
  readonly mode = input<'grid' | 'card'>('grid');

  readonly fields = computed(() => getFieldsForModel(this.model()));

  readonly showRequirements = computed(() => hasRequirements(this.model()));

  readonly optimization = computed(() => {
    const model = this.model();
    if (isLegacyStableDiffusionRecord(model) && model.optimization) {
      const opt = model.optimization.trim();
      return opt !== '' ? opt : null;
    }
    return null;
  });

  readonly badges = computed(() => {
    const model = this.model();
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
    return this.arrayFields().filter((field) => {
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
    const value = field.getValue(this.model());
    if (value == null) return '';
    return String(value);
  }

  getArrayValue(field: ModelFieldConfig): string[] | null {
    const value = field.getValue(this.model());
    if (Array.isArray(value)) {
      return value;
    }
    return null;
  }

  getDisplayValue(field: ModelFieldConfig): string {
    const rawValue = field.getValue(this.model());
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
    const model = this.model();
    if (isLegacyStableDiffusionRecord(model) && model.requirements) {
      return formatRequirements(model.requirements);
    }
    return '';
  }
}
