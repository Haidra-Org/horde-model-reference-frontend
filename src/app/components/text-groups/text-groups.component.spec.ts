import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { of } from 'rxjs';
import { TextGroupsComponent } from './text-groups.component';
import { ModelReferenceApiService } from '../../services/model-reference-api.service';
import { ShellContextService } from '../../services/shell-context.service';
import { ViewerCapabilitiesService } from '../../services/viewer-capabilities.service';
import { IconRegistryService } from '../../services/icon-registry.service';
import type { GroupsSummaryResponse } from '../../api-client';

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
        health_issues: [
          {
            group_name: 'llama-3',
            issue_type: 'singleton_group',
            message: 'Group currently contains one canonical model',
            severity: 'info',
          },
        ],
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

describe('TextGroupsComponent', () => {
  let fixture: ComponentFixture<TextGroupsComponent>;
  let component: TextGroupsComponent;

  const canSeeCuration = signal(false);

  const viewerStub = {
    canSeeCuration: canSeeCuration.asReadonly(),
    canPropose: canSeeCuration.asReadonly(),
    canApprove: signal(false).asReadonly(),
    canEditLicensing: signal(false).asReadonly(),
  };

  /** Re-render with group-health surfaces enabled. */
  const asCurator = (): void => {
    canSeeCuration.set(true);
    fixture.detectChanges();
  };

  beforeEach(async () => {
    canSeeCuration.set(false);
    const apiSpy = {
      backendCapabilities: signal({
        writable: false,
        mode: 'REPLICA' as const,
        canonicalFormat: 'v2' as const,
      }),
      getGroupsSummary: vi.fn().mockReturnValue(of(buildSummary())),
    };

    await TestBed.configureTestingModule({
      imports: [TextGroupsComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: ModelReferenceApiService, useValue: apiSpy },
        { provide: ViewerCapabilitiesService, useValue: viewerStub },
        IconRegistryService,
        ShellContextService,
      ],
    }).compileComponents();

    // Register minimal icons
    const iconRegistry = TestBed.inject(IconRegistryService);
    iconRegistry.register('search', 'M10 10l4 4');
    iconRegistry.register('branch', 'M6 3v12');
    iconRegistry.register('layers', 'M2 17l7-5 7 5-7-5V5l-7 5z');
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

  it('renders every API group as a discoverable resource row', () => {
    component.loading.set(false);
    component.summary.set(buildSummary());
    fixture.detectChanges();

    const groupLinks = fixture.nativeElement.querySelectorAll('.catalog-resource-link');
    expect(groupLinks).toHaveLength(3);
    expect(Array.from<Element>(groupLinks).map((link) => link.textContent)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('llama-3'),
        expect.stringContaining('mistral-7b'),
        expect.stringContaining('qwen-2'),
      ]),
    );
    expect(groupLinks[0].getAttribute('href')).toBe('/text-groups/group?name=llama-3');
  });

  it('keeps a filtered catalog view shareable in the URL', async () => {
    component.updateSearchQuery('llama');
    component.setViewFilter('multi');
    component.toggleFamily('Llama');
    await fixture.whenStable();

    const url = TestBed.inject(Router).url;
    expect(url).toContain('q=llama');
    expect(url).toContain('view=multi');
    expect(url).toContain('families=Llama');
  });

  it('conveys canonical model counts without presenting backend duplicates as variants', () => {
    component.loading.set(false);
    component.summary.set(buildSummary());
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('12 canonical models');
    expect(text).toContain('6 canonical models');
    expect(text).not.toContain('8 duplicates');
  });

  it('shows persisted family relationships in the catalog', () => {
    component.loading.set(false);
    component.summary.set(buildSummary());
    fixture.detectChanges();

    const badges = fixture.nativeElement.querySelectorAll('.badge-purple');
    const badgeTexts = Array.from(badges).map((b) => (b as Element).textContent?.trim());
    expect(badgeTexts).toContain('Llama');
    expect(badgeTexts).toContain('Mistral');
  });

  it('finds a canonical group when the user searches by an alias', () => {
    component.loading.set(false);
    component.summary.set(buildSummary());
    component.searchQuery.set('llama3');
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('llama-3');
    expect(text).not.toContain('qwen-2');
  });

  it('narrows the explorer to a selected persisted family', () => {
    component.loading.set(false);
    component.summary.set(buildSummary());
    component.activeFamilies.set(['Llama']);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('llama-3');
    expect(text).not.toContain('mistral-7b');
  });

  it('offers recovery when no groups match', () => {
    component.loading.set(false);
    component.summary.set(buildSummary());
    component.searchQuery.set('nonexistent');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No matching groups');
    expect(fixture.nativeElement.textContent).toContain('Clear filters');
  });

  it('treats informational topology as context and filters only actionable warnings', () => {
    component.loading.set(false);
    component.summary.set(buildSummary());
    asCurator();
    component.setViewFilter('attention');
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('mistral-7b');
    expect(text).not.toContain('llama-3');
    expect(text).not.toContain('qwen-2');
    expect(component.filterCounts().attention).toBe(1);
  });

  it('hides group-health surfaces from a visitor', () => {
    component.loading.set(false);
    component.summary.set(buildSummary());
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).not.toContain('Data quality');
    expect(text).not.toContain('need attention');
    expect(text).not.toContain('Needs attention');
    // The explorer itself stays public: which variants exist is catalog information.
    expect(text).toContain('llama-3');
  });

  it('ignores a bookmarked attention filter for a visitor', () => {
    component.loading.set(false);
    component.summary.set(buildSummary());
    component.setViewFilter('attention');
    fixture.detectChanges();

    expect(component.resolvedViewFilter()).toBe('all');
    expect(fixture.nativeElement.textContent).toContain('llama-3');
  });

  it('orders the most variant-rich groups first when requested', () => {
    component.loading.set(false);
    component.summary.set(buildSummary());
    component.updateSortMode('variants');
    fixture.detectChanges();

    const names = Array.from<Element>(
      fixture.nativeElement.querySelectorAll('.catalog-resource-link strong'),
    ).map((element) => element.textContent?.trim());
    expect(names).toEqual(['llama-3', 'qwen-2', 'mistral-7b']);
  });

  it('should call shell context setContext on init', () => {
    const shellCtx = TestBed.inject(ShellContextService);
    expect(shellCtx.title()).toBe('Text generation groups');
  });
});
