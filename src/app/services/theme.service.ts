import { Injectable, signal, effect, PLATFORM_ID, inject, computed } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ThemeDefinition, ThemeId } from '../models/theme.model';
import { THEME_DEFINITIONS } from '../models/theme-presets';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly THEME_STORAGE_KEY = 'selectedTheme';
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  // Signal for the current theme
  readonly currentTheme = signal<ThemeDefinition>(this.getInitialTheme());
  readonly availableThemes = computed(() => THEME_DEFINITIONS);

  // Computed signals for easy access
  readonly themeId = computed(() => this.currentTheme().id);
  readonly themeName = computed(() => this.currentTheme().name);
  readonly isDark = computed(() => this.currentTheme().colorMode === 'dark');

  constructor() {
    // Effect to apply theme when it changes
    effect(() => {
      if (!this.isBrowser) {
        return;
      }

      const theme = this.currentTheme();
      this.applyTheme(theme);

      // Persist to localStorage
      localStorage.setItem(this.THEME_STORAGE_KEY, theme.id);
    });
  }

  /**
   * Set the current theme by ID
   */
  setTheme(themeId: ThemeId | string): void {
    const theme = this.availableThemes().find((t) => t.id === themeId);
    if (theme) {
      this.currentTheme.set(theme);
    }
  }

  /**
   * Toggle between light and dark mode within the same theme family
   */
  toggleDarkMode(): void {
    const current = this.currentTheme();
    const targetMode = current.colorMode === 'light' ? 'dark' : 'light';

    // Find theme in the same family with the opposite mode
    const newTheme = this.availableThemes().find(
      (t) => t.family === current.family && t.colorMode === targetMode,
    );

    if (newTheme) {
      this.currentTheme.set(newTheme);
    }
  }

  /**
   * Set dark mode explicitly
   */
  setDarkMode(dark: boolean): void {
    const current = this.currentTheme();
    const targetMode = dark ? 'dark' : 'light';

    if (current.colorMode === targetMode) {
      return; // Already in the correct mode
    }

    // Find theme in the same family with the target mode
    const newTheme = this.availableThemes().find(
      (t) => t.family === current.family && t.colorMode === targetMode,
    );

    if (newTheme) {
      this.currentTheme.set(newTheme);
    }
  }

  /**
   * Get theme by ID
   */
  getTheme(themeId: ThemeId | string): ThemeDefinition | undefined {
    return this.availableThemes().find((t) => t.id === themeId);
  }

  /**
   * Apply theme to the DOM
   */
  private applyTheme(theme: ThemeDefinition): void {
    if (!this.isBrowser) {
      return;
    }

    const root = document.documentElement;

    // Apply dark mode class for Tailwind's `dark:` variants
    root.classList.toggle('dark', theme.colorMode === 'dark');

    // Remove legacy dataset flags written by the old theming system
    const legacyDataKeys = [
      'themeBorderRadius',
      'themeShadows',
      'themeGradients',
      'themeAnimations',
      'themeSpacing',
      'themeDensity',
      'themeBorderStyle',
    ] as const;
    legacyDataKeys.forEach((key) => {
      if (key in root.dataset) {
        delete root.dataset[key];
      }
    });

    // Remove any previously applied theme classes before adding the new one
    Array.from(root.classList)
      .filter((className) => className.startsWith('theme-'))
      .forEach((className) => root.classList.remove(className));

    root.classList.add(`theme-${theme.id}`);
  }

  /**
   * Get the initial theme based on stored preference
   */
  private getInitialTheme(): ThemeDefinition {
    if (this.isBrowser) {
      const stored = localStorage.getItem(this.THEME_STORAGE_KEY);
      if (stored) {
        const theme = THEME_DEFINITIONS.find((t) => t.id === stored);
        if (theme) {
          return theme;
        }
      }

      // Check system preference for dark mode and use default theme accordingly
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const defaultTheme = THEME_DEFINITIONS.find(
        (t) => t.family === 'default' && t.colorMode === (prefersDark ? 'dark' : 'light'),
      );

      if (defaultTheme) {
        return defaultTheme;
      }
    }

    // Fallback to first theme in presets
    return THEME_DEFINITIONS[0];
  }
}
