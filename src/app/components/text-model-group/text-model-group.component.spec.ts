import { ComponentFixture, TestBed } from '@angular/core/testing';
import { computed, provideZonelessChangeDetection, signal, WritableSignal } from '@angular/core';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { TextModelGroupComponent } from './text-model-group.component';
import { ModelReferenceApiService } from '../../services/model-reference-api.service';
import { NotificationService } from '../../services/notification.service';
import { AuthService } from '../../services/auth.service';
import { GroupMembersResponse, GroupMemberInfo } from '../../api-client';

interface ApiServiceSpy {
  backendCapabilities: ReturnType<typeof signal>;
  getGroupMembers: ReturnType<typeof vi.fn>;
  deleteModel: ReturnType<typeof vi.fn>;
}

interface NotificationSpy {
  error: ReturnType<typeof vi.fn>;
  success: ReturnType<typeof vi.fn>;
  warning: ReturnType<typeof vi.fn>;
}

interface AuthSpy {
  isAuthenticated: ReturnType<typeof computed>;
}

function buildMember(
  name: string,
  opts: {
    parameters?: number;
    baseline?: string;
    nsfw?: boolean;
    description?: string;
    tags?: string[];
    style?: string;
    display_name?: string;
    is_backend_duplicate?: boolean;
    backend_prefix?: string | null;
  } = {},
): GroupMemberInfo {
  return {
    name,
    parsed: { base_name: name },
    parameters: opts.parameters ?? null,
    baseline: opts.baseline ?? null,
    nsfw: opts.nsfw ?? null,
    description: opts.description ?? null,
    tags: opts.tags ?? null,
    style: opts.style ?? null,
    display_name: opts.display_name ?? null,
    is_backend_duplicate: opts.is_backend_duplicate ?? false,
    backend_prefix: opts.backend_prefix ?? null,
  };
}

function buildGroupResponse(
  groupName: string,
  members: GroupMemberInfo[],
  available_sizes: string[] = [],
): GroupMembersResponse {
  return {
    group_name: groupName,
    members,
    common_fields: {},
    available_sizes,
    available_variants: [],
    available_quants: [],
    available_versions: [],
    name_format: {
      separator: '-',
      part_order: ['base'],
      author_included: false,
      template: '{base}',
    },
    canonical_count: members.filter((m) => !m.is_backend_duplicate).length,
    backend_duplicate_count: members.filter((m) => m.is_backend_duplicate).length,
  };
}

