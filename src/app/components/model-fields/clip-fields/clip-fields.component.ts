import { Component, input, output, computed, ChangeDetectionStrategy } from '@angular/core';
import { FieldGroupComponent } from '../../form-fields/field-group/field-group.component';
import { FormFieldConfig } from '../../../models/form-field-config';
import { FormFieldBuilder } from '../../../utils/form-field-builder';

export interface ClipFieldsData {
  pretrained_name?: string | null;
}

@Component({
  selector: 'app-clip-fields',
  imports: [FieldGroupComponent],
  template: `
    <div class="card">
      <div class="card-header">
        <h3 class="heading-card">CLIP Fields</h3>
      </div>

      <div class="card-body">
        @for (item of fieldGroups(); track $index) {
          <app-field-group [item]="item" />
        }
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClipFieldsComponent {
  readonly data = input.required<ClipFieldsData>();
  readonly dataChange = output<ClipFieldsData>();

  /**
   * Computed signal that generates field configurations for CLIP model fields.
   */
  readonly fieldGroups = computed<FormFieldConfig[]>(() => {
    const currentData = this.data();

    return [
      FormFieldBuilder.text(
        'pretrained_name',
        'Pretrained Name',
        currentData.pretrained_name || null,
        (value) => {
          this.dataChange.emit({
            ...this.data(),
            pretrained_name: value,
          });
        },
      )
        .placeholder('e.g., ViT-L/14, ViT-B/32')
        .helpText('The pretrained CLIP model identifier from OpenAI or HuggingFace')
        .build(),
    ];
  });
}
