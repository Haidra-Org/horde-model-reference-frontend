import { Component, input, output, computed, ChangeDetectionStrategy } from '@angular/core';
import { HordeButtonComponent } from '@haidra/design-system/button';
import { LegacyRecordUnion } from '../../models';

@Component({
  selector: 'app-model-row-actions',
  imports: [HordeButtonComponent],
  template: `
    <div [class]="containerClass()">
      <horde-button variant="secondary" [size]="buttonSize()" (click)="onShowJson()">JSON</horde-button>
      @if (writable()) {
        <horde-button variant="primary" [size]="buttonSize()" (click)="onEdit()">Edit</horde-button>
        <horde-button variant="danger" [size]="buttonSize()" (click)="onDelete()">
          {{ deleteLabel() }}
        </horde-button>
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

  readonly buttonSize = computed(() => (this.layout() === 'vertical' ? 'sm' : 'xs'));
  readonly deleteLabel = computed(() => (this.layout() === 'vertical' ? 'Delete' : 'Del'));

  readonly containerClass = () =>
    this.layout() === 'vertical'
      ? 'flex flex-col gap-2 whitespace-nowrap'
      : 'flex items-center justify-end gap-1.5 whitespace-nowrap';

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
