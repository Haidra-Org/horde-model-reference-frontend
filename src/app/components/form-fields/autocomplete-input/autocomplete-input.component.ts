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

/**
 * Autocomplete input component that allows arbitrary text values with suggestions.
 * Supports keyboard navigation and filtering of suggestions.
 * Unlike tag-input, this is a single-value field that allows free text entry.
 */
@Component({
  selector: 'app-autocomplete-input',
  imports: [FormsModule],
  templateUrl: './autocomplete-input.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AutocompleteInputComponent {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  readonly label = input<string>('');
  readonly placeholder = input<string>('Type or select...');
  readonly value = input<string | null>(null);
  readonly suggestions = input<readonly string[]>([]);
  readonly valueChange = output<string | null>();

  readonly inputValue = signal('');
  readonly showSuggestions = signal(false);
  readonly selectedSuggestionIndex = signal(-1);
  readonly inputElement = viewChild<ElementRef<HTMLInputElement>>('inputElement');

  // Position signals for fixed positioning
  readonly dropdownTop = signal<number>(0);
  readonly dropdownLeft = signal<number>(0);
  readonly dropdownWidth = signal<number>(0);

  // Unique id used to associate the label with the input for accessibility
  readonly inputId = `autocomplete-input-${Math.random().toString(36).slice(2, 9)}`;
  readonly suggestionsId = `${this.inputId}-suggestions`;

  /**
   * Filtered and sorted suggestions based on current input.
   * When input is empty or matches a suggestion exactly, shows all suggestions.
   * When input has text, shows matching items first, then non-matching items.
   */
  readonly filteredSuggestions = computed(() => {
    const input = this.inputValue().toLowerCase().trim();
    const allSuggestions = this.suggestions();

    // If no input or input exactly matches a suggestion (case-insensitive),
    // return all available suggestions
    if (!input || allSuggestions.some((s) => s.toLowerCase() === input)) {
      return allSuggestions;
    }

    // Split into matching and non-matching
    const matching: string[] = [];
    const nonMatching: string[] = [];

    allSuggestions.forEach((s) => {
      if (s.toLowerCase().includes(input)) {
        matching.push(s);
      } else {
        nonMatching.push(s);
      }
    });

    // Return matching items first, then non-matching (limit total to 10)
    return [...matching, ...nonMatching].slice(0, 10);
  });

  constructor() {
    // Sync input value with external value signal
    effect(() => {
      const externalValue = this.value();
      const currentInputValue = this.inputValue();
      // Only update if different to avoid infinite loops
      if (externalValue !== currentInputValue) {
        this.inputValue.set(externalValue || '');
      }
    });

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
        this.selectSuggestion(filtered[selectedIndex]);
      } else {
        // Accept current input value
        this.emitValue();
        this.showSuggestions.set(false);
      }
    } else if (event.key === 'Escape') {
      this.showSuggestions.set(false);
      this.selectedSuggestionIndex.set(-1);
    } else if (event.key === 'Tab') {
      // Accept current value on tab
      this.emitValue();
      this.showSuggestions.set(false);
    }
  }

  handleInput(): void {
    const filtered = this.filteredSuggestions();
    // Always show suggestions if there are any available
    this.showSuggestions.set(this.suggestions().length > 0 && filtered.length > 0);
    this.selectedSuggestionIndex.set(-1);
    // Emit the value on input change
    this.emitValue();
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
    this.inputValue.set(suggestion);
    this.valueChange.emit(suggestion || null);
    this.showSuggestions.set(false);
    this.selectedSuggestionIndex.set(-1);
    this.inputElement()?.nativeElement.focus();
  }

  handleBlur(): void {
    // Delay to allow click on suggestion to register
    setTimeout(() => {
      this.showSuggestions.set(false);
      this.selectedSuggestionIndex.set(-1);
      // Emit final value on blur
      this.emitValue();
    }, 200);
  }

  private emitValue(): void {
    const trimmedValue = this.inputValue().trim();
    this.valueChange.emit(trimmedValue || null);
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
   */
  private updateDropdownPosition(): void {
    if (!this.isBrowser) return;

    const inputEl = this.inputElement()?.nativeElement;
    if (!inputEl) return;

    const rect = inputEl.getBoundingClientRect();

    // Position dropdown below input, matching the input's width
    this.dropdownTop.set(rect.bottom + 4); // 4px gap
    this.dropdownLeft.set(rect.left);
    this.dropdownWidth.set(rect.width);
  }
}
