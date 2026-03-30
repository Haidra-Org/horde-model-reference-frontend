import { ComponentFixture, TestBed } from '@angular/core/testing';
import { computed, provideZonelessChangeDetection, signal, WritableSignal } from '@angular/core';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { TextModelGroupComponent } from './text-model-group.component';
import { ModelReferenceApiService } from '../../services/model-reference-api.service';
import { NotificationService } from '../../services/notification.service';
import { AuthService } from '../../services/auth.service';

interface ApiServiceSpy {
  backendCapabilities: ReturnType<typeof signal>;
  getLegacyModelsInCategory: ReturnType<typeof vi.fn>;
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

function buildTextGenResponse(
  models: Record<
    string,
    {
      text_model_group: string;
      parameters?: number;
      baseline?: string;
      nsfw?: boolean;
      description?: string;
      tags?: string[];
      style?: string;
      display_name?: string;
    }
  >,
): Record<string, Record<string, unknown>> {
  const response: Record<string, Record<string, unknown>> = {};
  for (const [key, data] of Object.entries(models)) {
    response[key] = { name: key, ...data };
  }
  return response;
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
      getLegacyModelsInCategory: vi.fn().mockReturnValue(of({})),
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

  function initWithResponse(response: Record<string, Record<string, unknown>>): void {
    api.getLegacyModelsInCategory.mockReturnValue(of(response));
    fixture = TestBed.createComponent(TextModelGroupComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  describe('group member extraction', () => {
    it('filters models matching the target group name', () => {
      const response = buildTextGenResponse({
        'Llama-3-8B-Instruct': { text_model_group: 'Llama-3', parameters: 8_000_000_000 },
        'Llama-3-1B-Instruct': { text_model_group: 'Llama-3', parameters: 1_000_000_000 },
        'Mistral-7B': { text_model_group: 'Mistral', parameters: 7_000_000_000 },
      });

      initWithResponse(response);

      expect(component.members().length).toBe(2);
      expect(component.members().map((m) => m.recordKey)).toEqual([
        'Llama-3-1B-Instruct',
        'Llama-3-8B-Instruct',
      ]);
    });

    it('separates canonical members from backend duplicates', () => {
      const response = buildTextGenResponse({
        'Llama-3-8B-Instruct': { text_model_group: 'Llama-3', parameters: 8_000_000_000 },
        'aphrodite/Llama-3-8B-Instruct': { text_model_group: 'Llama-3', parameters: 8_000_000_000 },
        'koboldcpp/Llama-3-8B-Instruct': { text_model_group: 'Llama-3', parameters: 8_000_000_000 },
      });

      initWithResponse(response);

      expect(component.canonicalMembers().length).toBe(1);
      expect(component.canonicalMembers()[0].recordKey).toBe('Llama-3-8B-Instruct');

      expect(component.backendDuplicates().length).toBe(2);
      expect(component.backendDuplicates().map((m) => m.backendPrefix)).toEqual(
        expect.arrayContaining(['aphrodite', 'koboldcpp']),
      );
    });

    it('sorts canonical members before backend duplicates', () => {
      const response = buildTextGenResponse({
        'aphrodite/Llama-3-8B-Instruct': { text_model_group: 'Llama-3' },
        'Llama-3-8B-Instruct': { text_model_group: 'Llama-3' },
        'koboldcpp/Llama-3-8B-Instruct': { text_model_group: 'Llama-3' },
      });

      initWithResponse(response);

      const allMembers = component.members();
      const firstCanonicalIndex = allMembers.findIndex((m) => !m.isBackendDuplicate);
      const firstDuplicateIndex = allMembers.findIndex((m) => m.isBackendDuplicate);
      expect(firstCanonicalIndex).toBeLessThan(firstDuplicateIndex);
    });

    it('returns empty members when no models match the group', () => {
      const response = buildTextGenResponse({
        'Mistral-7B': { text_model_group: 'Mistral', parameters: 7_000_000_000 },
      });

      initWithResponse(response);

      expect(component.members().length).toBe(0);
      expect(notification.error).toHaveBeenCalledWith(expect.stringContaining('No models found'));
    });
  });

  describe('parameter summary', () => {
    it('computes unique parameter sizes from canonical members', () => {
      const response = buildTextGenResponse({
        'Llama-3-8B-Instruct': { text_model_group: 'Llama-3', parameters: 8_000_000_000 },
        'Llama-3-1B-Instruct': { text_model_group: 'Llama-3', parameters: 1_000_000_000 },
        'Llama-3-70B-Instruct': { text_model_group: 'Llama-3', parameters: 70_000_000_000 },
        'aphrodite/Llama-3-8B-Instruct': { text_model_group: 'Llama-3', parameters: 8_000_000_000 },
      });

      initWithResponse(response);

      // canonical members: 1B, 8B, 70B (aphrodite duplicate excluded)
      const summary = component.parameterSummary();
      expect(summary).toEqual(['1B', '8B', '70B']);
    });

    it('returns null when no parameters are present', () => {
      const response = buildTextGenResponse({
        'Llama-3-Instruct': { text_model_group: 'Llama-3' },
      });

      initWithResponse(response);

      expect(component.parameterSummary()).toBeNull();
    });
  });

  describe('navigation', () => {
    it('navigates to edit route with actual record key', () => {
      const response = buildTextGenResponse({
        'Llama-3-8B-Instruct': { text_model_group: 'Llama-3', parameters: 8_000_000_000 },
      });
      initWithResponse(response);

      const member = component.canonicalMembers()[0];
      component.editMember(member);

      expect(router.navigate).toHaveBeenCalledWith([
        '/categories',
        'text_generation',
        'edit',
        'Llama-3-8B-Instruct',
      ]);
    });

    it('navigates back to model list', () => {
      initWithResponse({});
      component.goBackToList();

      expect(router.navigate).toHaveBeenCalledWith(['/categories', 'text_generation']);
    });
  });

  describe('writable state', () => {
    it('is writable when backend supports writes and user is authenticated', () => {
      initWithResponse({});
      expect(component.writable()).toBe(true);
    });

    it('is not writable when backend does not support writes', () => {
      api.backendCapabilities.set({ writable: false, mode: 'REPLICA', canonicalFormat: 'legacy' });
      initWithResponse({});
      expect(component.writable()).toBe(false);
    });

    it('is not writable when user is not authenticated', () => {
      isAuthenticatedSource.set(false);
      initWithResponse({});
      expect(component.writable()).toBe(false);
    });
  });

  describe('delete single member', () => {
    it('sets modelToDelete on confirmDeleteMember', () => {
      const response = buildTextGenResponse({
        'Llama-3-8B-Instruct': { text_model_group: 'Llama-3' },
      });
      initWithResponse(response);

      const member = component.canonicalMembers()[0];
      component.confirmDeleteMember(member);

      expect(component.modelToDelete()).toBe('Llama-3-8B-Instruct');
    });

    it('clears modelToDelete on cancelDelete', () => {
      initWithResponse({});
      component.modelToDelete.set('some-model');
      component.deleteConfirmationInput.set('some-model');

      component.cancelDelete();

      expect(component.modelToDelete()).toBeNull();
      expect(component.deleteConfirmationInput()).toBe('');
    });

    it('deleteAllowed is true when confirmation matches', () => {
      initWithResponse({});
      component.modelToDelete.set('Llama-3-8B');
      component.deleteConfirmationInput.set('Llama-3-8B');

      expect(component.deleteAllowed()).toBe(true);
    });

    it('deleteAllowed is false when confirmation does not match', () => {
      initWithResponse({});
      component.modelToDelete.set('Llama-3-8B');
      component.deleteConfirmationInput.set('wrong-name');

      expect(component.deleteAllowed()).toBe(false);
    });
  });

  describe('delete all members', () => {
    it('deleteAllAllowed requires group name confirmation', () => {
      initWithResponse({});
      component.groupName.set('Llama-3');
      component.deleteAllVariantsConfirmation.set('Llama-3');

      expect(component.deleteAllAllowed()).toBe(true);
    });

    it('deleteAllAllowed is false with wrong confirmation', () => {
      initWithResponse({});
      component.groupName.set('Llama-3');
      component.deleteAllVariantsConfirmation.set('wrong');

      expect(component.deleteAllAllowed()).toBe(false);
    });

    it('confirmDeleteAll sets deletingAll flag', () => {
      initWithResponse({});
      component.confirmDeleteAll();
      expect(component.deletingAll()).toBe(true);
    });

    it('cancelDeleteAll clears state', () => {
      initWithResponse({});
      component.deletingAll.set(true);
      component.deleteAllVariantsConfirmation.set('some-text');

      component.cancelDeleteAll();

      expect(component.deletingAll()).toBe(false);
      expect(component.deleteAllVariantsConfirmation()).toBe('');
    });
  });
});
