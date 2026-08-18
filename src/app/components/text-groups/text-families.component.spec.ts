import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { of } from 'rxjs';
import { TextFamiliesComponent } from './text-families.component';
import { ModelReferenceApiService } from '../../services/model-reference-api.service';
import { ShellContextService } from '../../services/shell-context.service';
import { AuthService } from '../../services/auth.service';
import { IconRegistryService } from '../../services/icon-registry.service';
import { NotificationService } from '../../services/notification.service';
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
  let apiSpy: {
    backendCapabilities: ReturnType<typeof signal>;
    listFamilies: ReturnType<typeof vi.fn>;
    listAliases: ReturnType<typeof vi.fn>;
    detectFamilySuggestions: ReturnType<typeof vi.fn>;
    setFamily: ReturnType<typeof vi.fn>;
    getGroupMembers: ReturnType<typeof vi.fn>;
  };
  const isApprover = signal(false);

  beforeEach(async () => {
    isApprover.set(false);
    apiSpy = {
      backendCapabilities: signal({
        writable: false,
        mode: 'REPLICA' as const,
        canonicalFormat: 'v2' as const,
      }),
      listFamilies: vi.fn().mockReturnValue(of(buildFamilies())),
      listAliases: vi.fn().mockReturnValue(of(buildAliases())),
      detectFamilySuggestions: vi.fn().mockReturnValue(of(buildSuggestions())),
      setFamily: vi
        .fn()
        .mockImplementation((familyName: string, members: string[]) =>
          of({ family_name: familyName, members }),
        ),
      getGroupMembers: vi.fn().mockImplementation((groupName: string) =>
        of({
          group_name: groupName,
          members: [
            {
              name: `publisher/${groupName}-7b`,
              display_name: `${groupName} 7B`,
              parsed: {},
              is_backend_duplicate: false,
            },
          ],
        }),
      ),
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
            isApprover,
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
    iconRegistry.register('search', 'M10 10l4 4');
    iconRegistry.register('arrowRight', 'M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3');
    iconRegistry.register('info', 'M11.25 11.25l.041-.02');
    iconRegistry.register('chevron', 'M8.25 4.5l7.5 7.5-7.5 7.5');

    fixture = TestBed.createComponent(TextFamiliesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('presents saved relationships without mixing in aliases or suggestions', () => {
    component.loading.set(false);
    component.families.set(buildFamilies().families);
    component.aliases.set(buildAliases().entries);
    component.suggestionData.set(buildSuggestions());
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Llama');
    expect(text).toContain('Mistral');
    const relationshipCounts = Array.from<Element>(
      fixture.nativeElement.querySelectorAll('.family-resource-table tbody tr td:nth-child(2)'),
    ).map((cell) => cell.textContent?.replace(/\s+/g, ' ').trim());
    expect(relationshipCounts).toEqual(['3related groups', '2related groups']);
    expect(text).not.toContain('llama3');
    expect(text).not.toContain('qwen-2.5');
  });

  it('explains each alias as a canonical resolution rule', () => {
    component.loading.set(false);
    component.families.set(buildFamilies().families);
    component.aliases.set(buildAliases().entries);
    component.suggestionData.set(buildSuggestions());
    component.setActiveView('aliases');
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('llama3');
    expect(text).toContain('llama-3');
    expect(text).toContain('mistral7b');
    expect(text).toContain('Canonicalizes lookup');
    expect(text).not.toContain('qwen-2.5');
  });

  it('expands a family into groups and exact model-detail links', () => {
    component.loading.set(false);
    component.families.set(buildFamilies().families);
    fixture.detectChanges();

    const showModels = Array.from<HTMLButtonElement>(
      fixture.nativeElement.querySelectorAll('button'),
    ).find((button) => button.textContent?.trim() === 'Show models');
    showModels!.click();
    fixture.detectChanges();

    expect(apiSpy.getGroupMembers).toHaveBeenCalledWith('llama-3');
    const exactModelLink = Array.from<HTMLAnchorElement>(
      fixture.nativeElement.querySelectorAll('.family-exact-model-links a'),
    )[0];
    expect(exactModelLink.textContent).toContain('llama-3 7B');
    expect(exactModelLink.getAttribute('href')).toBe(
      '/categories/text_generation/model/publisher%2Fllama-3-7b',
    );
  });

  it('provides detector provenance and scope before suggestions are reviewed', () => {
    component.loading.set(false);
    component.families.set(buildFamilies().families);
    component.aliases.set(buildAliases().entries);
    component.suggestionData.set(buildSuggestions());
    component.setActiveView('suggestions');
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Longest shared hyphen-prefix');
    expect(text).toContain('42 analyzed');
    expect(text).toContain('38 grouped');
    expect(text).toContain('4 standalone');
  });

  it('makes detected families inspectable when none have been persisted', () => {
    component.loading.set(false);
    component.families.set([]);
    component.suggestionData.set(buildSuggestions());
    component.setActiveView('suggestions');
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Heuristic family suggestions');
    expect(text).toContain('Qwen');
    expect(text).toContain('qwen-2.5');
    expect(text).toContain('not catalog metadata until approved');
  });

  it('moves an accepted detector suggestion into persisted families', () => {
    isApprover.set(true);
    apiSpy.backendCapabilities.set({
      writable: true,
      mode: 'PRIMARY',
      canonicalFormat: 'legacy',
    });
    component.loading.set(false);
    component.families.set([]);
    component.suggestionData.set(buildSuggestions());
    component.setActiveView('suggestions');
    fixture.detectChanges();

    const saveButton = Array.from<HTMLButtonElement>(
      fixture.nativeElement.querySelectorAll('button'),
    ).find((button) => button.textContent?.trim() === 'Save');
    expect(saveButton).toBeDefined();
    saveButton!.click();
    fixture.detectChanges();

    expect(apiSpy.setFamily).toHaveBeenCalledWith('Qwen', ['qwen-2', 'qwen-2.5']);
    expect(component.families()).toEqual([
      { family_name: 'Qwen', members: ['qwen-2', 'qwen-2.5'] },
    ]);
    expect(component.detectedFamilies()).toEqual([]);
    expect(component.activeView()).toBe('saved');
    expect(TestBed.inject(NotificationService).notifications()[0]?.message).toContain('Saved Qwen');
  });

  it('dismisses a detector candidate only for the current review session', () => {
    isApprover.set(true);
    apiSpy.backendCapabilities.set({
      writable: true,
      mode: 'PRIMARY',
      canonicalFormat: 'legacy',
    });
    component.families.set([]);
    component.suggestionData.set(buildSuggestions());
    component.setActiveView('suggestions');
    fixture.detectChanges();

    const dismissButton = Array.from<HTMLButtonElement>(
      fixture.nativeElement.querySelectorAll('button'),
    ).find((button) => button.textContent?.includes('Dismiss'));
    dismissButton!.click();
    fixture.detectChanges();

    expect(component.detectedFamilies()).toEqual([]);
    expect(apiSpy.setFamily).not.toHaveBeenCalled();
    expect(TestBed.inject(NotificationService).notifications()[0]?.message).toContain(
      'this review session',
    );
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
