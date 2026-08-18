import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { AddVariationPanelComponent } from './add-variation-panel.component';
import { ModelReferenceApiService } from '../../services/model-reference-api.service';
import { NotificationService } from '../../services/notification.service';
import { PendingQueueSummaryService } from '../../services/pending-queue-summary.service';
import type { GroupMembersResponse, GroupMemberInfo } from '../../api-client';

interface ApiSpy {
  createModel: ReturnType<typeof vi.fn>;
  composeModelName: ReturnType<typeof vi.fn>;
  getDistinctBaselines: ReturnType<typeof vi.fn>;
}

interface NotificationSpy {
  success: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
}

interface PendingSummarySpy {
  records: ReturnType<typeof signal<never[]>>;
  refresh: ReturnType<typeof vi.fn>;
}

function buildMember(name: string, opts: Partial<GroupMemberInfo> = {}): GroupMemberInfo {
  return {
    name,
    parsed: { base_name: name },
    parameters: null,
    baseline: null,
    nsfw: null,
    description: null,
    tags: null,
    style: null,
    display_name: null,
    is_backend_duplicate: false,
    backend_prefix: null,
    ...opts,
  };
}

function buildGroupData(overrides: Partial<GroupMembersResponse> = {}): GroupMembersResponse {
  return {
    group_name: 'Llama-3',
    members: [
      buildMember('Llama-3-1B', {
        parameters: 1_000_000_000,
        parsed: { base_name: 'Llama-3', size: '1B' },
      }),
      buildMember('Llama-3-8B-Instruct', {
        parameters: 8_000_000_000,
        parsed: { base_name: 'Llama-3', size: '8B', variant: 'Instruct' },
      }),
      buildMember('Llama-3-70B', {
        parameters: 70_000_000_000,
        parsed: { base_name: 'Llama-3', size: '70B' },
      }),
    ],
    common_fields: { baseline: 'llama3', nsfw: false },
    available_sizes: ['1B', '8B', '70B'],
    available_variants: ['Instruct', 'Chat', null],
    available_quants: ['Q4_K_M', 'Q5_K_M', null],
    available_versions: ['v1', null],
    name_format: {
      separator: '-',
      part_order: ['size', 'variant', 'version', 'quant'],
      author_included: false,
      template: '{base}-{size}-{variant}-{version}-{quant}',
    },
    canonical_count: 3,
    backend_duplicate_count: 0,
    size_usage: { '8B': 1 },
    variant_usage: { Instruct: 1 },
    quant_usage: { Q4_K_M: 1 },
    ...overrides,
  };
}

