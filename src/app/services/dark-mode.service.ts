import { Injectable, computed, inject } from '@angular/core';
import { ThemeService } from './theme.service';

/**
 * @deprecated Use ThemeService instead. This service is maintained for backward compatibility.
 * DarkModeService now delegates to ThemeService for theme management.
 */
@Injectable({
  providedIn: 'root',
})
export class DarkModeService {
  private readonly themeService = inject(ThemeService);
  readonly darkMode = computed(() => this.themeService.isDark());

  toggle(): void {
    this.themeService.toggleDarkMode();
  }
}
