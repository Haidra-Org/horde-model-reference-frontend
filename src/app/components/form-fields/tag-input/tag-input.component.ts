import {
  Component,
  input,
  output,
  signal,
  computed,
  ChangeDetectionStrategy,
  ElementRef,
  viewChild,
  effect,
  inject,
  PLATFORM_ID,
  DestroyRef,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-tag-input',
  imports: [FormsModule],
  templateUrl: './tag-input.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TagInputComponent {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  readonly label = input<string>('');
  readonly placeholder = input<string>('Add item...');
  readonly values = input<string[]>([]);
  readonly suggestions = input<readonly string[]>([]);
  readonly valuesChange = output<string[]>();

  readonly newValue = signal('');
  readonly showSuggestions = signal(false);
  readonly selectedSuggestionIndex = signal(-1);
  readonly inputElement = viewChild<ElementRef<HTMLInputElement>>('inputElement');

  // Position signals for fixed positioning
  readonly dropdownTop = signal<number>(0);
  readonly dropdownLeft = signal<number>(0);
  readonly dropdownWidth = signal<number>(0);

  // unique id used to associate the label with the input for accessibility
  readonly inputId = `tag-input-${Math.random().toString(36).slice(2, 9)}`;
  readonly suggestionsId = `${this.inputId}-suggestions`;

  /**
   * Filtered and sorted suggestions based on current input.
   * Always shows up to 6 suggestions, with matching items at the top.
   * When input is empty, shows all available suggestions (excluding already added).
   * When input has text, shows matching items first, then non-matching items.
   */
  readonly filteredSuggestions = computed(() => {
    const input = this.newValue().toLowerCase().trim();
    const currentValues = this.values().map((v) => v.toLowerCase());
    const allSuggestions = this.suggestions();

    // Filter out already added values
    const availableSuggestions = allSuggestions.filter((s) => {
      const lower = s.toLowerCase();
      return !currentValues.includes(lower);
    });

    // If no input, return all available suggestions
    if (!input) {
      return availableSuggestions;
    }

    // Split into matching and non-matching
    const matching: string[] = [];
    const nonMatching: string[] = [];

    availableSuggestions.forEach((s) => {
      if (s.toLowerCase().includes(input)) {
        matching.push(s);
      } else {
        nonMatching.push(s);
      }
    });

    // Return matching items first, then non-matching
    return [...matching, ...nonMatching];
  });

  constructor() {
    // Update dropdown position when it becomes visible
    effect(() => {
      if (this.showSuggestions() && this.isBrowser) {
        this.updateDropdownPosition();
      }
    });

    // Setup scroll and resize listeners with proper cleanup
    if (this.isBrowser) {
      const scrollListener = () => this.updateDropdownPosition();
      const resizeListener = () => this.updateDropdownPosition();

      window.addEventListener('scroll', scrollListener, true);
      window.addEventListener('resize', resizeListener);

      // Cleanup listeners on component destroy
      this.destroyRef.onDestroy(() => {
        window.removeEventListener('scroll', scrollListener, true);
        window.removeEventListener('resize', resizeListener);
      });
    }
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
        // Scroll selected item into view
        this.scrollSelectedIntoView();
      }
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (filtered.length > 0) {
        this.showSuggestions.set(true);
        this.selectedSuggestionIndex.set(
          selectedIndex > 0 ? selectedIndex - 1 : filtered.length - 1,
        );
        // Scroll selected item into view
        this.scrollSelectedIntoView();
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
    // Always show suggestions if there are any available (even if no match)
    this.showSuggestions.set(this.suggestions().length > 0 && filtered.length > 0);
    this.selectedSuggestionIndex.set(-1);
  }

  handleFocus(): void {
    const filtered = this.filteredSuggestions();
    // Show suggestions on focus if there are any available
    if (this.suggestions().length > 0 && filtered.length > 0) {
      this.updateDropdownPosition();
      this.showSuggestions.set(true);
      this.selectedSuggestionIndex.set(-1);
    }
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

  /**
   * Scrolls the currently selected suggestion item into view within the dropdown.
   * Uses smooth scrolling for better UX.
   */
  private scrollSelectedIntoView(): void {
    // Use setTimeout to ensure DOM has updated
    setTimeout(() => {
      const dropdown = document.getElementById(this.suggestionsId);
      const selected = dropdown?.querySelector('.autocomplete-item-selected');
      if (selected && dropdown) {
        const dropdownRect = dropdown.getBoundingClientRect();
        const selectedRect = selected.getBoundingClientRect();

        // Check if item is out of view
        if (selectedRect.bottom > dropdownRect.bottom) {
          // Item is below visible area
          selected.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        } else if (selectedRect.top < dropdownRect.top) {
          // Item is above visible area
          selected.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      }
    }, 0);
  }

  /**
   * Updates the dropdown position based on the input element's viewport coordinates.
   * Uses fixed positioning to avoid container clipping.
   * The dropdown width matches the input field width (excluding the Add button).
   */
  private updateDropdownPosition(): void {
    if (!this.isBrowser) return;

    const inputEl = this.inputElement()?.nativeElement;
    if (!inputEl) return;

    const rect = inputEl.getBoundingClientRect();

    // Position dropdown below input, matching the input's exact width
    this.dropdownTop.set(rect.bottom + 4); // 4px gap (mt-1)
    this.dropdownLeft.set(rect.left);
    this.dropdownWidth.set(rect.width);
  }
}
