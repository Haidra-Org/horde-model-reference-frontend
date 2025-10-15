import { Component, input, output, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-tag-input',
  imports: [FormsModule],
  templateUrl: './tag-input.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TagInputComponent {
  readonly label = input<string>('');
  readonly placeholder = input<string>('Add item...');
  readonly values = input<string[]>([]);
  readonly valuesChange = output<string[]>();

  readonly newValue = signal('');
  // unique id used to associate the label with the input for accessibility
  readonly inputId = `tag-input-${Math.random().toString(36).slice(2, 9)}`;

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
