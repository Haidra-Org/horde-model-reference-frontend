import { Injectable, signal, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root',
})
export class SidebarService {
  private readonly platformId = inject(PLATFORM_ID);
  readonly isCollapsed = signal(false);
  readonly isMobile = signal(false);

  constructor() {
    // Initialize drawer state from viewport size.
    if (isPlatformBrowser(this.platformId)) {
      const mobile = window.innerWidth < 1024;
      this.isMobile.set(mobile);
      this.isCollapsed.set(mobile);
    }
  }

  toggle(): void {
    this.isCollapsed.update((collapsed) => !collapsed);
  }

  close(): void {
    this.isCollapsed.set(true);
  }

  open(): void {
    this.isCollapsed.set(false);
  }
}
