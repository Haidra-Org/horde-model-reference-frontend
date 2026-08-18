import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ModelReferenceApiService } from '../../services/model-reference-api.service';
import { ViewerCapabilitiesService } from '../../services/viewer-capabilities.service';
import { ShellContextService } from '../../services/shell-context.service';
import { IconComponent } from '../common/icon.component';
import { TextTabsComponent } from './text-tabs.component';
import {
  SegmentedControlComponent,
  type SegmentedOption,
} from '../../../shared/design-system/components/segmented-control/segmented-control.component';
import type { GroupHealthIssue, GroupsSummaryResponse, GroupSummaryEntry } from '../../api-client';

type GroupViewFilter = 'all' | 'multi' | 'singleton' | 'attention' | 'custom';
type SortMode = 'name' | 'variants' | 'attention';

interface FamilyFilterOption {
  value: string;
  label: string;
  count: number;
}

interface GroupRowData {
  group: GroupSummaryEntry;
  actionableIssues: GroupHealthIssue[];
  informationalIssues: GroupHealthIssue[];
}

@Component({
  selector: 'app-text-groups',
  imports: [FormsModule, RouterLink, IconComponent, TextTabsComponent, SegmentedControlComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './text-groups.component.html',
})
export class TextGroupsComponent implements OnInit, OnDestroy {
  private readonly api = inject(ModelReferenceApiService);
  private readonly shellContext = inject(ShellContextService);
  private readonly viewer = inject(ViewerCapabilitiesService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly loadError = signal(false);
  readonly summary = signal<GroupsSummaryResponse | null>(null);
  readonly searchQuery = signal('');
  readonly sortMode = signal<SortMode>('name');
  readonly viewFilter = signal<GroupViewFilter>('all');
  readonly activeFamilies = signal<string[]>([]);

  readonly canWrite = this.viewer.canPropose;

  /**
   * The group explorer is public: which variants of a family exist, at which size and
   * quantisation, is exactly what someone choosing a text model needs. Group *health*
   * is a maintenance backlog and is shown only to those who can act on it.
   */
  readonly showCurationSignals = this.viewer.canSeeCuration;

  readonly textTabs = computed(() => [
    { route: '/text-groups', label: 'Groups', icon: 'branch' },
    ...(this.showCurationSignals()
      ? [{ route: '/text-groups/families', label: 'Families & aliases', icon: 'layers' }]
      : []),
  ]);

  readonly sortOptions = computed<SegmentedOption[]>(() => [
    { value: 'name', label: 'A–Z' },
    { value: 'variants', label: 'Most variants' },
    ...(this.showCurationSignals() ? [{ value: 'attention', label: 'Needs attention' }] : []),
  ]);

  readonly groupRows = computed<GroupRowData[]>(() =>
    (this.summary()?.groups ?? []).map((group) => {
      const healthIssues = group.health_issues ?? [];
      return {
        group,
        actionableIssues: healthIssues.filter((issue) => issue.severity !== 'info'),
        informationalIssues: healthIssues.filter((issue) => issue.severity === 'info'),
      };
    }),
  );

  readonly filterCounts = computed<Record<GroupViewFilter, number>>(() => {
    const rows = this.groupRows();
    return {
      all: rows.length,
      multi: rows.filter((row) => row.group.canonical_count > 1).length,
      singleton: rows.filter((row) => row.group.canonical_count === 1).length,
      attention: rows.filter((row) => row.actionableIssues.length > 0).length,
      custom: rows.filter((row) => row.group.has_custom_schema).length,
    };
  });

  readonly familyOptions = computed<FamilyFilterOption[]>(() => {
    const counts = new Map<string, number>();
    for (const row of this.groupRows()) {
      const familyName = row.group.family_name;
      if (familyName) counts.set(familyName, (counts.get(familyName) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([value, count]) => ({ value, label: value, count }));
  });

  /**
   * Health-derived views survive in bookmarks and shared links, and entitlement can
   * resolve after the query params hydrate, so both are re-checked here rather than
   * only at parse time.
   */
  readonly resolvedViewFilter = computed<GroupViewFilter>(() => {
    const view = this.viewFilter();
    return view === 'attention' && !this.showCurationSignals() ? 'all' : view;
  });

  readonly resolvedSortMode = computed<SortMode>(() => {
    const mode = this.sortMode();
    return mode === 'attention' && !this.showCurationSignals() ? 'name' : mode;
  });

  readonly filteredGroupRows = computed<GroupRowData[]>(() => {
    const query = this.searchQuery().toLocaleLowerCase().trim();
    const families = this.activeFamilies();
    const view = this.resolvedViewFilter();
    const rows = this.groupRows().filter((row) => {
      const matchesQuery =
        !query ||
        row.group.group_name.toLocaleLowerCase().includes(query) ||
        (row.group.family_name?.toLocaleLowerCase().includes(query) ?? false) ||
        (row.group.aliases ?? []).some((alias) => alias.toLocaleLowerCase().includes(query));
      const matchesFamily = families.length === 0 || families.includes(row.group.family_name ?? '');
      const matchesView =
        view === 'all' ||
        (view === 'multi' && row.group.canonical_count > 1) ||
        (view === 'singleton' && row.group.canonical_count === 1) ||
        (view === 'attention' && row.actionableIssues.length > 0) ||
        (view === 'custom' && row.group.has_custom_schema);
      return matchesQuery && matchesFamily && matchesView;
    });

    return [...rows].sort((left, right) => {
      if (this.resolvedSortMode() === 'variants') {
        return (
          right.group.canonical_count - left.group.canonical_count ||
          left.group.group_name.localeCompare(right.group.group_name)
        );
      }
      if (this.resolvedSortMode() === 'attention') {
        return (
          right.actionableIssues.length - left.actionableIssues.length ||
          left.group.group_name.localeCompare(right.group.group_name)
        );
      }
      return left.group.group_name.localeCompare(right.group.group_name);
    });
  });

  readonly hasActiveFilters = computed(
    () =>
      this.searchQuery().trim().length > 0 ||
      this.viewFilter() !== 'all' ||
      this.activeFamilies().length > 0,
  );

  ngOnInit(): void {
    this.readFiltersFromUrl();
    this.setShellContext();
    this.api
      .getGroupsSummary()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (summary) => {
          this.summary.set(summary);
          this.loading.set(false);
          this.setShellContext(summary);
        },
        error: () => {
          this.loadError.set(true);
          this.loading.set(false);
        },
      });
  }

  ngOnDestroy(): void {
    this.shellContext.clearContext();
  }

  updateSearchQuery(query: string): void {
    this.searchQuery.set(query);
    this.writeFiltersToUrl();
  }

  updateSortMode(mode: string): void {
    if (!isSortMode(mode)) return;
    this.sortMode.set(mode);
    this.writeFiltersToUrl();
  }

  setViewFilter(filter: GroupViewFilter): void {
    this.viewFilter.set(filter);
    this.writeFiltersToUrl();
  }

  toggleFamily(family: string): void {
    this.activeFamilies.update((families) =>
      families.includes(family)
        ? families.filter((candidate) => candidate !== family)
        : [...families, family],
    );
    this.writeFiltersToUrl();
  }

  clearFilters(): void {
    this.searchQuery.set('');
    this.viewFilter.set('all');
    this.activeFamilies.set([]);
    this.writeFiltersToUrl();
  }

  issueLabel(issueType: string): string {
    return issueType.replaceAll('_', ' ');
  }

  private readFiltersFromUrl(): void {
    const parameters = this.route.snapshot.queryParamMap;
    const view = parameters.get('view');
    const sort = parameters.get('sort');
    this.searchQuery.set(parameters.get('q') ?? '');
    if (isGroupViewFilter(view)) this.viewFilter.set(view);
    if (isSortMode(sort)) this.sortMode.set(sort);
    this.activeFamilies.set(
      (parameters.get('families') ?? '')
        .split(',')
        .map((family) => family.trim())
        .filter(Boolean),
    );
  }

  private writeFiltersToUrl(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        q: this.searchQuery().trim() || null,
        view: this.viewFilter() === 'all' ? null : this.viewFilter(),
        sort: this.sortMode() === 'name' ? null : this.sortMode(),
        families: this.activeFamilies().join(',') || null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private setShellContext(summary?: GroupsSummaryResponse): void {
    this.shellContext.setContext({
      breadcrumb: [{ label: 'Catalog' }, { label: 'Text groups', route: ['/text-groups'] }],
      title: 'Text generation groups',
      sub: summary
        ? summary.total_groups + ' groups · ' + summary.total_models + ' concrete variants'
        : 'Browse canonical text-model groups and their concrete variants.',
      actions: this.canWrite()
        ? [
            {
              id: 'create-group',
              label: 'Create group',
              icon: 'plus',
              action: () =>
                this.router.navigate(['/categories', 'text_generation', 'create-group']),
            },
          ]
        : [],
    });
  }
}

function isGroupViewFilter(value: string | null): value is GroupViewFilter {
  return ['all', 'multi', 'singleton', 'attention', 'custom'].includes(value ?? '');
}

function isSortMode(value: string | null): value is SortMode {
  return ['name', 'variants', 'attention'].includes(value ?? '');
}
