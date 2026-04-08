import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import { HordeButtonComponent } from '@haidra/design-system/button';
import { LegacyRecordUnion } from '../../models';

@Component({
  selector: 'app-model-row-actions',
  imports: [HordeButtonComponent],
  template: `
    <div [class]="containerClass()">
      <horde-button variant="secondary" size="sm" (click)="onShowJson()">Json</horde-button>
      @if (writable()) {
        <horde-button variant="primary" size="sm" (click)="onEdit()">Edit</horde-button>
        <horde-button variant="danger" size="sm" (click)="onDelete()">Delete</horde-button>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModelRowActionsComponent {
  readonly model = input.required<LegacyRecordUnion>();
  readonly layout = input<'horizontal' | 'vertical'>('horizontal');
  readonly writable = input<boolean>(false);

  readonly showJson = output<LegacyRecordUnion>();
  readonly edit = output<string>();
  readonly delete = output<string>();

  readonly containerClass = () =>
    this.layout() === 'vertical'
      ? 'flex flex-col gap-2 whitespace-nowrap'
      : 'flex gap-2 whitespace-nowrap';

  onShowJson(): void {
    this.showJson.emit(this.model());
  }

  onEdit(): void {
    this.edit.emit(this.model().name);
  }

  onDelete(): void {
    this.delete.emit(this.model().name);
  }
}
