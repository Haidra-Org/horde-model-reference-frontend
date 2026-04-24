import { ComponentFixture, TestBed } from '@angular/core/testing';
import { computed, provideZonelessChangeDetection, signal } from '@angular/core';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { map } from 'rxjs/operators';
import { GroupManagementComponent } from './group-management.component';
import { ModelReferenceApiService } from '../../services/model-reference-api.service';
import { NotificationService } from '../../services/notification.service';
import { AuthService } from '../../services/auth.service';
import { GroupsSummaryResponse, GroupSummaryEntry, GroupHealthIssue } from '../../api-client';

interface ApiServiceSpy {
  backendCapabilities: ReturnType<typeof signal>;
  getGroupsSummary: ReturnType<typeof vi.fn>;
}

interface NotificationSpy {
  error: ReturnType<typeof vi.fn>;
  success: ReturnType<typeof vi.fn>;
}

interface AuthSpy {
  isAuthenticated: ReturnType<typeof computed>;
}

function buildIssue(
  type: string,
  severity: 'warning' | 'info' = 'warning',
  message = '',
): GroupHealthIssue {
  return { issue_type: type, severity, message: message || `${type} detected` };
}

function buildGroupEntry(name: string, opts: Partial<GroupSummaryEntry> = {}): GroupSummaryEntry {
  return {
    group_name: name,
    canonical_count: opts.canonical_count ?? 3,
    backend_duplicate_count: opts.backend_duplicate_count ?? 0,
    available_sizes: opts.available_sizes ?? ['7B', '13B'],
    has_custom_schema: opts.has_custom_schema ?? false,
    family_name: opts.family_name ?? null,
    aliases: opts.aliases ?? [],
    alias_canonical: opts.alias_canonical ?? null,
    health_issues: opts.health_issues ?? [],
  };
}

function buildSummary(
  groups: GroupSummaryEntry[],
  overrides: Partial<GroupsSummaryResponse> = {},
): GroupsSummaryResponse {
  return {
    total_groups: overrides.total_groups ?? groups.length,
    total_models: overrides.total_models ?? groups.reduce((sum, g) => sum + g.canonical_count, 0),
    groups_with_families:
      overrides.groups_with_families ?? groups.filter((g) => g.family_name).length,
    groups_with_aliases:
      overrides.groups_with_aliases ?? groups.filter((g) => (g.aliases?.length ?? 0) > 0).length,
    groups_with_issues:
      overrides.groups_with_issues ??
      groups.filter((g) => (g.health_issues?.length ?? 0) > 0).length,
    groups,
  };
}

