import { Component, input, output, computed, ChangeDetectionStrategy } from '@angular/core';
import { FieldGroupComponent } from '../../form-fields/field-group/field-group.component';
import { ModelReferenceCategory } from '../../../models/api.models';
import { FormFieldConfig, FormFieldGroup } from '../../../models/form-field-config';
import { FormFieldBuilder } from '../../../utils/form-field-builder';

export interface CommonFieldsData {
  description?: string | null;
  type?: string | null;
  version?: string | null;
  style?: string | null;
  nsfw?: boolean | null;
  download_all?: boolean | null;
  available?: boolean | null;
  features_not_supported?: string[] | null;
}

@Component({
  selector: 'app-common-fields',
  imports: [FieldGroupComponent],
  template: `
    <div class="card">
      <div class="card-header">
        <h3 class="heading-card">Common Fields</h3>
      </div>

      <div class="card-body card-section">
        @for (item of fieldGroups(); track $index) {
          <app-field-group [item]="item" />
        }
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommonFieldsComponent {
  readonly data = input.required<CommonFieldsData>();
  readonly category = input.required<ModelReferenceCategory>();
  readonly dataChange = output<CommonFieldsData>();

  /**
   * Computed signal that generates all field configurations for the common fields form.
   * This declaratively defines all fields using the builder pattern.
   */
  readonly fieldGroups = computed<(FormFieldConfig | FormFieldGroup)[]>(() => {
    const category = this.category();
    const currentData = this.data();

    return [
      // Description (full width)
      FormFieldBuilder.textarea('description', 'Description', currentData.description || null, (value) =>
        this.updateField('description', value),
      )
        .rows(3)
        .placeholder('Brief description of the model')
        .build(),

      // Type, Version, Style (3-column grid)
      FormFieldBuilder.group(
        [
          FormFieldBuilder.text('type', 'Type', currentData.type || null, (value) =>
            this.updateField('type', value),
          )
            .placeholder('e.g., ckpt')
            .hideForCategory(category)
            .build(),

          FormFieldBuilder.text('version', 'Version', currentData.version || null, (value) =>
            this.updateField('version', value),
          )
            .placeholder('e.g., 1.0')
            .build(),

          FormFieldBuilder.text('style', 'Style', currentData.style || null, (value) =>
            this.updateField('style', value),
          )
            .placeholder('e.g., realistic, anime')
            .build(),
        ],
        'form-grid-3',
      ),

      // NSFW, Download All, Available (3-column grid)
      FormFieldBuilder.group(
        [
          FormFieldBuilder.triStateBoolean('nsfw', 'NSFW', currentData.nsfw ?? null, (value) =>
            this.updateField('nsfw', value),
          )
            .build(),

          FormFieldBuilder.triStateBoolean(
            'download_all',
            'Download All',
            currentData.download_all ?? null,
            (value) => this.updateField('download_all', value),
          )
            .hideForCategory(category)
            .build(),

          FormFieldBuilder.triStateBoolean(
            'available',
            'Available',
            currentData.available ?? null,
            (value) => this.updateField('available', value),
          )
            .labelSuffix(' (usually should be unset)')
            .hideForCategory(category)
            .build(),
        ],
        'form-grid-3',
      ),

      // Features Not Supported (tag input)
      FormFieldBuilder.tagInput(
        'features_not_supported',
        'Features Not Supported',
        currentData.features_not_supported || [],
        (value) => this.updateField('features_not_supported', value.length > 0 ? value : null),
      )
        .placeholder('Add unsupported feature...')
        .build(),
    ];
  });

  updateField<K extends keyof CommonFieldsData>(field: K, value: CommonFieldsData[K]): void {
    this.dataChange.emit({
      ...this.data(),
      [field]: value,
    });
  }
}
