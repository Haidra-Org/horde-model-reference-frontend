import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import { LegacyRecordUnion } from '../../models';

@Component({
  selector: 'app-model-row-actions',
  template: `
    <div [class]="containerClass()">
      <button class="btn btn-sm btn-secondary" (click)="onShowJson()">Json</button>
      <button class="btn btn-sm btn-primary" (click)="onEdit()">Edit</button>
      <button class="btn btn-sm btn-danger" (click)="onDelete()">Delete</button>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModelRowActionsComponent {
  readonly model = input.required<LegacyRecordUnion>();
  readonly layout = input<'horizontal' | 'vertical'>('horizontal');

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
