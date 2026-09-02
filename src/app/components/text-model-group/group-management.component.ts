import {
  Component,
  inject,
  OnInit,
  signal,
  computed,
  ChangeDetectionStrategy,
  DestroyRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { filter, map, switchMap, tap } from 'rxjs/operators';
import { HordeBadgeComponent } from '@haidra/design-system/badge';
import { HordeButtonComponent } from '@haidra/design-system/button';
import { ModelReferenceApiService } from '../../services/model-reference-api.service';
import { NotificationService } from '../../services/notification.service';
import { AuthService } from '../../services/auth.service';
import { GroupSummaryEntry, GroupsSummaryResponse } from '../../api-client';
import { forkJoin } from 'rxjs';

type SortField =
  'group_name' | 'canonical_count' | 'family_name' | 'health_issues' | 'has_custom_schema';
type SortDirection = 'asc' | 'desc';
type HealthFilter = 'all' | 'healthy' | 'issues';

@Component({
  selector: 'app-group-management',
  imports: [RouterLink, FormsModule, HordeBadgeComponent, HordeButtonComponent],
  templateUrl: './group-management.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroupManagementComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ModelReferenceApiService);
  private readonly notification = inject(NotificationService);
  readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  readonly category = signal('');
  readonly loading = signal(true);
  readonly summary = signal<GroupsSummaryResponse | null>(null);

  // Filtering & sorting
  readonly searchQuery = signal('');
  readonly healthFilter = signal<HealthFilter>('all');
  readonly sortField = signal<SortField>('group_name');
  readonly sortDirection = signal<SortDirection>('asc');

  // Bulk operations
  readonly selectedGroups = signal<Set<string>>(new Set());
  readonly bulkFamilyName = signal('');
  readonly bulkOperationRunning = signal(false);

  readonly selectedCount = computed(() => this.selectedGroups().size);
  readonly allVisibleSelected = computed(() => {
    const filtered = this.filteredGroups();
    if (filtered.length === 0) return false;
    const selected = this.selectedGroups();
    return filtered.every((g) => selected.has(g.group_name));
  });

  readonly filteredGroups = computed(() => {
    const data = this.summary();
    if (!data) return [];

    let groups = [...data.groups];

    // Text search
    const query = this.searchQuery().toLowerCase().trim();
    if (query) {
      groups = groups.filter(
        (g) =>
          g.group_name.toLowerCase().includes(query) ||
          (g.family_name?.toLowerCase().includes(query) ?? false) ||
          (g.aliases?.some((a) => a.toLowerCase().includes(query)) ?? false),
      );
    }

    // Health filter
    const hf = this.healthFilter();
    if (hf === 'healthy') {
      groups = groups.filter((g) => !g.health_issues?.length);
    } else if (hf === 'issues') {
      groups = groups.filter((g) => (g.health_issues?.length ?? 0) > 0);
    }

    // Sort
    const field = this.sortField();
    const dir = this.sortDirection() === 'asc' ? 1 : -1;
    groups.sort((a, b) => {
      switch (field) {
        case 'group_name':
          return dir * a.group_name.localeCompare(b.group_name);
        case 'canonical_count':
          return dir * (a.canonical_count - b.canonical_count);
        case 'family_name':
          return dir * (a.family_name ?? '').localeCompare(b.family_name ?? '');
        case 'health_issues':
          return dir * ((a.health_issues?.length ?? 0) - (b.health_issues?.length ?? 0));
        case 'has_custom_schema':
          return dir * (Number(a.has_custom_schema) - Number(b.has_custom_schema));
        default:
          return 0;
      }
    });

    return groups;
  });

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        map((params) => params.get('category') ?? ''),
        filter((cat) => cat.length > 0),
        tap((cat) => {
          this.category.set(cat);
          this.loading.set(true);
        }),
        switchMap(() => this.api.getGroupsSummary()),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (data) => {
          this.summary.set(data);
          this.loading.set(false);
        },
        error: (err) => {
          this.notification.error(`Failed to load groups: ${err.message}`);
          this.loading.set(false);
        },
      });
  }

  toggleSort(field: SortField): void {
    if (this.sortField() === field) {
      this.sortDirection.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortField.set(field);
      this.sortDirection.set('asc');
    }
  }

  sortIcon(field: SortField): string {
    if (this.sortField() !== field) return '⇅';
    return this.sortDirection() === 'asc' ? '↑' : '↓';
  }

  issueCount(group: GroupSummaryEntry): number {
    return group.health_issues?.filter((i) => i.severity !== 'info').length ?? 0;
  }

  infoCount(group: GroupSummaryEntry): number {
    return group.health_issues?.filter((i) => i.severity === 'info').length ?? 0;
  }

  onSearchInput(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
  }

  // --- Bulk Selection ---

  toggleGroupSelection(groupName: string): void {
    this.selectedGroups.update((set) => {
      const next = new Set(set);
      if (next.has(groupName)) {
        next.delete(groupName);
      } else {
        next.add(groupName);
      }
      return next;
    });
  }

  toggleSelectAll(): void {
    if (this.allVisibleSelected()) {
      this.selectedGroups.set(new Set());
    } else {
      const names = this.filteredGroups().map((g) => g.group_name);
      this.selectedGroups.set(new Set(names));
    }
  }

  clearSelection(): void {
    this.selectedGroups.set(new Set());
  }

  isSelected(groupName: string): boolean {
    return this.selectedGroups().has(groupName);
  }

  // --- Bulk Actions ---

  bulkSetFamily(): void {
    const family = this.bulkFamilyName().trim();
    if (!family) return;

    const groups = [...this.selectedGroups()];
    if (groups.length === 0) return;

    this.bulkOperationRunning.set(true);
    const requests = groups.map((groupName) => this.api.addFamilyMember(family, groupName));

    forkJoin(requests)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.notification.success(`Added ${groups.length} group(s) to family "${family}"`);
          this.bulkOperationRunning.set(false);
          this.bulkFamilyName.set('');
          this.clearSelection();
          this.reloadSummary();
        },
        error: (err: Error) => {
          this.notification.error(`Bulk family assignment failed: ${err.message}`);
          this.bulkOperationRunning.set(false);
        },
      });
  }

  private reloadSummary(): void {
    this.loading.set(true);
    this.api
      .getGroupsSummary()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.summary.set(data);
          this.loading.set(false);
        },
        error: (err: Error) => {
          this.notification.error(`Failed to reload groups: ${err.message}`);
          this.loading.set(false);
        },
      });
  }
}
