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
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HordeBadgeComponent } from '@haidra/design-system/badge';
import { HordeButtonComponent } from '@haidra/design-system/button';
import { CdkOverlayOrigin, CdkConnectedOverlay, ConnectedPosition } from '@angular/cdk/overlay';

@Component({
  selector: 'app-tag-input',
  imports: [FormsModule, HordeBadgeComponent, HordeButtonComponent, CdkOverlayOrigin, CdkConnectedOverlay],
  templateUrl: './tag-input.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TagInputComponent {
  private readonly platformId = inject(PLATFORM_ID);
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

  // Width of the trigger element for the overlay to match
  readonly triggerWidth = signal<number>(0);

  // CDK Overlay positions: prefer below, fall back to above
  readonly overlayPositions: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -4 },
  ];

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
    // Update trigger width when suggestions are shown so CDK overlay matches input width
    effect(() => {
      if (this.showSuggestions() && this.isBrowser) {
        this.updateTriggerWidth();
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
      this.updateTriggerWidth();
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
   * Updates the trigger width so the CDK overlay panel matches the input width.
   */
  private updateTriggerWidth(): void {
    if (!this.isBrowser) return;

    const inputEl = this.inputElement()?.nativeElement;
    if (!inputEl) return;

    this.triggerWidth.set(inputEl.getBoundingClientRect().width);
  }
}
