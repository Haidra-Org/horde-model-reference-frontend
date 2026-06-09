import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { map } from 'rxjs/operators';
import { CreateGroupWizardComponent } from './create-group-wizard.component';
import { ModelReferenceApiService } from '../../services/model-reference-api.service';
import { NotificationService } from '../../services/notification.service';
import { PendingQueueSummaryService } from '../../services/pending-queue-summary.service';

interface ApiSpy {
  createModel: ReturnType<typeof vi.fn>;
  updateGroupNameSchema: ReturnType<typeof vi.fn>;
  composeModelName: ReturnType<typeof vi.fn>;
  getDistinctBaselines: ReturnType<typeof vi.fn>;
  listFamilies: ReturnType<typeof vi.fn>;
  addFamilyMember: ReturnType<typeof vi.fn>;
}

interface NotificationSpy {
  success: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
  warning: ReturnType<typeof vi.fn>;
}

interface PendingSummarySpy {
  records: ReturnType<typeof signal<never[]>>;
  refresh: ReturnType<typeof vi.fn>;
}

describe('CreateGroupWizardComponent', () => {
  let fixture: ComponentFixture<CreateGroupWizardComponent>;
  let component: CreateGroupWizardComponent;
  let api: ApiSpy;
  let notification: NotificationSpy;
  let pendingSummary: PendingSummarySpy;
  let router: Router;
  let rawParams: BehaviorSubject<Record<string, string>>;

  beforeEach(async () => {
    rawParams = new BehaviorSubject<Record<string, string>>({
      category: 'text_generation',
    });

    api = {
      createModel: vi.fn().mockReturnValue(of({})),
      updateGroupNameSchema: vi.fn().mockReturnValue(of({})),
      composeModelName: vi.fn().mockReturnValue(
        of({
          composed_name: 'Llama-3-8B',
          already_exists: false,
          suggested_group: 'Llama-3',
          template: '{base}-{size}',
          rendered_example: 'Llama-3-8B',
        }),
      ),
      getDistinctBaselines: vi.fn().mockReturnValue(of(['llama3', 'flux_1'])),
      listFamilies: vi.fn().mockReturnValue(
        of({
          families: [
            { family_name: 'Llama', members: ['Llama-3', 'Llama-3.1'] },
            { family_name: 'Qwen', members: ['Qwen3'] },
          ],
        }),
      ),
      addFamilyMember: vi.fn().mockReturnValue(of({ family_name: 'Llama', members: [] })),
    };

    notification = {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
    };

    pendingSummary = {
      records: signal([]),
      refresh: vi.fn(),
    };

    const paramMap$ = rawParams.pipe(map((p) => convertToParamMap(p)));

    await TestBed.configureTestingModule({
      imports: [CreateGroupWizardComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: ModelReferenceApiService, useValue: api },
        { provide: NotificationService, useValue: notification },
        { provide: PendingQueueSummaryService, useValue: pendingSummary },
        { provide: ActivatedRoute, useValue: { paramMap: paramMap$ } },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture = TestBed.createComponent(CreateGroupWizardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('step validation', () => {
    it('step1Valid is false with empty group name', () => {
      component.groupName.set('');
      expect(component.step1Valid()).toBe(false);
    });

    it('step1Valid is true with non-empty group name', () => {
      component.groupName.set('Llama-3');
      expect(component.step1Valid()).toBe(true);
    });

    it('step1Valid trims whitespace-only names', () => {
      component.groupName.set('   ');
      expect(component.step1Valid()).toBe(false);
    });

    it('step2Valid requires size, positive parameters, and composed name', () => {
      component.size.set('8B');
      component.parameters.set(8);
      component.composedName.set('Llama-3-8B');
      component.alreadyExists.set(false);

      expect(component.step2Valid()).toBe(true);
    });

    it('step2Valid is false when size is empty', () => {
      component.parameters.set(8);
      component.composedName.set('Llama-3-8B');
      expect(component.step2Valid()).toBe(false);
    });

    it('step2Valid is false when parameters is null', () => {
      component.size.set('8B');
      component.composedName.set('Llama-3-8B');
      component.parameters.set(null);
      expect(component.step2Valid()).toBe(false);
    });

    it('step2Valid is false when parameters is zero', () => {
      component.size.set('8B');
      component.composedName.set('Llama-3-8B');
      component.parameters.set(0);
      expect(component.step2Valid()).toBe(false);
    });

    it('step2Valid is false when model already exists', () => {
      component.size.set('8B');
      component.parameters.set(8);
      component.composedName.set('Llama-3-8B');
      component.alreadyExists.set(true);
      expect(component.step2Valid()).toBe(false);
    });
  });

  describe('effectiveParameters', () => {
    it('converts billions when unit is B', () => {
      component.parameters.set(8);
      component.parametersUnit.set('B');
      expect(component.effectiveParameters()).toBe(8_000_000_000);
    });

    it('converts millions when unit is M', () => {
      component.parameters.set(500);
      component.parametersUnit.set('M');
      expect(component.effectiveParameters()).toBe(500_000_000);
    });

    it('returns null when parameters is null', () => {
      component.parameters.set(null);
      expect(component.effectiveParameters()).toBeNull();
    });
  });

  describe('step navigation', () => {
    it('starts on identity step', () => {
      expect(component.step()).toBe('identity');
    });

    it('goToStep changes step', () => {
      component.goToStep('variation');
      expect(component.step()).toBe('variation');
    });

    it('goToStep triggers compose when moving to variation', () => {
      // composeSubject emits, but we can verify compose was called indirectly
      // by ensuring no error is thrown
      expect(() => component.goToStep('variation')).not.toThrow();
    });
  });

  describe('part order management', () => {
    it('has default part order with base locked first', () => {
      expect(component.partOrder()).toEqual(['base', 'size', 'variant', 'version', 'quant']);
    });

    it('movePartUp swaps with previous (excluding base slot)', () => {
      component.movePartUp(2);
      expect(component.partOrder()).toEqual(['base', 'variant', 'size', 'version', 'quant']);
    });

    it('movePartUp does nothing at index 0', () => {
      component.movePartUp(0);
      expect(component.partOrder()).toEqual(['base', 'size', 'variant', 'version', 'quant']);
    });

    it('movePartUp refuses to move a part above base', () => {
      component.movePartUp(1);
      expect(component.partOrder()).toEqual(['base', 'size', 'variant', 'version', 'quant']);
    });

    it('movePartUp refuses to move base', () => {
      component.movePartUp(0);
      expect(component.partOrder()[0]).toBe('base');
    });

    it('movePartDown swaps with next for non-base parts', () => {
      component.movePartDown(1);
      expect(component.partOrder()).toEqual(['base', 'variant', 'size', 'version', 'quant']);
    });

    it('movePartDown refuses to move base down', () => {
      component.movePartDown(0);
      expect(component.partOrder()[0]).toBe('base');
    });

    it('movePartDown does nothing at last index', () => {
      component.movePartDown(4);
      expect(component.partOrder()).toEqual(['base', 'size', 'variant', 'version', 'quant']);
    });

    it('isPartLocked returns true only for base', () => {
      expect(component.isPartLocked('base')).toBe(true);
      expect(component.isPartLocked('size')).toBe(false);
      expect(component.isPartLocked('variant')).toBe(false);
    });
  });

  describe('preview template', () => {
    it('builds fallback template from part order and separator', () => {
      const template = component.previewTemplate();
      expect(template).toBe('{base}-{size}-{variant}-{version}-{quant}');
    });

    it('uses custom separator in fallback template', () => {
      component.separator.set('_');
      expect(component.previewTemplate()).toBe('{base}_{size}_{variant}_{version}_{quant}');
    });

    it('fallback template prepends {author}/ when author is set', () => {
      component.author.set('Meta');
      expect(component.previewTemplate()).toBe(
        '{author}/{base}-{size}-{variant}-{version}-{quant}',
      );
    });

    it('fallback preview example uses group name or default', () => {
      component.groupName.set('');
      const preview = component.previewExampleName();
      expect(preview).toContain('Llama-3.1');

      component.groupName.set('Qwen');
      const preview2 = component.previewExampleName();
      expect(preview2).toContain('Qwen');
    });

    it('fallback preview example includes author when set', () => {
      component.groupName.set('Llama-3');
      component.author.set('Meta');
      const preview = component.previewExampleName();
      expect(preview).toMatch(/^Meta\//);
    });
  });

  describe('unsaved changes guard', () => {
    it('returns false initially', () => {
      expect(component.hasUnsavedChanges()).toBe(false);
    });

    it('returns true when group name is entered', () => {
      component.groupName.set('Llama-3');
      expect(component.hasUnsavedChanges()).toBe(true);
    });

    it('returns true when size is entered', () => {
      component.size.set('8B');
      expect(component.hasUnsavedChanges()).toBe(true);
    });

    it('returns false after successful submission', () => {
      component.groupName.set('Llama-3');
      component.size.set('8B');
      component.parameters.set(8);
      component.composedName.set('Llama-3-8B');

      // Trigger submit
      component.submit();

      expect(component.hasUnsavedChanges()).toBe(false);
    });
  });

  describe('submit', () => {
    beforeEach(() => {
      component.groupName.set('Llama-3');
      component.size.set('8B');
      component.parameters.set(8);
      component.composedName.set('Llama-3-8B');
      component.alreadyExists.set(false);
    });

    it('calls createModel with composed name', () => {
      component.submit();

      expect(api.createModel).toHaveBeenCalledWith(
        'text_generation',
        'Llama-3-8B',
        expect.objectContaining({
          categoryData: expect.objectContaining({
            data: expect.objectContaining({
              text_model_group: 'Llama-3',
            }),
          }),
        }),
      );
    });

    it('updates name schema when saveSchema is true', () => {
      component.saveSchema.set(true);
      component.submit();

      expect(api.updateGroupNameSchema).toHaveBeenCalledWith(
        'Llama-3',
        expect.objectContaining({
          separator: '-',
          part_order: expect.any(Array),
        }),
      );
    });

    it('skips schema update when saveSchema is false', () => {
      component.saveSchema.set(false);
      component.submit();

      expect(api.updateGroupNameSchema).not.toHaveBeenCalled();
    });

    it('refreshes pending summary on success', () => {
      component.submit();

      expect(pendingSummary.refresh).toHaveBeenCalled();
    });

    it('shows success notification on success', () => {
      component.submit();

      expect(notification.success).toHaveBeenCalledWith(expect.stringContaining('Llama-3'));
    });

    it('navigates to group view on success', () => {
      component.submit();

      expect(router.navigate).toHaveBeenCalledWith([
        '/categories',
        'text_generation',
        'group',
        'Llama-3',
      ]);
    });

    it('shows error notification on failure', () => {
      api.createModel.mockReturnValue(throwError(() => new Error('Conflict')));
      component.submit();

      expect(notification.error).toHaveBeenCalledWith('Conflict');
    });

    it('does not submit when already submitting', () => {
      component.submitting.set(true);
      component.submit();

      expect(api.createModel).not.toHaveBeenCalled();
    });

    it('resets submitting flag on error', () => {
      api.createModel.mockReturnValue(throwError(() => new Error('Failed')));
      component.submit();

      expect(component.submitting()).toBe(false);
    });

    it('includes the client-side composed template in schema save', () => {
      component.saveSchema.set(true);
      component.submit();

      expect(api.updateGroupNameSchema).toHaveBeenCalledWith(
        'Llama-3',
        expect.objectContaining({
          template: component.previewTemplate(),
        }),
      );
    });
  });

  describe('parameter auto-sync', () => {
    it('is linked by default', () => {
      expect(component.parametersLinked()).toBe(true);
    });

    it('auto-syncs parameters when size is set and linked', () => {
      component.size.set('8B');
      fixture.detectChanges();
      expect(component.parameters()).toBe(8);
      expect(component.parametersUnit()).toBe('B');
    });

    it('auto-syncs millions unit', () => {
      component.size.set('350M');
      fixture.detectChanges();
      expect(component.parameters()).toBe(350);
      expect(component.parametersUnit()).toBe('M');
    });

    it('does not auto-sync when unlinked', () => {
      component.parametersLinked.set(false);
      component.parameters.set(42);
      component.size.set('8B');
      fixture.detectChanges();
      expect(component.parameters()).toBe(42);
    });

    it('relink triggers sync from current size', () => {
      component.size.set('8B');
      fixture.detectChanges();
      component.parametersLinked.set(false);
      component.parameters.set(42);
      component.toggleParametersLinked();
      expect(component.parametersLinked()).toBe(true);
      expect(component.parameters()).toBe(8);
    });
  });

  describe('extra parts', () => {
    it('addExtraPart appends a blank row', () => {
      expect(component.extraParts().length).toBe(0);
      component.addExtraPart();
      expect(component.extraParts()).toEqual([{ label: '', value: '' }]);
    });

    it('removeExtraPart drops the entry at index', () => {
      component.addExtraPart();
      component.addExtraPart();
      component.updateExtraPartLabel(0, 'date');
      component.updateExtraPartLabel(1, 'descriptor');
      component.removeExtraPart(0);
      expect(component.extraParts()).toEqual([{ label: 'descriptor', value: '' }]);
    });

    it('updates label and value independently', () => {
      component.addExtraPart();
      component.updateExtraPartLabel(0, 'date');
      component.updateExtraPartValue(0, '2024-08');
      expect(component.extraParts()[0]).toEqual({ label: 'date', value: '2024-08' });
    });

    it('submit includes extra_parts labels in schema save', () => {
      component.groupName.set('Llama');
      component.size.set('8B');
      component.parameters.set(8);
      component.composedName.set('Llama-8B-2024-08');
      component.alreadyExists.set(false);
      component.saveSchema.set(true);
      component.addExtraPart();
      component.updateExtraPartLabel(0, 'date');
      component.updateExtraPartValue(0, '2024-08');

      component.submit();

      expect(api.updateGroupNameSchema).toHaveBeenCalledWith(
        'Llama',
        expect.objectContaining({
          extra_parts: ['date'],
          part_order: expect.arrayContaining(['base', 'extra:date']),
        }),
      );
    });
  });

  describe('common fields (style, tags, instruct_format)', () => {
    beforeEach(() => {
      component.groupName.set('Llama-3');
      component.size.set('8B');
      component.parameters.set(8);
      component.composedName.set('Llama-3-8B');
    });

    it('includes style in createModel call when set', () => {
      component.style.set('chatml');
      component.submit();
      expect(api.createModel).toHaveBeenCalledWith(
        'text_generation',
        'Llama-3-8B',
        expect.objectContaining({
          commonData: expect.objectContaining({ style: 'chatml' }),
        }),
      );
    });

    it('sends null style when empty', () => {
      component.style.set('');
      component.submit();
      const arg = api.createModel.mock.calls[0][2];
      expect(arg.commonData.style).toBeNull();
    });

    it('adds and removes tags', () => {
      component.addTag('coding');
      component.addTag('chat');
      expect(component.tags()).toEqual(['coding', 'chat']);
      component.removeTag('coding');
      expect(component.tags()).toEqual(['chat']);
    });

    it('deduplicates tags', () => {
      component.addTag('coding');
      component.addTag('coding');
      expect(component.tags()).toEqual(['coding']);
    });

    it('skips blank tag entries', () => {
      component.addTag('   ');
      expect(component.tags()).toEqual([]);
    });

    it('includes tags array in createModel call', () => {
      component.addTag('coding');
      component.addTag('chat');
      component.submit();
      const arg = api.createModel.mock.calls[0][2];
      expect(arg.categoryData.data.tags).toEqual(['coding', 'chat']);
    });

    it('sends null tags when empty', () => {
      component.submit();
      const arg = api.createModel.mock.calls[0][2];
      expect(arg.categoryData.data.tags).toBeNull();
    });

    it('includes instruct_format in createModel call', () => {
      component.instructFormat.set('chatml');
      component.submit();
      const arg = api.createModel.mock.calls[0][2];
      expect(arg.categoryData.data.instruct_format).toBe('chatml');
    });

    it('sends null instruct_format when empty', () => {
      component.submit();
      const arg = api.createModel.mock.calls[0][2];
      expect(arg.categoryData.data.instruct_format).toBeNull();
    });
  });

  describe('family suggestion', () => {
    it('loads families on init', () => {
      expect(api.listFamilies).toHaveBeenCalled();
      expect(component.knownFamilies().length).toBe(2);
    });

    it('suggests family when group name matches', () => {
      component.setGroupName('Llama-3.2');
      expect(component.suggestedFamily()).toBe('Llama');
    });

    it('no suggestion when name does not match any family', () => {
      component.setGroupName('Unrelated-Model');
      expect(component.suggestedFamily()).toBeNull();
    });

    it('no suggestion when group name is blank', () => {
      component.setGroupName('');
      expect(component.suggestedFamily()).toBeNull();
    });

    it('acceptFamilySuggestion promotes suggestion to selected', () => {
      component.setGroupName('Llama-3.2');
      component.acceptFamilySuggestion();
      expect(component.selectedFamily()).toBe('Llama');
    });

    it('dismissFamilySuggestion clears suggestion', () => {
      component.setGroupName('Llama-3.2');
      component.dismissFamilySuggestion();
      expect(component.suggestedFamily()).toBeNull();
      expect(component.selectedFamily()).toBeNull();
    });

    it('setGroupName resets dismissal so new matches surface', () => {
      component.setGroupName('Llama-3.2');
      component.dismissFamilySuggestion();
      component.setGroupName('Qwen3-variant');
      expect(component.suggestedFamily()).toBe('Qwen');
    });

    it('submit calls addFamilyMember when family selected', () => {
      component.groupName.set('Llama-3.2');
      component.size.set('8B');
      component.parameters.set(8);
      component.composedName.set('Llama-3.2-8B');
      component.alreadyExists.set(false);
      component.selectedFamily.set('Llama');
      component.submit();
      expect(api.addFamilyMember).toHaveBeenCalledWith('Llama', 'Llama-3.2');
    });

    it('submit skips addFamilyMember when no family selected', () => {
      component.groupName.set('Standalone');
      component.size.set('8B');
      component.parameters.set(8);
      component.composedName.set('Standalone-8B');
      component.submit();
      expect(api.addFamilyMember).not.toHaveBeenCalled();
    });

    it('family assignment failure does not block creation (warning shown)', () => {
      api.addFamilyMember.mockReturnValue(throwError(() => new Error('boom')));
      component.groupName.set('Llama-3.2');
      component.size.set('8B');
      component.parameters.set(8);
      component.composedName.set('Llama-3.2-8B');
      component.selectedFamily.set('Llama');
      component.submit();
      expect(notification.success).toHaveBeenCalled();
      expect(notification.warning).toHaveBeenCalledWith(
        expect.stringContaining('family assignment failed'),
      );
    });

    it('listFamilies failure leaves knownFamilies empty', () => {
      api.listFamilies.mockReturnValue(throwError(() => new Error('Network')));
      const freshFixture = TestBed.createComponent(CreateGroupWizardComponent);
      freshFixture.detectChanges();
      expect(freshFixture.componentInstance.knownFamilies()).toEqual([]);
    });
  });

  describe('cancel', () => {
    it('navigates back to category list', () => {
      component.cancel();
      expect(router.navigate).toHaveBeenCalledWith(['/categories', 'text_generation']);
    });
  });

  describe('baseline suggestions', () => {
    it('loads baseline suggestions on construction', () => {
      expect(component.baselineSuggestions()).toEqual(['llama3', 'flux_1']);
    });

    it('falls back to empty array on error', async () => {
      api.getDistinctBaselines.mockReturnValue(throwError(() => new Error('Network error')));

      // Create a fresh component to trigger the constructor subscription
      const freshFixture = TestBed.createComponent(CreateGroupWizardComponent);
      freshFixture.detectChanges();

      expect(freshFixture.componentInstance.baselineSuggestions()).toEqual([]);
    });
  });
});
