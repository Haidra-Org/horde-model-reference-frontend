import { Injectable, OnDestroy, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

const MOBILE_MEDIA_QUERY = '(max-width: 1023px)';
const COLLAPSED_STORAGE_KEY = 'horde-model-reference.sidebar.collapsed';
const GROUPS_STORAGE_KEY = 'horde-model-reference.sidebar.groups';

type SidebarGroupState = Record<string, boolean>;

@Injectable({
  providedIn: 'root',
})
export class SidebarService implements OnDestroy {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private mediaQueryList: MediaQueryList | null = null;
  private mediaQueryListener: ((event: MediaQueryListEvent) => void) | null = null;

  readonly isCollapsed = signal(false);
  readonly isMobile = signal(false);
  readonly groupOpenState = signal<SidebarGroupState>({});

  constructor() {
    if (!this.isBrowser) {
      return;
    }

    this.groupOpenState.set(this.readStoredGroupState());

    this.mediaQueryList = window.matchMedia(MOBILE_MEDIA_QUERY);
    this.mediaQueryListener = (event: MediaQueryListEvent) => {
      this.syncViewportState(event.matches);
    };

    this.syncViewportState(this.mediaQueryList.matches);
    this.mediaQueryList.addEventListener('change', this.mediaQueryListener);
  }

  ngOnDestroy(): void {
    if (this.mediaQueryList && this.mediaQueryListener) {
      this.mediaQueryList.removeEventListener('change', this.mediaQueryListener);
    }
  }

  toggle(): void {
    this.setCollapsedState(!this.isCollapsed());
  }

  close(): void {
    this.setCollapsedState(true);
  }

  open(): void {
    this.setCollapsedState(false);
  }

  isGroupOpen(groupId: string): boolean {
    return this.groupOpenState()[groupId] ?? true;
  }

  setGroupStateDefaults(defaults: SidebarGroupState): void {
    this.groupOpenState.update((current) => {
      let hasChanges = false;
      const merged: SidebarGroupState = { ...current };

      for (const [groupId, isOpen] of Object.entries(defaults)) {
        if (!(groupId in merged)) {
          merged[groupId] = isOpen;
          hasChanges = true;
        }
      }

      if (!hasChanges) {
        return current;
      }

      this.persistGroupState(merged);
      return merged;
    });
  }

  toggleGroup(groupId: string): void {
    this.groupOpenState.update((current) => {
      const nextState = !(current[groupId] ?? true);
      const updated = { ...current, [groupId]: nextState };
      this.persistGroupState(updated);
      return updated;
    });
  }

  private setCollapsedState(collapsed: boolean): void {
    this.isCollapsed.set(collapsed);

    if (!this.isMobile()) {
      this.persistCollapsedState(collapsed);
    }
  }

  private syncViewportState(isMobile: boolean): void {
    this.isMobile.set(isMobile);

    if (isMobile) {
      this.isCollapsed.set(true);
      return;
    }

    this.isCollapsed.set(this.readStoredCollapsedState() ?? false);
  }

  private readStoredCollapsedState(): boolean | null {
    if (!this.isBrowser) {
      return null;
    }

    const stored = window.localStorage.getItem(COLLAPSED_STORAGE_KEY);
    if (stored === 'true') {
      return true;
    }

    if (stored === 'false') {
      return false;
    }

    return null;
  }

  private persistCollapsedState(collapsed: boolean): void {
    if (!this.isBrowser) {
      return;
    }

    window.localStorage.setItem(COLLAPSED_STORAGE_KEY, String(collapsed));
  }

  private readStoredGroupState(): SidebarGroupState {
    if (!this.isBrowser) {
      return {};
    }

    const rawState = window.localStorage.getItem(GROUPS_STORAGE_KEY);
    if (!rawState) {
      return {};
    }

    try {
      const parsed = JSON.parse(rawState) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return {};
      }

      const sanitizedState: SidebarGroupState = {};
      for (const [groupId, isOpen] of Object.entries(parsed)) {
        if (typeof isOpen === 'boolean') {
          sanitizedState[groupId] = isOpen;
        }
      }

      return sanitizedState;
    } catch {
      return {};
    }
  }

  private persistGroupState(groupState: SidebarGroupState): void {
    if (!this.isBrowser) {
      return;
    }

    window.localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(groupState));
  }
}
