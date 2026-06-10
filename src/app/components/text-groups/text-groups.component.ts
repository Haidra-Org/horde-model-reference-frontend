import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  OnDestroy,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { ModelReferenceApiService } from '../../services/model-reference-api.service';
import { ShellContextService } from '../../services/shell-context.service';
import { AuthService } from '../../services/auth.service';
import { IconComponent } from '../common/icon.component';
import { TextTabsComponent } from './text-tabs.component';
import {
  SegmentedControlComponent,
  type SegmentedOption,
} from '../../../shared/design-system/components/segmented-control/segmented-control.component';
import type {
  GroupsSummaryResponse,
  GroupHealthResponse,
  GroupSummaryEntry,
  GroupHealthIssue,
} from '../../api-client';

type SortMode = 'name' | 'variants' | 'health';

interface FamilyFilterOption {
  value: string;
  label: string;
  count: number;
}

interface GroupCardData {
  group: GroupSummaryEntry;
  healthIssues: GroupHealthIssue[];
  familyName: string | null;
}

@Component({
  selector: 'app-text-groups',
  imports: [FormsModule, IconComponent, TextTabsComponent, SegmentedControlComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './text-groups.component.html',
})
export class TextGroupsComponent implements OnInit, OnDestroy {
  private readonly api = inject(ModelReferenceApiService);
  private readonly shellContext = inject(ShellContextService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly summary = signal<GroupsSummaryResponse | null>(null);
  readonly health = signal<GroupHealthResponse | null>(null);
  readonly searchQuery = signal('');
  readonly sortMode = signal<SortMode>('name');
  readonly activeFamilies = signal<string[]>([]);

  readonly canWrite = computed(
    () => this.api.backendCapabilities().writable && this.auth.isAuthenticated(),
  );

  readonly textTabs = [
    { route: '/text-groups', label: 'Groups', icon: 'branch' },
    { route: '/text-groups/families', label: 'Families & aliases', icon: 'layers' },
  ];

  readonly sortOptions: SegmentedOption[] = [
    { value: 'name', label: 'A–Z' },
    { value: 'variants', label: 'Most variants' },
    { value: 'health', label: 'Health' },
  ];

  readonly familyOptions = computed<FamilyFilterOption[]>(() => {
    const groups = this.summary()?.groups ?? [];
    const counts = new Map<string, number>();
    for (const g of groups) {
      const fn = g.family_name;
      if (fn) {
        counts.set(fn, (counts.get(fn) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([value, count]) => ({ value, label: value, count }));
  });

  readonly groupCards = computed<GroupCardData[]>(() => {
    const groups = this.summary()?.groups ?? [];
    const healthIssues = this.health()?.issues ?? [];

    // Build a map of group_name → health issues
    const healthMap = new Map<string, GroupHealthIssue[]>();
    for (const issue of healthIssues) {
      const existing = healthMap.get(issue.group_name) ?? [];
      existing.push(issue);
      healthMap.set(issue.group_name, existing);
    }

    const cards: GroupCardData[] = groups.map((g) => ({
      group: g,
      healthIssues: healthMap.get(g.group_name) ?? [],
      familyName: g.family_name ?? null,
    }));

    // Filter by search
    const q = this.searchQuery().toLowerCase().trim();
    let filtered = cards;
    if (q) {
      filtered = filtered.filter(
        (c) =>
          c.group.group_name.toLowerCase().includes(q) ||
          (c.familyName?.toLowerCase().includes(q) ?? false) ||
          (c.group.aliases?.some((a) => a.toLowerCase().includes(q)) ?? false),
      );
    }

    // Filter by family
    const fams = this.activeFamilies();
    if (fams.length > 0) {
      filtered = filtered.filter((c) => fams.includes(c.familyName ?? ''));
    }

    // Sort
    const mode = this.sortMode();
    filtered = [...filtered].sort((a, b) => {
      switch (mode) {
        case 'variants':
          return b.group.canonical_count - a.group.canonical_count;
        case 'health':
          return a.healthIssues.length - b.healthIssues.length;
        default:
          return a.group.group_name.localeCompare(b.group.group_name);
      }
    });

    return filtered;
  });

  readonly totalVariants = computed(() => {
    const total = this.summary()?.total_models ?? 0;
    return total;
  });

  ngOnInit(): void {
    this.shellContext.setContext({
      breadcrumb: [{ label: 'Catalog' }, { label: 'Text groups', route: ['/text-groups'] }],
      title: 'Text generation groups',
      sub: '',
      actions: [
        ...(this.canWrite()
          ? [
              {
                id: 'create-group',
                label: 'Create group',
                icon: 'plus',
                action: () =>
                  this.router.navigate(['/categories', 'text_generation', 'create-group']),
              },
            ]
          : []),
      ],
    });

    forkJoin({
      summary: this.api.getGroupsSummary(),
      health: this.api.getGroupsHealth(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ summary, health }) => {
          this.summary.set(summary);
          this.health.set(health);
          this.loading.set(false);

          // Update shell sub
          this.shellContext.setContext({
            breadcrumb: [{ label: 'Catalog' }, { label: 'Text groups', route: ['/text-groups'] }],
            title: 'Text generation groups',
            sub: `${summary.total_groups} base groups · ${summary.total_models} concrete variants · grouped from backend-prefixed, quantized names`,
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
        },
        error: () => {
          this.loading.set(false);
        },
      });
  }

  ngOnDestroy(): void {
    this.shellContext.clearContext();
  }

  toggleFamily(family: string): void {
    this.activeFamilies.update((fams) => {
      if (fams.includes(family)) {
        return fams.filter((f) => f !== family);
      }
      return [...fams, family];
    });
  }

  navigateToGroup(groupName: string): void {
    this.router.navigate(['/text-groups', groupName]);
  }
}
