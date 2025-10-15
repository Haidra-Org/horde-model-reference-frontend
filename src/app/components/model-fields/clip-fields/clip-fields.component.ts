import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';

export interface ClipFieldsData {
  pretrained_name?: string | null;
}

@Component({
  selector: 'app-clip-fields',
  imports: [FormsModule],
  templateUrl: './clip-fields.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClipFieldsComponent {
  readonly data = input.required<ClipFieldsData>();
  readonly dataChange = output<ClipFieldsData>();

  onPretrainedNameChange(value: string): void {
    this.dataChange.emit({
      ...this.data(),
      pretrained_name: value || null,
    });
  }
}
