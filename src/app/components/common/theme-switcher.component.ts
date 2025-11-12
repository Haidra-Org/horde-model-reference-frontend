import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { ThemeService } from '../../services/theme.service';
import { ThemeCategoryId } from '../../models/theme.model';

@Component({
  selector: 'app-theme-switcher',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="theme-switcher" [class.theme-switcher-compact]="compact()">
      @if (!compact()) {
        <label [attr.for]="selectId" class="form-label-sm theme-switcher-label"> Theme </label>
      }
      <div class="theme-switcher-controls" [class.theme-switcher-controls-compact]="compact()">
        <select
          [id]="selectId"
          class="form-select form-input-sm theme-switcher-select"
          [value]="selectedCategoryId()"
          (change)="onCategoryChange($event)"
          [class.theme-switcher-select-compact]="compact()"
          [attr.aria-label]="compact() ? 'Select theme category' : null"
        >
          @for (category of themeService.availableCategories(); track category.id) {
            <option [value]="category.id" [selected]="category.id === selectedCategoryId()">
              {{ category.name }}
            </option>
          }
        </select>
        <button
          type="button"
          class="theme-mode-toggle"
          [class.nav-icon-button]="compact()"
          (click)="toggleMode()"
          [attr.aria-label]="isDarkMode() ? 'Switch to light mode' : 'Switch to dark mode'"
          [attr.title]="isDarkMode() ? 'Switch to light mode' : 'Switch to dark mode'"
        >
          @if (isDarkMode()) {
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
              />
            </svg>
          } @else {
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
          }
        </button>
      </div>
    </div>
  `,
  styles: `
    .theme-switcher {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      min-width: 220px;
    }

    .theme-switcher.theme-switcher-compact {
      flex-direction: row;
      align-items: center;
      gap: 0.5rem;
      min-width: unset;
    }

    .theme-switcher-controls {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .theme-switcher-controls.theme-switcher-controls-compact {
      gap: 0.25rem;
    }

    .theme-switcher-select-compact {
      min-width: 160px;
    }

    .theme-mode-toggle {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: none;
      background: transparent;
      color: inherit;
      padding: 0.4rem;
      border-radius: 0.5rem;
      transition:
        background-color 0.2s ease,
        color 0.2s ease;
      cursor: pointer;
    }

    .theme-mode-toggle:hover {
      background-color: rgba(107, 114, 128, 0.15);
    }
  `,
})
export class ThemeSwitcherComponent {
  private static nextId = 0;

  readonly themeService = inject(ThemeService);
  readonly compact = input(false);
  readonly selectId = `theme-select-${ThemeSwitcherComponent.nextId++}`;
  readonly selectedCategoryId = signal<ThemeCategoryId>(this.themeService.currentCategoryId());
  readonly isDarkMode = signal(this.themeService.isDark());

  constructor() {
    effect(() => {
      this.selectedCategoryId.set(this.themeService.currentCategoryId());
      this.isDarkMode.set(this.themeService.isDark());
    });
  }

  onCategoryChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.themeService.setThemeFamily(select.value);
  }

  toggleMode(): void {
    this.themeService.toggleDarkMode();
  }
}
