import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { of } from 'rxjs';
import { TextGroupsComponent } from './text-groups.component';
import { ModelReferenceApiService } from '../../services/model-reference-api.service';
import { ShellContextService } from '../../services/shell-context.service';
import { AuthService } from '../../services/auth.service';
import { IconRegistryService } from '../../services/icon-registry.service';
import type { GroupsSummaryResponse, GroupHealthResponse } from '../../api-client';

function buildSummary(overrides: Partial<GroupsSummaryResponse> = {}): GroupsSummaryResponse {
  return {
    groups: [
      {
        group_name: 'llama-3',
        canonical_count: 12,
        backend_duplicate_count: 8,
        has_custom_schema: false,
        family_name: 'Llama',
        alias_canonical: null,
        aliases: ['llama3'],
        available_sizes: ['8B', '70B'],
        health_issues: [],
      },
      {
        group_name: 'mistral-7b',
        canonical_count: 6,
        backend_duplicate_count: 4,
        has_custom_schema: true,
        family_name: 'Mistral',
        alias_canonical: null,
        aliases: ['mistral7b'],
        available_sizes: ['7B'],
        health_issues: [
          {
            group_name: 'mistral-7b',
            issue_type: 'mixed_nsfw',
            message: 'NSFW inconsistency',
            severity: 'warning',
          },
        ],
      },
      {
        group_name: 'qwen-2',
        canonical_count: 8,
        backend_duplicate_count: 3,
        has_custom_schema: false,
        family_name: null,
        alias_canonical: null,
        aliases: [],
        available_sizes: ['1.5B', '7B', '72B'],
        health_issues: [],
      },
    ],
    total_groups: 3,
    total_models: 41,
    groups_with_families: 2,
    groups_with_aliases: 2,
    groups_with_issues: 1,
    ...overrides,
  };
}

function buildHealth(overrides: Partial<GroupHealthResponse> = {}): GroupHealthResponse {
  return {
    issues: [
      {
        group_name: 'mistral-7b',
        issue_type: 'mixed_nsfw',
        message: 'NSFW inconsistency',
        severity: 'warning',
      },
    ],
    total_groups_checked: 3,
    groups_with_issues: 1,
    issue_counts_by_type: { mixed_nsfw: 1 },
    ...overrides,
  };
}

describe('TextGroupsComponent', () => {
  let fixture: ComponentFixture<TextGroupsComponent>;
  let component: TextGroupsComponent;

  beforeEach(async () => {
    const apiSpy = {
      backendCapabilities: signal({
        writable: false,
        mode: 'REPLICA' as const,
        canonicalFormat: 'v2' as const,
      }),
      getGroupsSummary: vi.fn().mockReturnValue(of(buildSummary())),
      getGroupsHealth: vi.fn().mockReturnValue(of(buildHealth())),
    };

    await TestBed.configureTestingModule({
      imports: [TextGroupsComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: ModelReferenceApiService, useValue: apiSpy },
        {
          provide: AuthService,
          useValue: {
            isAuthenticated: () => false,
            isRequestor: () => false,
            isApprover: () => false,
          },
        },
        IconRegistryService,
        ShellContextService,
      ],
    }).compileComponents();

    // Register minimal icons
    const iconRegistry = TestBed.inject(IconRegistryService);
    iconRegistry.register('search', 'M10 10l4 4');
    iconRegistry.register('branch', 'M6 3v12');
    iconRegistry.register('cube', 'M21 7.5l-9-5.25L3 7.5');
    iconRegistry.register('server', 'M21.75 17.25v-.228');
    iconRegistry.register('chevron', 'M8.25 4.5l7.5 7.5-7.5 7.5');

    fixture = TestBed.createComponent(TextGroupsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should render loading state initially', () => {
    component.loading.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Loading');
  });

  it('should render group cards when data loads', () => {
    component.loading.set(false);
    component.summary.set(buildSummary());
    component.health.set(buildHealth());
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('llama-3');
    expect(text).toContain('mistral-7b');
    expect(text).toContain('qwen-2');
  });

  it('should show variant counts on cards', () => {
    component.loading.set(false);
    component.summary.set(buildSummary());
    component.health.set(buildHealth());
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('12 variants');
    expect(fixture.nativeElement.textContent).toContain('6 variants');
  });

  it('should show family badges on cards', () => {
    component.loading.set(false);
    component.summary.set(buildSummary());
    component.health.set(buildHealth());
    fixture.detectChanges();

    const badges = fixture.nativeElement.querySelectorAll('.badge-purple');
    const badgeTexts = Array.from(badges).map((b) => (b as Element).textContent?.trim());
    expect(badgeTexts).toContain('Llama');
    expect(badgeTexts).toContain('Mistral');
  });

  it('should filter groups by search query', () => {
    component.loading.set(false);
    component.summary.set(buildSummary());
    component.health.set(buildHealth());
    component.searchQuery.set('llama');
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('llama-3');
    expect(text).not.toContain('qwen-2');
  });

  it('should filter groups by family', () => {
    component.loading.set(false);
    component.summary.set(buildSummary());
    component.health.set(buildHealth());
    component.activeFamilies.set(['Llama']);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('llama-3');
    expect(text).not.toContain('mistral-7b');
  });

  it('should show empty state when no groups match', () => {
    component.loading.set(false);
    component.summary.set(buildSummary());
    component.health.set(buildHealth());
    component.searchQuery.set('nonexistent');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No groups match');
  });

  it('should call shell context setContext on init', () => {
    const shellCtx = TestBed.inject(ShellContextService);
    expect(shellCtx.title()).toBe('Text generation groups');
  });
});
