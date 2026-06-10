import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { of } from 'rxjs';
import { TextFamiliesComponent } from './text-families.component';
import { ModelReferenceApiService } from '../../services/model-reference-api.service';
import { ShellContextService } from '../../services/shell-context.service';
import { AuthService } from '../../services/auth.service';
import { IconRegistryService } from '../../services/icon-registry.service';
import type {
  GroupFamilyListResponse,
  GroupAliasListResponse,
  DetectFamiliesResponse,
} from '../../api-client';

function buildFamilies(): GroupFamilyListResponse {
  return {
    families: [
      { family_name: 'Llama', members: ['llama-3', 'llama-2', 'code-llama'] },
      { family_name: 'Mistral', members: ['mistral-7b', 'mistral-8x7b'] },
    ],
  };
}

function buildAliases(): GroupAliasListResponse {
  return {
    entries: [
      { canonical: 'llama-3', aliases: ['llama3', 'llama-3-instruct'] },
      { canonical: 'mistral-7b', aliases: ['mistral7b'] },
    ],
  };
}

function buildSuggestions(): DetectFamiliesResponse {
  return {
    suggestions: [{ family_name: 'Qwen', members: ['qwen-2', 'qwen-2.5'] }],
    total_groups_analyzed: 42,
    groups_in_families: 38,
    standalone_groups: 4,
  };
}

describe('TextFamiliesComponent', () => {
  let fixture: ComponentFixture<TextFamiliesComponent>;
  let component: TextFamiliesComponent;

  beforeEach(async () => {
    const apiSpy = {
      backendCapabilities: signal({
        writable: false,
        mode: 'REPLICA' as const,
        canonicalFormat: 'v2' as const,
      }),
      listFamilies: vi.fn().mockReturnValue(of(buildFamilies())),
      listAliases: vi.fn().mockReturnValue(of(buildAliases())),
      detectFamilySuggestions: vi.fn().mockReturnValue(of(buildSuggestions())),
    };

    await TestBed.configureTestingModule({
      imports: [TextFamiliesComponent],
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
    iconRegistry.register('branch', 'M6 3v12');
    iconRegistry.register('layers', 'M2 17l7-5 7 5-7-5V5l-7 5z');
    iconRegistry.register('arrowRight', 'M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3');
    iconRegistry.register('info', 'M11.25 11.25l.041-.02');
    iconRegistry.register('chevron', 'M8.25 4.5l7.5 7.5-7.5 7.5');

    fixture = TestBed.createComponent(TextFamiliesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should render family cards when data loads', () => {
    component.loading.set(false);
    component.families.set(buildFamilies().families);
    component.aliases.set(buildAliases().entries);
    component.suggestionData.set(buildSuggestions());
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Llama');
    expect(text).toContain('Mistral');
    expect(text).toContain('3 groups');
    expect(text).toContain('2 groups');
  });

  it('should render alias table entries', () => {
    component.loading.set(false);
    component.families.set(buildFamilies().families);
    component.aliases.set(buildAliases().entries);
    component.suggestionData.set(buildSuggestions());
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('llama3');
    expect(text).toContain('llama-3');
    expect(text).toContain('mistral7b');
  });

  it('should render detect_families banner with stats', () => {
    component.loading.set(false);
    component.families.set(buildFamilies().families);
    component.aliases.set(buildAliases().entries);
    component.suggestionData.set(buildSuggestions());
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('detect_families');
    expect(text).toContain('42 groups analyzed');
    expect(text).toContain('38 in families');
    expect(text).toContain('4 standalone');
  });

  it('should show empty state when no families', () => {
    component.loading.set(false);
    component.families.set([]);
    component.aliases.set([]);
    component.suggestionData.set(null);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No families defined');
  });

  it('should call shell context setContext on init', () => {
    const shellCtx = TestBed.inject(ShellContextService);
    expect(shellCtx.title()).toBe('Families & aliases');
  });
});
