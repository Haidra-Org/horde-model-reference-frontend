import { Component, input, output, computed, ChangeDetectionStrategy } from '@angular/core';
import { FieldGroupComponent } from '../../form-fields/field-group/field-group.component';
import { FormFieldConfig } from '../../../models/form-field-config';
import { FormFieldBuilder } from '../../../utils/form-field-builder';

export interface ControlNetFieldsData {
  controlnet_style: string;
}

@Component({
  selector: 'app-controlnet-fields',
  imports: [FieldGroupComponent],
  template: `
    <div class="space-y-4">
      @for (item of fieldGroups(); track $index) {
        <app-field-group [item]="item" />
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ControlNetFieldsComponent {
  readonly data = input.required<ControlNetFieldsData>();
  readonly canonicalFormat = input<string>('legacy');
  readonly dataChange = output<ControlNetFieldsData>();

  readonly fieldGroups = computed<FormFieldConfig[]>(() => {
    const currentData = this.data();

    return [
      FormFieldBuilder.text(
        'controlnet_style',
        'ControlNet Style',
        currentData.controlnet_style,
        (value) => {
          this.dataChange.emit({
            ...this.data(),
            controlnet_style: value ?? '',
          });
        },
      )
        .required()
        .placeholder('e.g., canny, depth, openpose')
        .helpText('The style/type of ControlNet preprocessing')
        .build(),
    ];
  });
}
