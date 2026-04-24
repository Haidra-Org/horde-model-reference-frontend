import {
  Component,
  inject,
  OnInit,
  signal,
  computed,
  ChangeDetectionStrategy,
  DestroyRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HordeBadgeComponent } from '@haidra/design-system/badge';
import { HordeButtonComponent } from '@haidra/design-system/button';
import { filter, map, switchMap, tap } from 'rxjs/operators';
import { catchError, of } from 'rxjs';
import { ModelReferenceApiService } from '../../services/model-reference-api.service';
import { NotificationService } from '../../services/notification.service';
import { AuthService } from '../../services/auth.service';
import { PendingQueueSummaryService } from '../../services/pending-queue-summary.service';
import {
  GroupFamilyResponse,
  GroupMemberInfo,
  GroupMembersResponse,
  NameExceptionInfo,
  PendingChangeRecord,
} from '../../api-client';
import { AddVariationPanelComponent } from './add-variation-panel.component';
import { MultiVariationPanelComponent } from './multi-variation-panel.component';
import { NameSchemaEditorComponent } from './name-schema-editor.component';

export interface SizeSubGroup {
  size: string;
  members: GroupMemberInfo[];
  expanded: boolean;
}

@Component({
  selector: 'app-text-model-group',
  imports: [
    RouterLink,
    FormsModule,
    HordeBadgeComponent,
    HordeButtonComponent,
    AddVariationPanelComponent,
    MultiVariationPanelComponent,
    NameSchemaEditorComponent,
  ],
  templateUrl: './text-model-group.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TextModelGroupComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(ModelReferenceApiService);
  private readonly notification = inject(NotificationService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly pendingSummary = inject(PendingQueueSummaryService);

  readonly category = signal('text_generation');
  readonly groupName = signal('');
  readonly loading = signal(true);
  readonly groupData = signal<GroupMembersResponse | null>(null);

  // Editing common fields
  readonly editingCommonFields = signal(false);
  readonly commonFieldEdits = signal<Record<string, unknown>>({});
  readonly savingCommonFields = signal(false);

  // Delete state
  readonly modelToDelete = signal<string | null>(null);
  readonly deleteConfirmationInput = signal('');
  readonly deleteAllVariantsConfirmation = signal('');
  readonly deletingAll = signal(false);

  // Add variation panel
  readonly showAddVariation = signal(false);
  readonly showMultiVariation = signal(false);
  readonly addVariationDirty = signal(false);
  readonly multiVariationDirty = signal(false);

  readonly Object = Object;

  readonly writable = computed(
    () => this.api.backendCapabilities().writable && this.auth.isAuthenticated(),
  );

  readonly deleteAllowed = computed(
    () => this.deleteConfirmationInput().trim() === this.modelToDelete(),
  );

  readonly deleteAllAllowed = computed(
    () => this.deleteAllVariantsConfirmation().trim() === this.groupName(),
  );

  readonly canonicalMembers = computed(() => {
    const data = this.groupData();
    if (!data) return [];
    return data.members.filter((m) => !m.is_backend_duplicate);
  });

  readonly backendDuplicates = computed(() => {
    const data = this.groupData();
    if (!data) return [];
    return data.members.filter((m) => m.is_backend_duplicate);
  });

  /** Pending changes for text_generation that relate to this group */
  readonly pendingGroupChanges = computed<PendingChangeRecord[]>(() => {
    const group = this.groupName();
    if (!group) return [];
    const memberNames = new Set(this.groupData()?.members.map((m) => m.name) ?? []);

    return this.pendingSummary.records().filter((r) => {
      if (r.category !== 'text_generation' || r.status !== 'pending') return false;
      // Match existing members (update/delete)
      if (memberNames.has(r.model_name)) return true;
      // Match creates by group name in payload or name prefix
      if (r.operation === 'create') {
        const payload = r.payload ?? {};
        if (payload['text_model_group'] === group) return true;
      }
      return false;
    });
  });

  readonly pendingCreates = computed(() =>
    this.pendingGroupChanges().filter((r) => r.operation === 'create'),
  );

  readonly pendingUpdates = computed(() =>
    this.pendingGroupChanges().filter((r) => r.operation === 'update'),
  );

  readonly pendingDeletes = computed(() =>
    this.pendingGroupChanges().filter((r) => r.operation === 'delete'),
  );

  readonly commonFields = computed(() => {
    return this.groupData()?.common_fields ?? {};
  });

  readonly nameSchemaIsCustom = computed(() => this.groupData()?.name_schema_is_custom ?? false);

  readonly relatedFamily = computed<GroupFamilyResponse | null>(
    () => this.groupData()?.related_family ?? null,
  );

  readonly groupAliases = signal<string[]>([]);

  readonly exceptionMembers = computed<NameExceptionInfo[]>(
    () => this.groupData()?.exception_members ?? [],
  );

  readonly exceptionMemberNames = computed(
    () => new Set(this.exceptionMembers().map((e) => e.name)),
  );

  readonly commonFieldsDirty = computed(() => {
    if (!this.editingCommonFields()) {
      return false;
    }

    const baseline = this.commonFields();
    const edits = this.commonFieldEdits();
    return Object.entries(edits).some(
      ([key, value]) => JSON.stringify(value) !== JSON.stringify(baseline[key]),
    );
  });

  /** Preview of what common-field edits will change across group members */
  readonly commonFieldsPreview = computed<{ field: string; from: unknown; to: unknown }[]>(() => {
    if (!this.commonFieldsDirty()) return [];
    const baseline = this.commonFields();
    const edits = this.commonFieldEdits();
    return Object.entries(edits)
      .filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(baseline[key]))
      .map(([key, value]) => ({ field: key, from: baseline[key], to: value }));
  });

  readonly parameterSummary = computed(() => {
    const data = this.groupData();
    if (!data) return null;
    return data.available_sizes.length > 0 ? data.available_sizes : null;
  });

  /** Whether to show size sub-groups (for large groups with >10 canonical members) */
  readonly useSizeSubGroups = computed(() => this.canonicalMembers().length > 10);

  readonly sizeSubGroups = computed<SizeSubGroup[]>(() => {
    const members = this.canonicalMembers();
    if (members.length <= 10) return [];

    const groups = new Map<string, GroupMemberInfo[]>();
    for (const member of members) {
      const size = member.parsed.size ?? 'Unknown';
      const existing = groups.get(size) ?? [];
      existing.push(member);
      groups.set(size, existing);
    }

    return Array.from(groups.entries()).map(([size, members]) => ({
      size,
      members,
      expanded: true,
    }));
  });

  /** Health check: find inconsistencies across canonical members */
  readonly healthWarnings = computed<string[]>(() => {
    const members = this.canonicalMembers();
    if (members.length <= 1) return [];
    const warnings: string[] = [];

    const baselines = new Set(members.map((m) => m.baseline).filter(Boolean));
    if (baselines.size > 1) {
      warnings.push(`Inconsistent baselines: ${[...baselines].join(', ')}`);
    }

    const nsfwValues = new Set(members.map((m) => m.nsfw));
    if (nsfwValues.size > 1) {
      warnings.push('Members have different NSFW flags');
    }

    const missingDesc = members.filter((m) => !m.description);
    if (missingDesc.length > 0) {
      warnings.push(`${missingDesc.length} member(s) missing descriptions`);
    }

    return warnings;
  });

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        map((params) => ({
          category: params.get('category') ?? 'text_generation',
          groupName: params.get('groupName') ?? '',
        })),
        filter(({ groupName }) => groupName.length > 0),
        tap(({ category, groupName }) => {
          this.category.set(category);
          this.groupName.set(groupName);
          this.loading.set(true);
        }),
        switchMap(({ groupName }) =>
          this.api.getGroupMembers(groupName).pipe(catchError(() => of(null))),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (response) => {
          if (response) {
            this.groupData.set(response);
            this.loadAliases(response.group_name);
          }
          this.loading.set(false);
        },
      });
  }

  editMember(member: GroupMemberInfo): void {
    this.router.navigate(['/categories', this.category(), 'edit', member.name], {
      queryParams: { groupName: this.groupName() },
    });
  }

  confirmDeleteMember(member: GroupMemberInfo): void {
    this.modelToDelete.set(member.name);
  }

  cancelDelete(): void {
    this.modelToDelete.set(null);
    this.deleteConfirmationInput.set('');
  }

  deleteMember(recordKey: string): void {
    if (!this.deleteAllowed()) return;

    this.api
      .deleteModel(this.category(), recordKey)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.notification.success(`Model "${recordKey}" deleted successfully`);
          this.modelToDelete.set(null);
          this.deleteConfirmationInput.set('');
          this.reloadGroup();
        },
        error: (error: Error) => {
          this.notification.error(error.message);
          this.modelToDelete.set(null);
          this.deleteConfirmationInput.set('');
        },
      });
  }

  confirmDeleteAll(): void {
    this.deletingAll.set(true);
  }

  cancelDeleteAll(): void {
    this.deletingAll.set(false);
    this.deleteAllVariantsConfirmation.set('');
  }

  deleteAllMembers(): void {
    if (!this.deleteAllAllowed()) return;

    const canonical = this.canonicalMembers();
    if (canonical.length === 0) return;

    let completed = 0;
    let errors = 0;

    for (const member of canonical) {
      this.api
        .deleteModel(this.category(), member.name)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            completed++;
            if (completed + errors === canonical.length) {
              this.onDeleteAllComplete(completed, errors);
            }
          },
          error: () => {
            errors++;
            if (completed + errors === canonical.length) {
              this.onDeleteAllComplete(completed, errors);
            }
          },
        });
    }
  }

  // --- Common Fields Editing ---

  startEditingCommonFields(): void {
    this.commonFieldEdits.set({ ...this.commonFields() });
    this.editingCommonFields.set(true);
  }

  cancelEditingCommonFields(): void {
    this.editingCommonFields.set(false);
    this.commonFieldEdits.set({});
  }

  updateCommonFieldEdit(field: string, value: unknown): void {
    this.commonFieldEdits.update((edits) => ({ ...edits, [field]: value }));
  }

  saveCommonFields(): void {
    const edits = this.commonFieldEdits();
    if (Object.keys(edits).length === 0) return;

    this.savingCommonFields.set(true);
    this.api
      .updateGroupCommonFields(this.groupName(), edits)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.notification.success(`Queued ${response.updated_count} updates for approval`);
          this.editingCommonFields.set(false);
          this.savingCommonFields.set(false);
        },
        error: (error: Error) => {
          this.notification.error(error.message);
          this.savingCommonFields.set(false);
        },
      });
  }

  // --- Size Sub-Group Toggle ---

  toggleSizeGroup(subGroup: SizeSubGroup): void {
    subGroup.expanded = !subGroup.expanded;
  }

  // --- Add Variation ---

  openAddVariation(): void {
    this.showMultiVariation.set(false);
    this.showAddVariation.set(true);
  }

  closeAddVariation(): void {
    this.showAddVariation.set(false);
    this.addVariationDirty.set(false);
  }

  onVariationCreated(): void {
    this.showAddVariation.set(false);
    this.addVariationDirty.set(false);
    this.reloadGroup();
  }

  openMultiVariation(): void {
    this.showAddVariation.set(false);
    this.showMultiVariation.set(true);
  }

  closeMultiVariation(): void {
    this.showMultiVariation.set(false);
    this.multiVariationDirty.set(false);
  }

  onMultiVariationCreated(): void {
    this.multiVariationDirty.set(false);
    this.reloadGroup();
  }

  onSchemaChanged(): void {
    this.reloadGroup();
  }

  getExceptionReason(memberName: string): string | null {
    const ex = this.exceptionMembers().find((e) => e.name === memberName);
    return ex?.reason ?? null;
  }

  setNameException(memberName: string, reason: string | null): void {
    this.api
      .setNameException(memberName, reason)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.notification.success(
            reason
              ? `Marked "${memberName}" as exception`
              : `Cleared exception for "${memberName}"`,
          );
          this.reloadGroup();
        },
        error: (error: Error) => {
          this.notification.error(error.message);
        },
      });
  }

  onAddVariationDirtyChange(isDirty: boolean): void {
    this.addVariationDirty.set(isDirty);
  }

  onMultiVariationDirtyChange(isDirty: boolean): void {
    this.multiVariationDirty.set(isDirty);
  }

  hasUnsavedChanges(): boolean {
    return (
      (this.showAddVariation() && this.addVariationDirty()) ||
      (this.showMultiVariation() && this.multiVariationDirty()) ||
      this.commonFieldsDirty()
    );
  }

  isArray(value: unknown): value is unknown[] {
    return Array.isArray(value);
  }

  asStringArray(value: unknown): string[] {
    if (Array.isArray(value)) return value.map(String);
    return [];
  }

  formatParams(params: number): string {
    return formatParameterCount(params);
  }

  goBackToList(): void {
    this.router.navigate(['/categories', this.category()]);
  }

  private onDeleteAllComplete(completed: number, errors: number): void {
    this.deletingAll.set(false);
    this.deleteAllVariantsConfirmation.set('');

    if (errors === 0) {
      this.notification.success(
        `All ${completed} model(s) in group "${this.groupName()}" deleted successfully`,
      );
      this.goBackToList();
    } else {
      this.notification.error(
        `Deleted ${completed} model(s), but ${errors} failed. Check the group for remaining entries.`,
      );
      this.reloadGroup();
    }
  }

  private reloadGroup(): void {
    this.loading.set(true);
    this.api
      .getGroupMembers(this.groupName())
      .pipe(
        catchError(() => of(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (response) => {
          if (response) {
            this.groupData.set(response);
            this.loadAliases(response.group_name);

            if (response.members.length === 0) {
              this.notification.success('All models in this group have been deleted');
              this.goBackToList();
            }
          } else {
            this.groupData.set(null);
          }
          this.loading.set(false);
        },
      });
  }

  private loadAliases(groupName: string): void {
    this.api
      .getAlias(groupName)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => this.groupAliases.set(response.aliases),
        error: () => this.groupAliases.set([]),
      });
  }
}

function formatParameterCount(params: number): string {
  if (params >= 1_000_000_000) {
    const billions = params / 1_000_000_000;
    return billions % 1 === 0 ? `${billions}B` : `${billions.toFixed(1)}B`;
  }
  if (params >= 1_000_000) {
    const millions = params / 1_000_000;
    return millions % 1 === 0 ? `${millions}M` : `${millions.toFixed(1)}M`;
  }
  return `${params}`;
}
