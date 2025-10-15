import { Injectable, signal, effect, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root',
})
export class DarkModeService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly STORAGE_KEY = 'darkMode';

  readonly darkMode = signal<boolean>(this.getInitialMode());

  constructor() {
    effect(() => {
      if (isPlatformBrowser(this.platformId)) {
        const isDark = this.darkMode();
        if (isDark) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(isDark));
      }
    });
  }

  toggle(): void {
    this.darkMode.set(!this.darkMode());
  }

  private getInitialMode(): boolean {
    if (isPlatformBrowser(this.platformId)) {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored !== null) {
        return JSON.parse(stored);
      }

      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  }
}
