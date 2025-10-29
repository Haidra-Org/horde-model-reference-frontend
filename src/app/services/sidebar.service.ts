import { Injectable, signal, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root',
})
export class SidebarService {
  private readonly platformId = inject(PLATFORM_ID);
  readonly isCollapsed = signal(false);

  constructor() {
    // Set initial collapsed state based on screen size
    if (isPlatformBrowser(this.platformId)) {
      const isMobile = window.innerWidth < 1024; // lg breakpoint
      this.isCollapsed.set(isMobile);
    }
  }

  toggle(): void {
    this.isCollapsed.update((collapsed) => !collapsed);
  }
}
