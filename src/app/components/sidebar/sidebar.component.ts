import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { Router, NavigationEnd, RouterLink } from '@angular/router';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PendingQueueSummaryService } from '../../services/pending-queue-summary.service';
import { SidebarService } from '../../services/sidebar.service';
import { ViewerCapabilitiesService } from '../../services/viewer-capabilities.service';
import { BackendStatusChipComponent } from '../backend-status-chip/backend-status-chip.component';
import { DEFAULT_CATEGORY } from '../../shared/constants';

/**
 * Who a nav entry is offered to.
 *
 * `public` entries are always present. The others are omitted entirely rather than
 * disabled: contribution is allowlist-controlled, so for almost every visitor a
 * greyed-out entry is a door they can never open and an invitation to ask why.
 */
type NavVisibility = 'public' | 'contributor' | 'curator';

interface SidebarNavItem {
  id: string;
  label: string;
  route: string;
  /** Query params bound separately; embedding them in `route` breaks routerLink array commands. */
  queryParams?: Record<string, string>;
  icon: string;
  visibility: NavVisibility;
  badge?: 'queue';
}

const NAV_ITEMS: { group: string; items: SidebarNavItem[] }[] = [
  {
    group: 'Catalog',
    items: [
      {
        id: 'browse',
        label: 'Browse models',
        route: `/categories/${DEFAULT_CATEGORY}`,
        icon: 'layers',
        visibility: 'public',
      },
      {
        id: 'text-groups',
        label: 'Text groups',
        route: '/text-groups',
        icon: 'branch',
        visibility: 'public',
      },
      {
        id: 'text-guidance',
        label: 'Usage guidance',
        route: '/text-guidance',
        icon: 'doc',
        visibility: 'public',
      },
      {
        id: 'licensing',
        label: 'Licensing',
        route: '/licensing',
        icon: 'shield',
        visibility: 'public',
      },
      {
        id: 'analytics',
        label: 'Statistics',
        route: '/analytics',
        queryParams: { category: DEFAULT_CATEGORY, tab: 'statistics' },
        icon: 'chart',
        visibility: 'public',
      },
    ],
  },
  {
    group: 'Curation',
    items: [
      {
        id: 'propose',
        label: 'Propose a change',
        route: '/propose',
        icon: 'wand',
        visibility: 'contributor',
      },
      {
        id: 'families',
        label: 'Families & aliases',
        route: '/text-groups/families',
        icon: 'branch',
        visibility: 'contributor',
      },
      {
        id: 'queue',
        label: 'Review queue',
        route: '/pending-queue',
        icon: 'inbox',
        visibility: 'curator',
        badge: 'queue',
      },
    ],
  },
  {
    group: 'Developers',
    items: [
      { id: 'docs', label: 'API & docs', route: '/api-docs', icon: 'doc', visibility: 'public' },
      {
        id: 'deployment',
        label: 'This deployment',
        route: '/deployment',
        icon: 'server',
        visibility: 'public',
      },
    ],
  },
];

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, BackendStatusChipComponent],
  templateUrl: './sidebar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarComponent implements OnInit {
  readonly viewer = inject(ViewerCapabilitiesService);
  readonly pendingSummary = inject(PendingQueueSummaryService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly sidebarService = inject(SidebarService);

  readonly isCollapsed = this.sidebarService.isCollapsed;
  readonly isMobile = this.sidebarService.isMobile;

  readonly pendingCount = computed(() => this.pendingSummary.totalPendingCount());

  readonly currentRoute = signal<string>('');

  readonly navItems = NAV_ITEMS;

  readonly navItemStates = computed(() => {
    const current = this.currentRoute();
    const canPropose = this.viewer.canPropose();
    const canApprove = this.viewer.canApprove();

    const isVisible = (item: SidebarNavItem): boolean => {
      switch (item.visibility) {
        case 'public':
          return true;
        case 'contributor':
          return canPropose;
        case 'curator':
          return canApprove;
      }
    };

    return NAV_ITEMS.map((group) => ({
      ...group,
      items: group.items
        .filter(isVisible)
        .map((item) => ({ ...item, isActive: this.isRouteActive(current, item) })),
      // A group whose every entry is gated must not render its heading.
    })).filter((group) => group.items.length > 0);
  });

  ngOnInit(): void {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((event) => {
        this.currentRoute.set(event.urlAfterRedirects);

        if (this.isMobile()) {
          this.sidebarService.close();
        }
      });

    this.currentRoute.set(this.router.url);
  }

  toggle(): void {
    this.sidebarService.toggle();
  }

  getIcon(name: string): string {
    return ICON_MAP[name] ?? '';
  }

  private isRouteActive(currentUrl: string, item: SidebarNavItem): boolean {
    if (item.id === 'browse') {
      return currentUrl.startsWith('/categories/');
    }
    if (item.id === 'analytics') {
      return currentUrl.startsWith('/analytics');
    }
    if (item.id === 'queue') {
      return currentUrl.startsWith('/pending-queue');
    }
    return currentUrl.startsWith(item.route);
  }
}

/** Inline SVG icon map — lightweight alternative to an IconComponent for sidebar icons. */
const ICON_MAP: Record<string, string> = {
  layers: `<svg width="17" height="17" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>`,
  branch: `<svg width="17" height="17" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 3v12M18 9a3 3 0 100-6 3 3 0 000 6zM6 21a3 3 0 100-6 3 3 0 000 6zM18 9a9 9 0 01-9 9"/></svg>`,
  chart: `<svg width="17" height="17" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>`,
  wand: `<svg width="17" height="17" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 4l-1 1m0 0l-1 1m1-1l1 1m-1-1V3m0 0l-1-1m1 1l1-1M9 19l-6 6M3 17l6-6M14 7l-6 6"/></svg>`,
  inbox: `<svg width="17" height="17" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/></svg>`,
  shield: `<svg width="17" height="17" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>`,
  server: `<svg width="17" height="17" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"/></svg>`,
  doc: `<svg width="17" height="17" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>`,
};