describe('TextModelGroupComponent', () => {
  let fixture: ComponentFixture<TextModelGroupComponent>;
  let component: TextModelGroupComponent;
  let api: ApiServiceSpy;
  let notification: NotificationSpy;
  let auth: AuthSpy;
  let isAuthenticatedSource: WritableSignal<boolean>;
  let router: Router;
  let rawParams: BehaviorSubject<Record<string, string>>;

  beforeEach(async () => {
    rawParams = new BehaviorSubject<Record<string, string>>({
      category: 'text_generation',
      groupName: 'Llama-3',
    });

    isAuthenticatedSource = signal(true);

    api = {
      backendCapabilities: signal({ writable: true, mode: 'PRIMARY', canonicalFormat: 'legacy' }),
      getGroupMembers: vi.fn().mockReturnValue(of(buildGroupResponse('Llama-3', []))),
      deleteModel: vi.fn(),
    };

    notification = {
      error: vi.fn(),
      success: vi.fn(),
      warning: vi.fn(),
    };

    auth = {
      isAuthenticated: computed(() => isAuthenticatedSource()),
    };

    const paramMap$ = rawParams.pipe(map((p) => convertToParamMap(p)));

    await TestBed.configureTestingModule({
      imports: [TextModelGroupComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: ModelReferenceApiService, useValue: api },
        { provide: NotificationService, useValue: notification },
        { provide: AuthService, useValue: auth },
        { provide: ActivatedRoute, useValue: { paramMap: paramMap$ } },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
  });

  function initWithGroupResponse(response: GroupMembersResponse): void {
    api.getGroupMembers.mockReturnValue(of(response));
    fixture = TestBed.createComponent(TextModelGroupComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  describe('group member extraction', () => {
    it('filters to only group members (backend handles filtering)', () => {
      const response = buildGroupResponse('Llama-3', [
        buildMember('Llama-3-8B-Instruct', { parameters: 8_000_000_000 }),
        buildMember('Llama-3-1B-Instruct', { parameters: 1_000_000_000 }),
      ]);

      initWithGroupResponse(response);

      expect(component.canonicalMembers().length).toBe(2);
      expect(component.canonicalMembers().map((m) => m.name)).toEqual([
        'Llama-3-8B-Instruct',
        'Llama-3-1B-Instruct',
      ]);
    });

    it('separates canonical members from backend duplicates', () => {
      const response = buildGroupResponse('Llama-3', [
        buildMember('Llama-3-8B-Instruct', { parameters: 8_000_000_000 }),
        buildMember('aphrodite/Llama-3-8B-Instruct', {
          parameters: 8_000_000_000,
          is_backend_duplicate: true,
          backend_prefix: 'aphrodite',
        }),
        buildMember('koboldcpp/Llama-3-8B-Instruct', {
          parameters: 8_000_000_000,
          is_backend_duplicate: true,
          backend_prefix: 'koboldcpp',
        }),
      ]);

      initWithGroupResponse(response);

      expect(component.canonicalMembers().length).toBe(1);
      expect(component.canonicalMembers()[0].name).toBe('Llama-3-8B-Instruct');

      expect(component.backendDuplicates().length).toBe(2);
      expect(component.backendDuplicates().map((m) => m.backend_prefix)).toEqual(
        expect.arrayContaining(['aphrodite', 'koboldcpp']),
      );
    });

    it('separates canonical from duplicates correctly in mixed order', () => {
      const response = buildGroupResponse('Llama-3', [
        buildMember('aphrodite/Llama-3-8B-Instruct', {
          is_backend_duplicate: true,
          backend_prefix: 'aphrodite',
        }),
        buildMember('Llama-3-8B-Instruct'),
        buildMember('koboldcpp/Llama-3-8B-Instruct', {
          is_backend_duplicate: true,
          backend_prefix: 'koboldcpp',
        }),
      ]);

      initWithGroupResponse(response);

      expect(component.canonicalMembers().length).toBe(1);
      expect(component.backendDuplicates().length).toBe(2);
    });

    it('returns empty members when response has no members', () => {
      const response = buildGroupResponse('Llama-3', []);

      initWithGroupResponse(response);

      expect(component.canonicalMembers().length).toBe(0);
      expect(notification.error).toHaveBeenCalledWith(expect.stringContaining('No models found'));
    });
  });

  describe('parameter summary', () => {
    it('returns available sizes from the response', () => {
      const response = buildGroupResponse(
        'Llama-3',
        [
          buildMember('Llama-3-8B-Instruct', { parameters: 8_000_000_000 }),
          buildMember('Llama-3-1B-Instruct', { parameters: 1_000_000_000 }),
          buildMember('Llama-3-70B-Instruct', { parameters: 70_000_000_000 }),
        ],
        ['1B', '8B', '70B'],
      );

      initWithGroupResponse(response);

      const summary = component.parameterSummary();
      expect(summary).toEqual(['1B', '8B', '70B']);
    });

    it('returns null when no sizes are available', () => {
      const response = buildGroupResponse('Llama-3', [buildMember('Llama-3-Instruct')]);

      initWithGroupResponse(response);

      expect(component.parameterSummary()).toBeNull();
    });
  });

  describe('navigation', () => {
    it('navigates to edit route with actual record key', () => {
      const response = buildGroupResponse('Llama-3', [
        buildMember('Llama-3-8B-Instruct', { parameters: 8_000_000_000 }),
      ]);
      initWithGroupResponse(response);

      const member = component.canonicalMembers()[0];
      component.editMember(member);

      expect(router.navigate).toHaveBeenCalledWith(
        ['/categories', 'text_generation', 'edit', 'Llama-3-8B-Instruct'],
        { queryParams: { groupName: 'Llama-3' } },
      );
    });

    it('navigates back to model list', () => {
      initWithGroupResponse(buildGroupResponse('Llama-3', []));
      component.goBackToList();

      expect(router.navigate).toHaveBeenCalledWith(['/categories', 'text_generation']);
    });
  });

  describe('writable state', () => {
    it('is writable when backend supports writes and user is authenticated', () => {
      initWithGroupResponse(buildGroupResponse('Llama-3', []));
      expect(component.writable()).toBe(true);
    });

    it('is not writable when backend does not support writes', () => {
      api.backendCapabilities.set({ writable: false, mode: 'REPLICA', canonicalFormat: 'legacy' });
      initWithGroupResponse(buildGroupResponse('Llama-3', []));
      expect(component.writable()).toBe(false);
    });

    it('is not writable when user is not authenticated', () => {
      isAuthenticatedSource.set(false);
      initWithGroupResponse(buildGroupResponse('Llama-3', []));
      expect(component.writable()).toBe(false);
    });
  });

  describe('delete single member', () => {
    it('sets modelToDelete on confirmDeleteMember', () => {
      const response = buildGroupResponse('Llama-3', [buildMember('Llama-3-8B-Instruct')]);
      initWithGroupResponse(response);

      const member = component.canonicalMembers()[0];
      component.confirmDeleteMember(member);

      expect(component.modelToDelete()).toBe('Llama-3-8B-Instruct');
    });

    it('clears modelToDelete on cancelDelete', () => {
      initWithGroupResponse(buildGroupResponse('Llama-3', []));
      component.modelToDelete.set('some-model');
      component.deleteConfirmationInput.set('some-model');

      component.cancelDelete();

      expect(component.modelToDelete()).toBeNull();
      expect(component.deleteConfirmationInput()).toBe('');
    });

    it('deleteAllowed is true when confirmation matches', () => {
      initWithGroupResponse(buildGroupResponse('Llama-3', []));
      component.modelToDelete.set('Llama-3-8B');
      component.deleteConfirmationInput.set('Llama-3-8B');

      expect(component.deleteAllowed()).toBe(true);
    });

    it('deleteAllowed is false when confirmation does not match', () => {
      initWithGroupResponse(buildGroupResponse('Llama-3', []));
      component.modelToDelete.set('Llama-3-8B');
      component.deleteConfirmationInput.set('wrong-name');

      expect(component.deleteAllowed()).toBe(false);
    });
  });

  describe('delete all members', () => {
    it('deleteAllAllowed requires group name confirmation', () => {
      initWithGroupResponse(buildGroupResponse('Llama-3', []));
      component.groupName.set('Llama-3');
      component.deleteAllVariantsConfirmation.set('Llama-3');

      expect(component.deleteAllAllowed()).toBe(true);
    });

    it('deleteAllAllowed is false with wrong confirmation', () => {
      initWithGroupResponse(buildGroupResponse('Llama-3', []));
      component.groupName.set('Llama-3');
      component.deleteAllVariantsConfirmation.set('wrong');

      expect(component.deleteAllAllowed()).toBe(false);
    });

    it('confirmDeleteAll sets deletingAll flag', () => {
      initWithGroupResponse(buildGroupResponse('Llama-3', []));
      component.confirmDeleteAll();
      expect(component.deletingAll()).toBe(true);
    });

    it('cancelDeleteAll clears state', () => {
      initWithGroupResponse(buildGroupResponse('Llama-3', []));
      component.deletingAll.set(true);
      component.deleteAllVariantsConfirmation.set('some-text');

      component.cancelDeleteAll();

      expect(component.deletingAll()).toBe(false);
      expect(component.deleteAllVariantsConfirmation()).toBe('');
    });
  });
});
