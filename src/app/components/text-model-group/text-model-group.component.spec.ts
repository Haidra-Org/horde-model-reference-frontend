import { ComponentFixture, TestBed } from '@angular/core/testing';
import { computed, provideZonelessChangeDetection, signal, WritableSignal } from '@angular/core';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { map } from 'rxjs/operators';
import { TextModelGroupComponent } from './text-model-group.component';
import { ModelReferenceApiService } from '../../services/model-reference-api.service';
import { NotificationService } from '../../services/notification.service';
import { AuthService } from '../../services/auth.service';
import { PendingQueueSummaryService } from '../../services/pending-queue-summary.service';
import { GroupMembersResponse, GroupMemberInfo, PendingChangeRecord } from '../../api-client';

interface ApiServiceSpy {
  backendCapabilities: ReturnType<typeof signal>;
  getGroupMembers: ReturnType<typeof vi.fn>;
  getAlias: ReturnType<typeof vi.fn>;
  deleteModel: ReturnType<typeof vi.fn>;
  updateGroupCommonFields: ReturnType<typeof vi.fn>;
}

interface NotificationSpy {
  error: ReturnType<typeof vi.fn>;
  success: ReturnType<typeof vi.fn>;
  warning: ReturnType<typeof vi.fn>;
}

interface AuthSpy {
  isAuthenticated: ReturnType<typeof computed>;
  isRequestor: ReturnType<typeof computed>;
  isApprover: ReturnType<typeof computed>;
  isLicenseEditor: ReturnType<typeof computed>;
}

interface PendingSummarySpy {
  records: WritableSignal<PendingChangeRecord[]>;
  refresh: ReturnType<typeof vi.fn>;
}

