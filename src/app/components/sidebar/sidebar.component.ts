import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ModelReferenceApiService } from '../../services/model-reference-api.service';
import { NotificationService } from '../../services/notification.service';
import { PendingQueueSummaryService } from '../../services/pending-queue-summary.service';
import { SidebarService } from '../../services/sidebar.service';
import { RECORD_DISPLAY_MAP } from '../../models/maps';

const GENERATION_CATEGORY_ORDER = [
  'text_generation',
  'image_generation',
  'video_generation',
  'audio_generation',
] as const;

const GENERATION_CATEGORY_LOOKUP = new Set<string>(GENERATION_CATEGORY_ORDER);

type SidebarCategoryGroupId = 'generation' | 'utility';
type SidebarRouteView = 'list' | 'audit' | 'create' | 'other' | null;

interface SidebarCategoryGroup {
  id: SidebarCategoryGroupId;
  title: string;
  categories: string[];
}

@Component({
  selector: 'app-sidebar',
  imports: [],
  templateUrl: './sidebar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarComponent implements OnInit {
  private readonly api = inject(ModelReferenceApiService);
  private readonly notification = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly sidebarService = inject(SidebarService);
  readonly pendingSummary = inject(PendingQueueSummaryService);

  readonly categories = signal<string[]>([]);
  readonly loading = signal(true);
  readonly currentCategory = signal<string | null>(null);
  readonly currentCategoryView = signal<SidebarRouteView>(null);
  readonly isCollapsed = this.sidebarService.isCollapsed;
  readonly isMobile = this.sidebarService.isMobile;

  readonly writable = computed(() => this.api.backendCapabilities().writable);
  readonly recordDisplayMap = RECORD_DISPLAY_MAP;

  readonly groupedCategories = computed<SidebarCategoryGroup[]>(() => {
    const cats = this.categories();
    const generationCategories = GENERATION_CATEGORY_ORDER.filter((category) =>
      cats.includes(category),
    );
    const utilityCategories = cats
      .filter((category) => !GENERATION_CATEGORY_LOOKUP.has(category))
      .sort((a, b) => this.getCategoryLabel(a).localeCompare(this.getCategoryLabel(b)));

    const groups: SidebarCategoryGroup[] = [];
    if (generationCategories.length > 0) {
      groups.push({
        id: 'generation',
        title: 'Generation Models',
        categories: generationCategories,
      });
    }

    if (utilityCategories.length > 0) {
      groups.push({
        id: 'utility',
        title: 'Utility & Processing',
        categories: utilityCategories,
      });
    }

    return groups;
  });

  readonly pendingCountByGroup = computed<Record<SidebarCategoryGroupId, number>>(() => {
    const pendingCount = {
      generation: 0,
      utility: 0,
    };

    for (const group of this.groupedCategories()) {
      pendingCount[group.id] = group.categories.reduce((total, category) => {
        return total + this.pendingSummary.pendingCountFor(category);
      }, 0);
    }

    return pendingCount;
  });

  readonly selectedCategoryLabel = computed(() => {
    const category = this.currentCategory();
    return category ? this.getCategoryLabel(category) : '';
  });

  constructor() {
    effect(() => {
      const defaults = this.groupedCategories().reduce<Record<string, boolean>>((acc, group) => {
        acc[group.id] = true;
        return acc;
      }, {});

      this.sidebarService.setGroupStateDefaults(defaults);
    });
  }

  ngOnInit(): void {
    this.loadCategories();
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((event) => {
        this.updateRouteState(event.urlAfterRedirects);

        if (this.isMobile()) {
          this.sidebarService.close();
        }
      });
    this.updateRouteState(this.router.url);
  }

  toggle(): void {
    this.sidebarService.toggle();
  }

  isGroupOpen(groupId: SidebarCategoryGroupId): boolean {
    return this.sidebarService.isGroupOpen(groupId);
  }

  toggleGroup(groupId: SidebarCategoryGroupId): void {
    this.sidebarService.toggleGroup(groupId);
  }

  selectCategory(category: string): void {
    this.router.navigate(['/categories', category]);
    this.closeSidebarOnMobile();
  }

  openSelectedCategoryList(): void {
    const category = this.currentCategory();
    if (!category) {
      return;
    }

    this.router.navigate(['/categories', category]);
    this.closeSidebarOnMobile();
  }

  openSelectedCategoryAudit(): void {
    const category = this.currentCategory();
    if (!category) {
      return;
    }

    this.router.navigate(['/categories', category, 'audit']);
    this.closeSidebarOnMobile();
  }

  openSelectedCategoryCreate(): void {
    const category = this.currentCategory();
    if (!category || !this.writable()) {
      return;
    }

    this.router.navigate(['/categories', category, 'create']);
    this.closeSidebarOnMobile();
  }

  isCurrentView(view: Exclude<SidebarRouteView, 'other' | null>): boolean {
    return this.currentCategoryView() === view;
  }

  getCategoryLabel(category: string): string {
    return this.recordDisplayMap[category] || category;
  }

  getGroupPendingCount(groupId: SidebarCategoryGroupId): number {
    return this.pendingCountByGroup()[groupId] ?? 0;
  }

  private closeSidebarOnMobile(): void {
    if (this.isMobile()) {
      this.sidebarService.close();
    }
  }

  private loadCategories(): void {
    this.loading.set(true);
    this.api.getCategories().subscribe({
      next: (categories) => {
        this.categories.set(categories);
        this.loading.set(false);
      },
      error: (error: Error) => {
        this.notification.error(error.message);
        this.loading.set(false);
      },
    });
  }

  private updateRouteState(url: string): void {
    const urlTree = this.router.parseUrl(url);
    const primarySegments =
      urlTree.root.children['primary']?.segments.map((segment) => segment.path) ?? [];

    if (primarySegments[0] !== 'categories' || !primarySegments[1]) {
      this.currentCategory.set(null);
      this.currentCategoryView.set(null);
      return;
    }

    this.currentCategory.set(primarySegments[1]);

    const routeSuffix = primarySegments[2];
    if (!routeSuffix) {
      this.currentCategoryView.set('list');
      return;
    }

    if (routeSuffix === 'audit') {
      this.currentCategoryView.set('audit');
      return;
    }

    if (routeSuffix === 'create') {
      this.currentCategoryView.set('create');
      return;
    }

    this.currentCategoryView.set('other');
  }
}