describe('AddVariationPanelComponent', () => {
  let fixture: ComponentFixture<AddVariationPanelComponent>;
  let component: AddVariationPanelComponent;
  let api: ApiSpy;
  let notification: NotificationSpy;
  let pendingSummary: PendingSummarySpy;
  let createdEventCount: number;
  let cancelledEventCount: number;
  let dirtyChangeEvents: boolean[];

  beforeEach(async () => {
    api = {
      createModel: vi.fn().mockReturnValue(of({})),
      composeModelName: vi
        .fn()
        .mockReturnValue(of({ composed_name: 'Llama-3-70B-Chat', already_exists: false })),
      getDistinctBaselines: vi.fn().mockReturnValue(of(['llama3', 'flux_1'])),
    };

    notification = {
      success: vi.fn(),
      error: vi.fn(),
    };

    pendingSummary = {
      records: signal([]),
      refresh: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [AddVariationPanelComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ModelReferenceApiService, useValue: api },
        { provide: NotificationService, useValue: notification },
        { provide: PendingQueueSummaryService, useValue: pendingSummary },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AddVariationPanelComponent);
    component = fixture.componentInstance;

    // Set required inputs
    fixture.componentRef.setInput('groupName', 'Llama-3');
    fixture.componentRef.setInput('groupData', buildGroupData());

    // Subscribe to outputs for spying
    createdEventCount = 0;
    cancelledEventCount = 0;
    dirtyChangeEvents = [];
    component.created.subscribe(() => {
      createdEventCount += 1;
    });
    component.cancelled.subscribe(() => {
      cancelledEventCount += 1;
    });
    component.dirtyChange.subscribe((value) => {
      dirtyChangeEvents.push(value);
    });

    fixture.detectChanges();
  });

  describe('initialization', () => {
    it('populates common fields from group data', () => {
      expect(component.baseline()).toBe('llama3');
      expect(component.nsfw()).toBe(false);
    });

    it('makes available sizes from group data accessible', () => {
      expect(component.availableSizes()).toEqual(['1B', '8B', '70B']);
    });

    it('filters null entries from available variants', () => {
      expect(component.availableVariants()).toEqual(['Instruct', 'Chat']);
    });

    it('filters null entries from available quants', () => {
      expect(component.availableQuants()).toEqual(['Q4_K_M', 'Q5_K_M']);
    });

    it('loads baseline suggestions', () => {
      expect(component.baselineSuggestions()).toEqual(['llama3', 'flux_1']);
    });
  });

  describe('readiness checks', () => {
    it('starts with no readiness items complete', () => {
      expect(component.canSubmit()).toBe(false);
    });

    it('reports incomplete readiness items', () => {
      const items = component.readinessItems();
      expect(items.find((i) => i.key === 'size')?.ready).toBe(false);
    });

    it('canSubmit is true when all requirements met', () => {
      component.size.set('70B');
      component.parameters.set(70);
      component.composedName.set('Llama-3-70B-Chat');
      component.alreadyExists.set(false);
      component.submitting.set(false);

      expect(component.canSubmit()).toBe(true);
    });

    it('canSubmit is false while submitting', () => {
      component.size.set('70B');
      component.parameters.set(70);
      component.composedName.set('Llama-3-70B-Chat');
      component.submitting.set(true);

      expect(component.canSubmit()).toBe(false);
    });

    it('canSubmit is false when model already exists', () => {
      component.size.set('70B');
      component.parameters.set(70);
      component.composedName.set('Llama-3-70B-Chat');
      component.alreadyExists.set(true);

      expect(component.canSubmit()).toBe(false);
    });
  });

  describe('dirty tracking', () => {
    it('is not dirty initially', () => {
      expect(component.isDirty()).toBe(false);
    });

    it('becomes dirty when a field changes', () => {
      component.setSize('70B');
      expect(component.isDirty()).toBe(true);
    });

    it('returns to clean when field is restored', () => {
      const originalSize = component.size();
      component.setSize('70B');
      expect(component.isDirty()).toBe(true);

      component.setSize(originalSize);
      expect(component.isDirty()).toBe(false);
    });
  });

  describe('field setters', () => {
    it('setSize trims whitespace', () => {
      component.setSize('  70B  ');
      expect(component.size()).toBe('70B');
    });

    it('setSize handles null', () => {
      component.setSize(null);
      expect(component.size()).toBe('');
    });

    it('setVariant trims whitespace', () => {
      component.setVariant('  Chat  ');
      expect(component.variant()).toBe('Chat');
    });

    it('setQuant handles null', () => {
      component.setQuant(null);
      expect(component.quant()).toBe('');
    });
  });

  describe('parameter sync', () => {
    it('syncs parameters from size when linked', () => {
      component.parametersLinked.set(true);
      component.setSize('70B');
      expect(component.parameters()).toBe(70);
      expect(component.parametersUnit()).toBe('B');
    });

    it('syncs parameters for M unit', () => {
      component.parametersLinked.set(true);
      component.setSize('500M');
      expect(component.parameters()).toBe(500);
      expect(component.parametersUnit()).toBe('M');
    });

    it('does not sync when unlinked', () => {
      component.parametersLinked.set(false);
      component.parameters.set(8);
      component.setSize('70B');
      expect(component.parameters()).toBe(8);
    });

    it('toggleParameterSync re-syncs on link', () => {
      component.parametersLinked.set(false);
      component.size.set('70B');
      component.parameters.set(8);

      component.toggleParameterSync();

      expect(component.parametersLinked()).toBe(true);
      expect(component.parameters()).toBe(70);
    });

    it('clears parameters for unparseable size', () => {
      component.parametersLinked.set(true);
      component.setSize('???');
      expect(component.parameters()).toBeNull();
    });
  });

  describe('usage annotations', () => {
    it('annotates sizes with usage count', () => {
      const annotations = component.sizeAnnotations();
      expect(annotations['8B']).toBe('1 variation');
    });

    it('does not annotate sizes with zero usage', () => {
      const annotations = component.sizeAnnotations();
      expect(annotations['1B']).toBeUndefined();
    });

    it('pluralizes correctly for multiple variations', () => {
      fixture.componentRef.setInput(
        'groupData',
        buildGroupData({
          size_usage: { '8B': 3 },
        }),
      );
      fixture.detectChanges();

      const annotations = component.sizeAnnotations();
      expect(annotations['8B']).toBe('3 variations');
    });
  });

  describe('submit', () => {
    beforeEach(() => {
      component.size.set('70B');
      component.parameters.set(70);
      component.parametersUnit.set('B');
      component.composedName.set('Llama-3-70B-Chat');
      component.alreadyExists.set(false);
    });

    it('calls createModel with correct parameters', () => {
      component.submit();

      expect(api.createModel).toHaveBeenCalledWith(
        'text_generation',
        'Llama-3-70B-Chat',
        expect.objectContaining({
          categoryData: expect.objectContaining({
            data: expect.objectContaining({
              parameters: 70_000_000_000,
              text_model_group: 'Llama-3',
            }),
          }),
        }),
      );
    });

    it('refreshes pending summary on success', () => {
      component.submit();
      expect(pendingSummary.refresh).toHaveBeenCalled();
    });

    it('emits created event on success', () => {
      component.submit();
      expect(createdEventCount).toBe(1);
    });

    it('shows success notification', () => {
      component.submit();
      expect(notification.success).toHaveBeenCalledWith(
        expect.stringContaining('Llama-3-70B-Chat'),
      );
    });

    it('resets dirty state after success', () => {
      component.setSize('70B');
      expect(component.isDirty()).toBe(true);

      component.submit();
      expect(component.isDirty()).toBe(false);
    });

    it('shows error notification on failure', () => {
      api.createModel.mockReturnValue(throwError(() => new Error('Duplicate model')));
      component.submit();

      expect(notification.error).toHaveBeenCalledWith('Duplicate model');
      expect(component.submitting()).toBe(false);
    });

    it('does not submit when canSubmit is false', () => {
      component.size.set('');
      component.submit();
      expect(api.createModel).not.toHaveBeenCalled();
    });

    it('does not submit when parameters is null', () => {
      component.parameters.set(null);
      component.submit();
      expect(api.createModel).not.toHaveBeenCalled();
    });

    it('converts M parameters correctly', () => {
      component.parameters.set(500);
      component.parametersUnit.set('M');
      component.submit();

      expect(api.createModel).toHaveBeenCalledWith(
        'text_generation',
        'Llama-3-70B-Chat',
        expect.objectContaining({
          categoryData: expect.objectContaining({
            data: expect.objectContaining({
              parameters: 500_000_000,
            }),
          }),
        }),
      );
    });
  });

  describe('cancel', () => {
    it('emits cancelled event', () => {
      component.cancel();
      expect(cancelledEventCount).toBe(1);
    });
  });

  describe('author inference', () => {
    it('uses common_author from name format when available', () => {
      fixture.componentRef.setInput(
        'groupData',
        buildGroupData({
          name_format: {
            separator: '-',
            part_order: ['size'],
            author_included: true,
            template: '{author}/{base}-{size}',
            common_author: 'Meta',
          },
        }),
      );
      fixture.detectChanges();

      // Re-init to trigger ngOnInit
      const freshFixture = TestBed.createComponent(AddVariationPanelComponent);
      freshFixture.componentRef.setInput('groupName', 'Llama-3');
      freshFixture.componentRef.setInput(
        'groupData',
        buildGroupData({
          name_format: {
            separator: '-',
            part_order: ['size'],
            author_included: true,
            template: '{author}/{base}-{size}',
            common_author: 'Meta',
          },
        }),
      );
      freshFixture.detectChanges();

      expect(freshFixture.componentInstance.author()).toBe('Meta');
    });

    it('infers author from member names when no common_author', () => {
      const freshFixture = TestBed.createComponent(AddVariationPanelComponent);
      freshFixture.componentRef.setInput('groupName', 'Llama-3');
      freshFixture.componentRef.setInput(
        'groupData',
        buildGroupData({
          members: [buildMember('Meta/Llama-3-8B'), buildMember('Meta/Llama-3-70B')],
        }),
      );
      freshFixture.detectChanges();

      expect(freshFixture.componentInstance.author()).toBe('Meta');
    });

    it('does not infer author when members have different authors', () => {
      const freshFixture = TestBed.createComponent(AddVariationPanelComponent);
      freshFixture.componentRef.setInput('groupName', 'Llama-3');
      freshFixture.componentRef.setInput(
        'groupData',
        buildGroupData({
          members: [buildMember('Meta/Llama-3-8B'), buildMember('OtherOrg/Llama-3-70B')],
        }),
      );
      freshFixture.detectChanges();

      expect(freshFixture.componentInstance.author()).toBe('');
    });
  });
});
