import { Component, input, output, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-tag-input',
  imports: [FormsModule],
  templateUrl: './tag-input.component.html',
  styleUrl: './tag-input.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TagInputComponent {
  readonly label = input<string>('');
  readonly placeholder = input<string>('Add item...');
  readonly values = input<string[]>([]);
  readonly valuesChange = output<string[]>();

  readonly newValue = signal('');

  addValue(): void {
    const value = this.newValue().trim();
    if (value && !this.values().includes(value)) {
      this.valuesChange.emit([...this.values(), value]);
      this.newValue.set('');
    }
  }

  removeValue(index: number): void {
    const updated = this.values().filter((_, i) => i !== index);
    this.valuesChange.emit(updated);
  }

  handleKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.addValue();
    }
  }
}
