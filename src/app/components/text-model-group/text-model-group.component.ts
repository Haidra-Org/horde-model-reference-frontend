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
import { filter, map, switchMap, tap } from 'rxjs/operators';
import { ModelReferenceApiService } from '../../services/model-reference-api.service';
import { NotificationService } from '../../services/notification.service';
import { AuthService } from '../../services/auth.service';

/**
 * A single member of a text model group, with its actual record key
 * and the properties extracted from the API response.
 */
export interface GroupMember {
  /** The actual key in the API response (used for edit/delete API calls) */
  recordKey: string;
  /** Display name (may differ from recordKey for backend-prefixed entries) */
  name: string;
  /** Parameter count */
  parameters?: number;
  /** Model baseline */
  baseline?: string;
  /** Whether the model is NSFW */
  nsfw?: boolean;
  /** Description */
  description?: string;
  /** Tags */
  tags?: string[];
  /** Style */
  style?: string;
  /** Display name field from the record */
  displayName?: string;
  /** URL */
  url?: string;
  /** Whether this is a backend-prefixed duplicate (auto-generated, not independently editable) */
  isBackendDuplicate: boolean;
  /** Backend prefix if present */
  backendPrefix?: string;
}

/** Known text generation backend prefixes */
const BACKEND_PREFIXES = ['aphrodite/', 'koboldcpp/'] as const;

function hasBackendPrefix(name: string): string | undefined {
  return BACKEND_PREFIXES.find((prefix) => name.startsWith(prefix));
}

@Component({
  selector: 'app-text-model-group',
  imports: [RouterLink, FormsModule],
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

  readonly category = signal('text_generation');
  readonly groupName = signal('');
  readonly loading = signal(true);
  readonly members = signal<GroupMember[]>([]);

  readonly modelToDelete = signal<string | null>(null);
  readonly deleteConfirmationInput = signal('');
  readonly deleteAllVariantsConfirmation = signal('');
  readonly deletingAll = signal(false);

  readonly writable = computed(
    () => this.api.backendCapabilities().writable && this.auth.isAuthenticated(),
  );

  readonly deleteAllowed = computed(
    () => this.deleteConfirmationInput().trim() === this.modelToDelete(),
  );

  readonly deleteAllAllowed = computed(
    () => this.deleteAllVariantsConfirmation().trim() === this.groupName(),
  );

  /** Canonical members are real records (no backend prefix) */
  readonly canonicalMembers = computed(() => this.members().filter((m) => !m.isBackendDuplicate));

  /** Backend duplicates are auto-generated entries with backend prefixes */
  readonly backendDuplicates = computed(() => this.members().filter((m) => m.isBackendDuplicate));

  /** Summary of parameter sizes in the group */
  readonly parameterSummary = computed(() => {
    const params = this.canonicalMembers()
      .map((m) => m.parameters)
      .filter((p): p is number => p != null && p > 0);
    if (params.length === 0) return null;
    const unique = [...new Set(params)].sort((a, b) => a - b);
    return unique.map((p) => formatParameterCount(p));
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
        switchMap(() => this.api.getLegacyModelsInCategory(this.category())),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (response) => {
          const members = this.extractGroupMembers(response);
          this.members.set(members);
          this.loading.set(false);

          if (members.length === 0) {
            this.notification.error(`No models found in group "${this.groupName()}"`);
          }
        },
        error: (error: Error) => {
          this.notification.error(error.message);
          this.loading.set(false);
        },
      });
  }

  editMember(member: GroupMember): void {
    this.router.navigate(['/categories', this.category(), 'edit', member.recordKey]);
  }

  confirmDeleteMember(member: GroupMember): void {
    this.modelToDelete.set(member.recordKey);
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
          // Reload the group data
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
        .deleteModel(this.category(), member.recordKey)
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
      .getLegacyModelsInCategory(this.category())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const members = this.extractGroupMembers(response);
          this.members.set(members);
          this.loading.set(false);

          if (members.length === 0) {
            this.notification.success('All models in this group have been deleted');
            this.goBackToList();
          }
        },
        error: (error: Error) => {
          this.notification.error(error.message);
          this.loading.set(false);
        },
      });
  }

  private extractGroupMembers(
    response: Record<string, Record<string, unknown>>,
  ): GroupMember[] {
    const targetGroup = this.groupName();
    const members: GroupMember[] = [];

    for (const [key, data] of Object.entries(response)) {
      const modelGroup = data['text_model_group'] as string | undefined;
      if (modelGroup !== targetGroup) continue;

      const backendPrefix = hasBackendPrefix(key);

      members.push({
        recordKey: key,
        name: (data['name'] as string) ?? key,
        parameters: data['parameters'] as number | undefined,
        baseline: data['baseline'] as string | undefined,
        nsfw: data['nsfw'] as boolean | undefined,
        description: data['description'] as string | undefined,
        tags: data['tags'] as string[] | undefined,
        style: data['style'] as string | undefined,
        displayName: data['display_name'] as string | undefined,
        url: data['url'] as string | undefined,
        isBackendDuplicate: backendPrefix != null,
        backendPrefix: backendPrefix?.replace('/', ''),
      });
    }

    // Sort: canonical first, then backend duplicates, alphabetical within each group
    members.sort((a, b) => {
      if (a.isBackendDuplicate !== b.isBackendDuplicate) {
        return a.isBackendDuplicate ? 1 : -1;
      }
      return a.recordKey.localeCompare(b.recordKey);
    });

    return members;
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