function buildPendingRecord(
  overrides: Partial<PendingChangeRecord> & Pick<PendingChangeRecord, 'model_name' | 'operation'>,
): PendingChangeRecord {
  return {
    change_id: 1,
    category: 'text_generation' as PendingChangeRecord['category'],
    requested_by: 'user-123',
    requested_username: 'TestUser',
    status: 'pending' as PendingChangeRecord['status'],
    ...overrides,
  };
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
    size?: string | null;
    variant?: string | null;
  } = {},
): GroupMemberInfo {
  return {
    name,
    parsed: {
      base_name: 'Llama-3',
      size: opts.size ?? null,
      variant: opts.variant ?? null,
    },
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
  overrides: Partial<GroupMembersResponse> = {},
): GroupMembersResponse {
  return {
    group_name: groupName,
    members,
    common_fields: {},
    available_sizes: [],
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
    size_usage: {},
    variant_usage: {},
    quant_usage: {},
    ...overrides,
  };
}

describe('TextModelGroupComponent', () => {
  let fixture: ComponentFixture<TextModelGroupComponent>;
  let component: TextModelGroupComponent;
  let api: ApiServiceSpy;
  let notification: NotificationSpy;
  let auth: AuthSpy;
  let pendingSummary: PendingSummarySpy;
  let isAuthenticatedSource: WritableSignal<boolean>;
  let isRequestorSource: WritableSignal<boolean>;
  let router: Router;
  let rawParams: BehaviorSubject<Record<string, string>>;

  beforeEach(async () => {
    rawParams = new BehaviorSubject<Record<string, string>>({
      category: 'text_generation',
      name: 'Llama-3',
    });

    isAuthenticatedSource = signal(true);
    isRequestorSource = signal(true);

    api = {
      backendCapabilities: signal({ writable: true, mode: 'PRIMARY', canonicalFormat: 'legacy' }),
      getGroupMembers: vi.fn().mockReturnValue(of(buildGroupResponse('Llama-3', []))),
      getAlias: vi.fn().mockReturnValue(of({ canonical: 'Llama-3', aliases: [] })),
      deleteModel: vi.fn(),
      updateGroupCommonFields: vi.fn(),
    };

    notification = {
      error: vi.fn(),
      success: vi.fn(),
      warning: vi.fn(),
    };

    auth = {
      isAuthenticated: computed(() => isAuthenticatedSource()),
      isRequestor: computed(() => isRequestorSource()),
      isApprover: computed(() => false),
      isLicenseEditor: computed(() => false),
    };

    pendingSummary = {
      records: signal([]),
      refresh: vi.fn(),
    };

    const queryParamMap$ = rawParams.pipe(map((p) => convertToParamMap(p)));

    await TestBed.configureTestingModule({
      imports: [TextModelGroupComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: ModelReferenceApiService, useValue: api },
        { provide: NotificationService, useValue: notification },
        { provide: AuthService, useValue: auth },
        { provide: PendingQueueSummaryService, useValue: pendingSummary },
        { provide: ActivatedRoute, useValue: { queryParamMap: queryParamMap$ } },
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

  function initWithError(): void {
    api.getGroupMembers.mockReturnValue(throwError(() => new Error('Not found')));
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
        'Llama-3-1B-Instruct',
        'Llama-3-8B-Instruct',
      ]);
    });

    it('uses inferred name structure to order full names by actual parameter size', () => {
      const response = buildGroupResponse(
        'Llama-3',
        [
          buildMember('Llama-3-0.5B-Instruct', {
            parameters: 500_000_000,
            size: '0.5B',
            variant: 'Instruct',
          }),
          buildMember('Llama-3-1.8B-Instruct', {
            parameters: 1_800_000_000,
            size: '1.8B',
            variant: 'Instruct',
          }),
          buildMember('Llama-3-100B-Instruct', {
            parameters: 100_000_000_000,
            size: '100B',
            variant: 'Instruct',
          }),
          buildMember('Llama-3-8B-Instruct', {
            parameters: 8_000_000_000,
            size: '8B',
            variant: 'Instruct',
          }),
        ],
        {
          name_format: {
            separator: '-',
            part_order: ['base', 'size', 'variant'],
            author_included: false,
            template: '{base}-{size}-{variant}',
          },
        },
      );

      initWithGroupResponse(response);

      expect(component.canonicalMembers().map((member) => member.name)).toEqual([
        'Llama-3-0.5B-Instruct',
        'Llama-3-1.8B-Instruct',
        'Llama-3-8B-Instruct',
        'Llama-3-100B-Instruct',
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
      initWithGroupResponse(buildGroupResponse('Llama-3', []));
      expect(component.canonicalMembers().length).toBe(0);
    });
  });

  describe('API error handling', () => {
    it('does not throw when backend returns 404 for empty group', () => {
      expect(() => initWithError()).not.toThrow();
      expect(component.groupData()).toBeNull();
      expect(component.loading()).toBe(false);
    });

    it('leaves groupData null so pending-only view can render', () => {
      initWithError();
      expect(component.groupData()).toBeNull();
      expect(component.canonicalMembers()).toEqual([]);
    });

    it('does not show error notification on 404', () => {
      initWithError();
      expect(notification.error).not.toHaveBeenCalled();
    });
  });

  describe('pending queue integration', () => {
    it('returns empty when no pending records exist', () => {
      initWithGroupResponse(buildGroupResponse('Llama-3', []));
      expect(component.pendingGroupChanges()).toEqual([]);
      expect(component.pendingCreates()).toEqual([]);
      expect(component.pendingUpdates()).toEqual([]);
      expect(component.pendingDeletes()).toEqual([]);
    });

    it('matches pending creates by text_model_group in payload', () => {
      pendingSummary.records.set([
        buildPendingRecord({
          model_name: 'Llama-3-8B',
          operation: 'create' as PendingChangeRecord['operation'],
          payload: { text_model_group: 'Llama-3' },
        }),
      ]);

      initWithGroupResponse(buildGroupResponse('Llama-3', []));

      expect(component.pendingCreates().length).toBe(1);
      expect(component.pendingCreates()[0].model_name).toBe('Llama-3-8B');
    });

    it('does not match creates for a different group', () => {
      pendingSummary.records.set([
        buildPendingRecord({
          model_name: 'Mistral-7B',
          operation: 'create' as PendingChangeRecord['operation'],
          payload: { text_model_group: 'Mistral' },
        }),
      ]);

      initWithGroupResponse(buildGroupResponse('Llama-3', []));

      expect(component.pendingGroupChanges()).toEqual([]);
    });

    it('matches pending updates/deletes by existing member name', () => {
      pendingSummary.records.set([
        buildPendingRecord({
          model_name: 'Llama-3-8B-Instruct',
          operation: 'update' as PendingChangeRecord['operation'],
        }),
        buildPendingRecord({
          change_id: 2,
          model_name: 'Llama-3-70B-Instruct',
          operation: 'delete' as PendingChangeRecord['operation'],
        }),
      ]);

      initWithGroupResponse(
        buildGroupResponse('Llama-3', [
          buildMember('Llama-3-8B-Instruct'),
          buildMember('Llama-3-70B-Instruct'),
        ]),
      );

      expect(component.pendingUpdates().length).toBe(1);
      expect(component.pendingDeletes().length).toBe(1);
    });

    it('ignores records from other categories', () => {
      pendingSummary.records.set([
        buildPendingRecord({
          model_name: 'Llama-3-8B',
          operation: 'create' as PendingChangeRecord['operation'],
          category: 'image_generation' as PendingChangeRecord['category'],
          payload: { text_model_group: 'Llama-3' },
        }),
      ]);

      initWithGroupResponse(buildGroupResponse('Llama-3', []));

      expect(component.pendingGroupChanges()).toEqual([]);
    });

    it('ignores non-pending status records', () => {
      pendingSummary.records.set([
        buildPendingRecord({
          model_name: 'Llama-3-8B',
          operation: 'create' as PendingChangeRecord['operation'],
          payload: { text_model_group: 'Llama-3' },
          status: 'applied' as PendingChangeRecord['status'],
        }),
      ]);

      initWithGroupResponse(buildGroupResponse('Llama-3', []));

      expect(component.pendingGroupChanges()).toEqual([]);
    });

    it('works with null groupData (404 scenario) for create matching', () => {
      pendingSummary.records.set([
        buildPendingRecord({
          model_name: 'Llama-3-8B',
          operation: 'create' as PendingChangeRecord['operation'],
          payload: { text_model_group: 'Llama-3' },
        }),
      ]);

      initWithError();

      expect(component.pendingCreates().length).toBe(1);
    });

    it('handles create records with null payload gracefully', () => {
      pendingSummary.records.set([
        buildPendingRecord({
          model_name: 'Llama-3-8B',
          operation: 'create' as PendingChangeRecord['operation'],
          payload: null,
        }),
      ]);

      initWithGroupResponse(buildGroupResponse('Llama-3', []));

      expect(component.pendingGroupChanges()).toEqual([]);
    });
  });

  describe('health warnings', () => {
    it('detects inconsistent baselines across members', () => {
      initWithGroupResponse(
        buildGroupResponse('Llama-3', [
          buildMember('Llama-3-8B', { baseline: 'llama3' }),
          buildMember('Llama-3-1B', { baseline: 'llama2' }),
        ]),
      );

      expect(component.healthWarnings().length).toBeGreaterThan(0);
      expect(component.healthWarnings()[0]).toContain('Inconsistent baselines');
    });

    it('detects mixed NSFW flags', () => {
      initWithGroupResponse(
        buildGroupResponse('Llama-3', [
          buildMember('Llama-3-8B', { nsfw: true }),
          buildMember('Llama-3-1B', { nsfw: false }),
        ]),
      );

      expect(component.healthWarnings()).toEqual(
        expect.arrayContaining([expect.stringContaining('NSFW')]),
      );
    });

    it('reports missing descriptions as metadata context rather than a health warning', () => {
      initWithGroupResponse(
        buildGroupResponse('Llama-3', [
          buildMember('Llama-3-8B', { description: 'Has one' }),
          buildMember('Llama-3-1B'),
        ]),
      );

      expect(component.metadataNotices()).toEqual(
        expect.arrayContaining([expect.stringContaining('missing descriptions')]),
      );
      expect(component.healthWarnings()).toEqual([]);
    });

    it('returns no warnings for a consistent single-member group', () => {
      initWithGroupResponse(
        buildGroupResponse('Llama-3', [
          buildMember('Llama-3-8B', {
            baseline: 'llama3',
            nsfw: false,
            description: 'A model',
          }),
        ]),
      );

      expect(component.healthWarnings()).toEqual([]);
    });

    it('returns no warnings when all members are consistent', () => {
      initWithGroupResponse(
        buildGroupResponse('Llama-3', [
          buildMember('Llama-3-8B', { baseline: 'llama3', nsfw: false, description: 'Desc' }),
          buildMember('Llama-3-1B', { baseline: 'llama3', nsfw: false, description: 'Desc' }),
        ]),
      );

      expect(component.healthWarnings()).toEqual([]);
    });
  });

  describe('detail information architecture', () => {
    it('opens on concrete variants and keeps maintenance controls out of the reading path', () => {
      initWithGroupResponse(
        buildGroupResponse('Llama-3', [
          buildMember('Llama-3-8B', { description: 'A model' }),
          buildMember('Llama-3-70B', { description: 'A model' }),
        ]),
      );
      fixture.detectChanges();

      expect(component.activeSection()).toBe('variants');
      expect(fixture.nativeElement.textContent).toContain('Canonical Models');
      expect(fixture.nativeElement.textContent).not.toContain('Edit Shared');
    });

    it('links the group comparison and every canonical member to actionable destinations', () => {
      initWithGroupResponse(
        buildGroupResponse('Llama-3', [
          buildMember('publisher/Llama-3-8B', { description: 'A model' }),
        ]),
      );
      fixture.detectChanges();

      const destinations = Array.from<HTMLAnchorElement>(
        fixture.nativeElement.querySelectorAll('a'),
      ).map((link) => link.getAttribute('href'));
      expect(destinations).toContain('/categories/text_generation?groups=Llama-3');
      expect(destinations).toContain('/categories/text_generation/model/publisher%2FLlama-3-8B');
    });

    it('shows maintenance as a separate workflow only to a contributor on a writable server', () => {
      api.backendCapabilities.set({
        writable: false,
        mode: 'REPLICA',
        canonicalFormat: 'legacy',
      });
      initWithGroupResponse(
        buildGroupResponse('Llama-3', [buildMember('Llama-3-8B', { description: 'A model' })], {
          common_fields: { baseline: 'llama3' },
        }),
      );
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).not.toContain('Maintenance');

      api.backendCapabilities.set({
        writable: true,
        mode: 'PRIMARY',
        canonicalFormat: 'legacy',
      });
      isRequestorSource.set(true);
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('Maintenance');
    });
  });

  describe('size sub-groups', () => {
    it('does not sub-group when 10 or fewer canonical members', () => {
      const members = Array.from({ length: 10 }, (_, i) => buildMember(`Model-${i}`));
      initWithGroupResponse(buildGroupResponse('TestGroup', members));

      expect(component.useSizeSubGroups()).toBe(false);
      expect(component.sizeSubGroups()).toEqual([]);
    });

    it('creates sub-groups when more than 10 canonical members', () => {
      const members = [
        ...Array.from({ length: 6 }, (_, i) =>
          buildMember(`Model-8B-v${i}`, { parameters: 8_000_000_000 }),
        ),
        ...Array.from({ length: 6 }, (_, i) =>
          buildMember(`Model-70B-v${i}`, { parameters: 70_000_000_000 }),
        ),
      ];
      // Give parsed.size so sub-grouping works
      members.forEach((m, i) => {
        m.parsed = { base_name: m.name, size: i < 6 ? '8B' : '70B' };
      });

      initWithGroupResponse(buildGroupResponse('TestGroup', members));

      expect(component.useSizeSubGroups()).toBe(true);
      expect(component.sizeSubGroups().length).toBe(2);
      expect(component.sizeSubGroups().every((sg) => sg.expanded)).toBe(true);
    });
  });

  describe('common fields editing', () => {
    it('starts with editing disabled and no dirty state', () => {
      initWithGroupResponse(buildGroupResponse('Llama-3', []));
      expect(component.editingCommonFields()).toBe(false);
      expect(component.commonFieldsDirty()).toBe(false);
    });

    it('populates edits from current common fields on startEditingCommonFields', () => {
      initWithGroupResponse(
        buildGroupResponse('Llama-3', [], {
          common_fields: { baseline: 'llama3', nsfw: false },
        }),
      );

      component.startEditingCommonFields();

      expect(component.editingCommonFields()).toBe(true);
      expect(component.commonFieldEdits()).toEqual({ baseline: 'llama3', nsfw: false });
    });

    it('detects dirty state when edit differs from baseline', () => {
      initWithGroupResponse(
        buildGroupResponse('Llama-3', [], {
          common_fields: { baseline: 'llama3' },
        }),
      );

      component.startEditingCommonFields();
      component.updateCommonFieldEdit('baseline', 'llama4');

      expect(component.commonFieldsDirty()).toBe(true);
    });

    it('is not dirty when edits match baseline', () => {
      initWithGroupResponse(
        buildGroupResponse('Llama-3', [], {
          common_fields: { baseline: 'llama3' },
        }),
      );

      component.startEditingCommonFields();
      component.updateCommonFieldEdit('baseline', 'llama3');

      expect(component.commonFieldsDirty()).toBe(false);
    });

    it('cancelEditingCommonFields resets state', () => {
      initWithGroupResponse(
        buildGroupResponse('Llama-3', [], {
          common_fields: { baseline: 'llama3' },
        }),
      );

      component.startEditingCommonFields();
      component.updateCommonFieldEdit('baseline', 'changed');
      component.cancelEditingCommonFields();

      expect(component.editingCommonFields()).toBe(false);
      expect(component.commonFieldEdits()).toEqual({});
      expect(component.commonFieldsDirty()).toBe(false);
    });

    it('generates preview of changed fields', () => {
      initWithGroupResponse(
        buildGroupResponse('Llama-3', [], {
          common_fields: { baseline: 'llama3', nsfw: false },
        }),
      );

      component.startEditingCommonFields();
      component.updateCommonFieldEdit('baseline', 'llama4');

      const preview = component.commonFieldsPreview();
      expect(preview.length).toBe(1);
      expect(preview[0]).toEqual({ field: 'baseline', from: 'llama3', to: 'llama4' });
    });
  });

  describe('unsaved changes guard', () => {
    it('returns false when no panels are open', () => {
      initWithGroupResponse(buildGroupResponse('Llama-3', []));
      expect(component.hasUnsavedChanges()).toBe(false);
    });

    it('returns true when add variation panel is dirty', () => {
      initWithGroupResponse(buildGroupResponse('Llama-3', []));
      component.showAddVariation.set(true);
      component.addVariationDirty.set(true);
      expect(component.hasUnsavedChanges()).toBe(true);
    });

    it('returns false when add variation panel is open but clean', () => {
      initWithGroupResponse(buildGroupResponse('Llama-3', []));
      component.showAddVariation.set(true);
      component.addVariationDirty.set(false);
      expect(component.hasUnsavedChanges()).toBe(false);
    });

    it('returns true when multi variation panel is dirty', () => {
      initWithGroupResponse(buildGroupResponse('Llama-3', []));
      component.showMultiVariation.set(true);
      component.multiVariationDirty.set(true);
      expect(component.hasUnsavedChanges()).toBe(true);
    });

    it('returns true when common fields are being edited with changes', () => {
      initWithGroupResponse(
        buildGroupResponse('Llama-3', [], {
          common_fields: { baseline: 'llama3' },
        }),
      );
      component.startEditingCommonFields();
      component.updateCommonFieldEdit('baseline', 'changed');
      expect(component.hasUnsavedChanges()).toBe(true);
    });
  });

  describe('parameter summary', () => {
    it('returns available sizes from the response', () => {
      const response = buildGroupResponse(
        'Llama-3',
        [
          buildMember('Llama-3-8B-Instruct', { parameters: 8_000_000_000, size: '8B' }),
          buildMember('Llama-3-1B-Instruct', { parameters: 1_000_000_000, size: '1B' }),
          buildMember('Llama-3-70B-Instruct', { parameters: 70_000_000_000, size: '70B' }),
        ],
        { available_sizes: ['1B', '8B', '70B'] },
      );

      initWithGroupResponse(response);

      const summary = component.parameterSummary();
      expect(summary).toEqual(['1B', '8B', '70B']);
    });

    it('returns null when no sizes are available', () => {
      initWithGroupResponse(buildGroupResponse('Llama-3', [buildMember('Llama-3-Instruct')]));

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

      expect(router.navigate).toHaveBeenCalledWith(['/text-groups']);
    });
  });

  describe('writable state', () => {
    it('is writable when backend supports writes and the viewer may propose', () => {
      initWithGroupResponse(buildGroupResponse('Llama-3', []));
      expect(component.writable()).toBe(true);
    });

    it('is not writable when backend does not support writes', () => {
      api.backendCapabilities.set({ writable: false, mode: 'REPLICA', canonicalFormat: 'legacy' });
      initWithGroupResponse(buildGroupResponse('Llama-3', []));
      expect(component.writable()).toBe(false);
    });

    it('is not writable for a signed-in viewer who may not propose', () => {
      // Proposing is allowlist-controlled, so holding a valid key is not sufficient.
      isAuthenticatedSource.set(true);
      isRequestorSource.set(false);
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

    it('calls deleteModel and reloads on success', () => {
      api.deleteModel.mockReturnValue(of(undefined));
      const response = buildGroupResponse('Llama-3', [buildMember('Llama-3-8B')]);
      initWithGroupResponse(response);

      component.confirmDeleteMember(component.canonicalMembers()[0]);
      component.deleteConfirmationInput.set('Llama-3-8B');
      component.deleteMember('Llama-3-8B');

      expect(api.deleteModel).toHaveBeenCalledWith('text_generation', 'Llama-3-8B');
      expect(notification.success).toHaveBeenCalled();
    });

    it('does not call deleteModel when confirmation does not match', () => {
      const response = buildGroupResponse('Llama-3', [buildMember('Llama-3-8B')]);
      initWithGroupResponse(response);

      component.confirmDeleteMember(component.canonicalMembers()[0]);
      component.deleteConfirmationInput.set('wrong');
      component.deleteMember('Llama-3-8B');

      expect(api.deleteModel).not.toHaveBeenCalled();
    });

    it('shows error notification on delete failure', () => {
      api.deleteModel.mockReturnValue(throwError(() => new Error('Server error')));
      initWithGroupResponse(buildGroupResponse('Llama-3', [buildMember('Llama-3-8B')]));

      component.confirmDeleteMember(component.canonicalMembers()[0]);
      component.deleteConfirmationInput.set('Llama-3-8B');
      component.deleteMember('Llama-3-8B');

      expect(notification.error).toHaveBeenCalledWith('Server error');
      expect(component.modelToDelete()).toBeNull();
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

    it('does nothing when canonical members list is empty', () => {
      initWithGroupResponse(buildGroupResponse('Llama-3', []));
      component.groupName.set('Llama-3');
      component.deleteAllVariantsConfirmation.set('Llama-3');

      component.deleteAllMembers();

      expect(api.deleteModel).not.toHaveBeenCalled();
    });
  });

  describe('exception members', () => {
    it('returns exception members from groupData', () => {
      initWithGroupResponse(
        buildGroupResponse('Llama-3', [buildMember('Llama-3-Special')], {
          exception_members: [{ name: 'Llama-3-Special', reason: 'Legacy naming' }],
        }),
      );

      expect(component.exceptionMembers().length).toBe(1);
      expect(component.exceptionMemberNames().has('Llama-3-Special')).toBe(true);
    });

    it('getExceptionReason returns reason for known exception', () => {
      initWithGroupResponse(
        buildGroupResponse('Llama-3', [buildMember('Llama-3-Special')], {
          exception_members: [{ name: 'Llama-3-Special', reason: 'Legacy naming' }],
        }),
      );

      expect(component.getExceptionReason('Llama-3-Special')).toBe('Legacy naming');
    });

    it('getExceptionReason returns null for non-exception member', () => {
      initWithGroupResponse(buildGroupResponse('Llama-3', [buildMember('Llama-3-8B')]));

      expect(component.getExceptionReason('Llama-3-8B')).toBeNull();
    });
  });

  describe('variation panel toggles', () => {
    it('openAddVariation closes multi variation', () => {
      initWithGroupResponse(buildGroupResponse('Llama-3', []));
      component.showMultiVariation.set(true);

      component.openAddVariation();

      expect(component.showAddVariation()).toBe(true);
      expect(component.showMultiVariation()).toBe(false);
    });

    it('openMultiVariation closes single variation', () => {
      initWithGroupResponse(buildGroupResponse('Llama-3', []));
      component.showAddVariation.set(true);

      component.openMultiVariation();

      expect(component.showMultiVariation()).toBe(true);
      expect(component.showAddVariation()).toBe(false);
    });

    it('closeAddVariation resets dirty flag', () => {
      initWithGroupResponse(buildGroupResponse('Llama-3', []));
      component.showAddVariation.set(true);
      component.addVariationDirty.set(true);

      component.closeAddVariation();

      expect(component.showAddVariation()).toBe(false);
      expect(component.addVariationDirty()).toBe(false);
    });
  });
});
