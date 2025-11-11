import { Component, inject, input } from '@angular/core';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-theme-switcher',
  standalone: true,
  template: `
    <div class="theme-switcher" [class.theme-switcher-compact]="compact()">
      <label
        for="theme-select"
        class="form-label-sm theme-switcher-label"
        [class.theme-switcher-label-compact]="compact()"
      >
        Theme
      </label>
      <select
        id="theme-select"
        class="form-select form-input-sm"
        [value]="themeService.themeId()"
        (change)="onThemeChange($event)"
        [class.theme-switcher-select-compact]="compact()"
      >
        @for (theme of themeService.availableThemes(); track theme.id) {
          <option [value]="theme.id">
            {{ theme.name }}
          </option>
        }
      </select>
    </div>
  `,
  styles: `
    .theme-switcher {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      min-width: 200px;
    }

    .theme-switcher.theme-switcher-compact {
      flex-direction: row;
      align-items: center;
      gap: 0.5rem;
      min-width: unset;
    }

    .theme-switcher-label-compact {
      margin-bottom: 0;
      font-size: 0.75rem;
      white-space: nowrap;
    }

    .theme-switcher-select-compact {
      min-width: 160px;
    }
  `,
})
export class ThemeSwitcherComponent {
  readonly themeService = inject(ThemeService);
  readonly compact = input(false);

  onThemeChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.themeService.setTheme(select.value);
  }
}
