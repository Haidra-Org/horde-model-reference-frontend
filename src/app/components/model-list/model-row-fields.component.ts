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

@Component({
  selector: 'app-model-row-fields',
  template: `
    @if (mode() === 'grid') {
      <div class="grid grid-cols-4 gap-x-6 gap-y-3 text-sm">
        <div class="col-span-4 mb-2">
          {{ model().description || 'No description' }}
    </div>
        @for (field of fields(); track field.label) {
          <div [class.col-span-4]="field.colspan === 4">
            <div class="field-label">{{ field.label }}</div>
            <div [class]="getValueClass(field)">
              @if (field.type === 'link') {
                @if (getValue(field)) {
                  <a
                    [href]="getValue(field)"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="link"
                  >
                    {{ getValue(field) }}
                  </a>
                } @else {
                  -
                }
              } @else if (field.type === 'array') {
                @if (getArrayValue(field) && getArrayValue(field)!.length > 0) {
                  {{ getArrayValue(field)!.join(', ') }}
                } @else {
                  -
                }
              } @else {
                {{ getDisplayValue(field) }}
                @if (field.label === 'Baseline' && optimization()) {
                  <span class="text-gray-500"> ({{ optimization() }})</span>
                }
              }
            </div>
          </div>
        }

        @if (showRequirements()) {
          <div class="col-span-4">
            <div class="field-label">Requirements Details</div>
            <div
              class="text-sm bg-gray-50 dark:bg-gray-900 p-3 rounded border border-gray-200 dark:border-gray-700"
            >
              <pre
                class="whitespace-pre-wrap break-words text-gray-700 dark:text-gray-300 font-mono text-xs"
                >{{ getRequirementsText() }}</pre
              >
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
        @for (field of detailFields(); track field.label) {
          <div [class.md:col-span-2]="field.colspan === 4">
            <div class="field-label">{{ field.label }}</div>
            <div [class]="getValueClass(field)">
              @if (field.type === 'link') {
                @if (getValue(field)) {
                  <a
                    [href]="getValue(field)"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="link"
                  >
                    {{ getValue(field) }}
                  </a>
                } @else {
                  -
                }
              } @else if (field.type === 'array') {
                @if (getArrayValue(field) && getArrayValue(field)!.length > 0) {
                  {{ getArrayValue(field)!.join(', ') }}
                } @else {
                  -
                }
              } @else {
                {{ getDisplayValue(field) }}
              }
            </div>
          </div>
        }

        @if (showRequirements()) {
          <div class="md:col-span-2">
            <div class="field-label">Requirements</div>
            <div
              class="text-sm bg-gray-50 dark:bg-gray-900 p-3 rounded border border-gray-200 dark:border-gray-700"
            >
              <pre
                class="whitespace-pre-wrap break-words text-gray-700 dark:text-gray-300 font-mono text-xs"
                >{{ getRequirementsText() }}</pre
              >
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
          value: model.parameters.toLocaleString(),
          class: 'badge-secondary',
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

  readonly detailFields = computed(() => {
    const allFields = this.fields();
    return allFields.filter((f) => f.type === 'link' || f.type === 'array' || f.colspan === 4);
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