describe('GroupManagementComponent', () => {
  let fixture: ComponentFixture<GroupManagementComponent>;
  let component: GroupManagementComponent;
  let api: ApiServiceSpy;
  let notification: NotificationSpy;
  let rawParams: BehaviorSubject<Record<string, string>>;

  beforeEach(async () => {
    rawParams = new BehaviorSubject<Record<string, string>>({
      category: 'text_generation',
    });

    api = {
      backendCapabilities: signal({ writable: true, mode: 'PRIMARY', canonicalFormat: 'legacy' }),
      getGroupsSummary: vi.fn().mockReturnValue(of(buildSummary([]))),
    };

    notification = {
      error: vi.fn(),
      success: vi.fn(),
    };

    const auth: AuthSpy = {
      isAuthenticated: computed(() => true),
    };

    const paramMap$ = rawParams.pipe(map((p) => convertToParamMap(p)));

    await TestBed.configureTestingModule({
      imports: [GroupManagementComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: ModelReferenceApiService, useValue: api },
        { provide: NotificationService, useValue: notification },
        { provide: AuthService, useValue: auth },
        { provide: ActivatedRoute, useValue: { paramMap: paramMap$ } },
      ],
    }).compileComponents();
  });

  function initWith(groups: GroupSummaryEntry[], overrides?: Partial<GroupsSummaryResponse>): void {
    api.getGroupsSummary.mockReturnValue(of(buildSummary(groups, overrides)));
    fixture = TestBed.createComponent(GroupManagementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  describe('initialization', () => {
    it('sets category from route params', () => {
      initWith([]);
      expect(component.category()).toBe('text_generation');
    });

    it('calls getGroupsSummary on init', () => {
      initWith([]);
      expect(api.getGroupsSummary).toHaveBeenCalled();
    });

    it('stores summary response', () => {
      const groups = [buildGroupEntry('Llama-3'), buildGroupEntry('Mistral')];
      initWith(groups);

      expect(component.summary()).not.toBeNull();
      expect(component.summary()!.total_groups).toBe(2);
    });

    it('sets loading to false after response', () => {
      initWith([]);
      expect(component.loading()).toBe(false);
    });

    it('shows error notification on API failure', () => {
      api.getGroupsSummary.mockReturnValue(throwError(() => new Error('Network error')));
      fixture = TestBed.createComponent(GroupManagementComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      expect(notification.error).toHaveBeenCalledWith(expect.stringContaining('Network error'));
      expect(component.loading()).toBe(false);
    });
  });

  describe('filtering', () => {
    const groups = [
      buildGroupEntry('Llama-3', { family_name: 'meta-llama', aliases: ['llama3'] }),
      buildGroupEntry('Mistral', { family_name: null, aliases: [] }),
      buildGroupEntry('Qwen-2', { family_name: 'qwen-family', aliases: ['qwen2', 'qwen-v2'] }),
    ];

    it('returns all groups with no search query', () => {
      initWith(groups);
      expect(component.filteredGroups().length).toBe(3);
    });

    it('filters by group name', () => {
      initWith(groups);
      component.searchQuery.set('llama');
      expect(component.filteredGroups().length).toBe(1);
      expect(component.filteredGroups()[0].group_name).toBe('Llama-3');
    });

    it('filters by family name', () => {
      initWith(groups);
      component.searchQuery.set('qwen-family');
      expect(component.filteredGroups().length).toBe(1);
      expect(component.filteredGroups()[0].group_name).toBe('Qwen-2');
    });

    it('filters by alias', () => {
      initWith(groups);
      component.searchQuery.set('qwen-v2');
      expect(component.filteredGroups().length).toBe(1);
      expect(component.filteredGroups()[0].group_name).toBe('Qwen-2');
    });

    it('search is case-insensitive', () => {
      initWith(groups);
      component.searchQuery.set('MISTRAL');
      expect(component.filteredGroups().length).toBe(1);
    });
  });

  describe('health filtering', () => {
    const groups = [
      buildGroupEntry('Healthy-Group'),
      buildGroupEntry('Warn-Group', {
        health_issues: [buildIssue('singleton_group', 'warning')],
      }),
      buildGroupEntry('Info-Group', {
        health_issues: [buildIssue('missing_description', 'info')],
      }),
    ];

    it('shows all groups by default', () => {
      initWith(groups);
      expect(component.filteredGroups().length).toBe(3);
    });

    it('filters to healthy groups only', () => {
      initWith(groups);
      component.healthFilter.set('healthy');
      expect(component.filteredGroups().length).toBe(1);
      expect(component.filteredGroups()[0].group_name).toBe('Healthy-Group');
    });

    it('filters to groups with issues', () => {
      initWith(groups);
      component.healthFilter.set('issues');
      expect(component.filteredGroups().length).toBe(2);
      expect(component.filteredGroups().map((g) => g.group_name)).toEqual(
        expect.arrayContaining(['Warn-Group', 'Info-Group']),
      );
    });
  });

  describe('sorting', () => {
    const groups = [
      buildGroupEntry('Zebra', { canonical_count: 1 }),
      buildGroupEntry('Alpha', { canonical_count: 10 }),
      buildGroupEntry('Middle', { canonical_count: 5 }),
    ];

    it('sorts by group name ascending by default', () => {
      initWith(groups);
      const names = component.filteredGroups().map((g) => g.group_name);
      expect(names).toEqual(['Alpha', 'Middle', 'Zebra']);
    });

    it('toggleSort reverses direction on same field', () => {
      initWith(groups);
      component.toggleSort('group_name');
      const names = component.filteredGroups().map((g) => g.group_name);
      expect(names).toEqual(['Zebra', 'Middle', 'Alpha']);
    });

    it('toggleSort changes field and resets to asc', () => {
      initWith(groups);
      component.toggleSort('canonical_count');
      const counts = component.filteredGroups().map((g) => g.canonical_count);
      expect(counts).toEqual([1, 5, 10]);
    });

    it('sorts by canonical_count descending', () => {
      initWith(groups);
      component.sortField.set('canonical_count');
      component.sortDirection.set('desc');
      const counts = component.filteredGroups().map((g) => g.canonical_count);
      expect(counts).toEqual([10, 5, 1]);
    });
  });

  describe('sort icons', () => {
    it('returns ⇅ for inactive sort field', () => {
      initWith([]);
      expect(component.sortIcon('canonical_count')).toBe('⇅');
    });

    it('returns ↑ for active ascending sort', () => {
      initWith([]);
      expect(component.sortIcon('group_name')).toBe('↑');
    });

    it('returns ↓ for active descending sort', () => {
      initWith([]);
      component.sortDirection.set('desc');
      expect(component.sortIcon('group_name')).toBe('↓');
    });
  });

  describe('health counts', () => {
    it('counts non-info issues as warnings', () => {
      const group = buildGroupEntry('Test', {
        health_issues: [
          buildIssue('singleton_group', 'warning'),
          buildIssue('inconsistent_baselines', 'warning'),
          buildIssue('missing_description', 'info'),
        ],
      });
      initWith([group]);
      expect(component.issueCount(group)).toBe(2);
    });

    it('counts info issues separately', () => {
      const group = buildGroupEntry('Test', {
        health_issues: [
          buildIssue('singleton_group', 'warning'),
          buildIssue('missing_description', 'info'),
        ],
      });
      initWith([group]);
      expect(component.infoCount(group)).toBe(1);
    });

    it('returns 0 for groups with no issues', () => {
      const group = buildGroupEntry('Test');
      initWith([group]);
      expect(component.issueCount(group)).toBe(0);
      expect(component.infoCount(group)).toBe(0);
    });
  });

  describe('search + health filter combined', () => {
    it('applies both filters simultaneously', () => {
      const groups = [
        buildGroupEntry('Llama-3', {
          health_issues: [buildIssue('singleton_group', 'warning')],
        }),
        buildGroupEntry('Llama-2'),
        buildGroupEntry('Mistral', {
          health_issues: [buildIssue('inconsistent_baselines', 'warning')],
        }),
      ];
      initWith(groups);

      component.searchQuery.set('llama');
      component.healthFilter.set('issues');

      expect(component.filteredGroups().length).toBe(1);
      expect(component.filteredGroups()[0].group_name).toBe('Llama-3');
    });
  });
});
