import {
  Component,
  input,
  output,
  signal,
  computed,
  ChangeDetectionStrategy,
  effect,
  ElementRef,
  viewChild,
} from '@angular/core';
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
  readonly suggestions = input<readonly string[]>([]);
  readonly valuesChange = output<string[]>();

  readonly newValue = signal('');
  readonly showSuggestions = signal(false);
  readonly selectedSuggestionIndex = signal(-1);
  readonly inputElement = viewChild<ElementRef<HTMLInputElement>>('inputElement');

  // unique id used to associate the label with the input for accessibility
  readonly inputId = `tag-input-${Math.random().toString(36).slice(2, 9)}`;
  readonly suggestionsId = `${this.inputId}-suggestions`;

  /**
   * Filtered suggestions based on current input and excluding already added values.
   */
  readonly filteredSuggestions = computed(() => {
    const input = this.newValue().toLowerCase().trim();
    const currentValues = this.values().map((v) => v.toLowerCase());
    const allSuggestions = this.suggestions();

    if (!input || allSuggestions.length === 0) {
      return [];
    }

    return allSuggestions
      .filter((s) => {
        const lower = s.toLowerCase();
        return lower.includes(input) && !currentValues.includes(lower);
      })
      .slice(0, 10);
  });

  constructor() {
    // Close suggestions when filtered list becomes empty
    effect(() => {
      if (this.filteredSuggestions().length === 0 && this.showSuggestions()) {
        this.showSuggestions.set(false);
      }
    });
  }

  addValue(valueToAdd?: string): void {
    const value = (valueToAdd ?? this.newValue()).trim();
    if (value && !this.values().includes(value)) {
      this.valuesChange.emit([...this.values(), value]);
      this.newValue.set('');
      this.showSuggestions.set(false);
      this.selectedSuggestionIndex.set(-1);
    }
  }

  removeValue(index: number): void {
    const updated = this.values().filter((_, i) => i !== index);
    this.valuesChange.emit(updated);
  }

  handleKeyDown(event: KeyboardEvent): void {
    const filtered = this.filteredSuggestions();
    const selectedIndex = this.selectedSuggestionIndex();

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (filtered.length > 0) {
        this.showSuggestions.set(true);
        this.selectedSuggestionIndex.set(
          selectedIndex < filtered.length - 1 ? selectedIndex + 1 : 0,
        );
      }
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (filtered.length > 0) {
        this.selectedSuggestionIndex.set(
          selectedIndex > 0 ? selectedIndex - 1 : filtered.length - 1,
        );
      }
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (this.showSuggestions() && selectedIndex >= 0 && filtered[selectedIndex]) {
        this.addValue(filtered[selectedIndex]);
      } else {
        this.addValue();
      }
    } else if (event.key === 'Escape') {
      this.showSuggestions.set(false);
      this.selectedSuggestionIndex.set(-1);
    }
  }

  handleInput(): void {
    const filtered = this.filteredSuggestions();
    this.showSuggestions.set(filtered.length > 0);
    this.selectedSuggestionIndex.set(-1);
  }

  selectSuggestion(suggestion: string): void {
    this.addValue(suggestion);
    this.inputElement()?.nativeElement.focus();
  }

  handleBlur(): void {
    // Delay to allow click on suggestion to register
    setTimeout(() => {
      this.showSuggestions.set(false);
      this.selectedSuggestionIndex.set(-1);
    }, 200);
  }
}
