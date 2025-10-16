import { Component, input, computed, ChangeDetectionStrategy } from '@angular/core';
import { FormFieldConfig, FormFieldGroup } from '../../../models/form-field-config';
import { DynamicFieldComponent } from '../dynamic-field/dynamic-field.component';

/**
 * Component that renders a group of form fields, optionally with grid layout.
 * This handles both individual fields and field groups with custom layouts.
 */
@Component({
  selector: 'app-field-group',
  imports: [DynamicFieldComponent],
  template: `
    <!-- Single field -->
    @if (asField(); as field) {
      <app-dynamic-field [config]="field" />
    }

    <!-- Field group with optional grid layout -->
    @if (asGroup(); as group) {
      @if (group.label) {
        <div class="form-label">{{ group.label }}</div>
      }
      <div [class]="group.gridClass || ''">
        @for (field of group.fields; track field.id) {
          <app-dynamic-field [config]="field" />
        }
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FieldGroupComponent {
  readonly item = input.required<FormFieldConfig | FormFieldGroup>();

  /**
   * Computed signal that returns the item as a FormFieldConfig if it's a field,
   * or null if it's a group. This allows proper type narrowing in the template.
   */
  readonly asField = computed<FormFieldConfig | null>(() => {
    const item = this.item();
    return 'fields' in item ? null : item;
  });

  /**
   * Computed signal that returns the item as a FormFieldGroup if it's a group,
   * or null if it's a field. This allows proper type narrowing in the template.
   */
  readonly asGroup = computed<FormFieldGroup | null>(() => {
    const item = this.item();
    return 'fields' in item ? item : null;
  });
}
