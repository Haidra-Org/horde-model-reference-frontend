import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type {
  GuidanceMigrationPreview,
  TextGuidanceAssignment,
  TextGuidanceChangeSet,
  TextUsageProfile,
  TextUsageProfileSummary,
} from '../../models/text-guidance.models';
import { ModelReferenceApiService } from '../../services/model-reference-api.service';
import { ViewerCapabilitiesService } from '../../services/viewer-capabilities.service';
import { NotificationService } from '../../services/notification.service';
import { ShellContextService } from '../../services/shell-context.service';
import { TextGuidanceService } from '../../services/text-guidance.service';

@Component({
  selector: 'app-text-guidance',
  imports: [FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="guidance-catalog-page">
      <header class="guidance-catalog-hero">
        <div>
          <p class="eyebrow">Text generation metadata</p>
          <h1>Usage guidance catalog</h1>
          <p>
            Reusable prompt contracts explain serialization; usage recipes add task-specific advice.
            Assignments attach both to exact model records.
          </p>
        </div>
        @if (metadataRevision()) {
          <span>Catalog revision {{ metadataRevision() }}</span>
        }
      </header>

      <div class="guidance-concept-map" aria-label="How guidance relates to models">
        <div><strong>Prompt contract</strong><span>How messages become a prompt</span></div>
        <span aria-hidden="true">→</span>
        <div><strong>Exact model assignments</strong><span>One contract can be reused</span></div>
        <span aria-hidden="true">→</span>
        <div><strong>Model records</strong><span>The identifiers workers actually serve</span></div>
      </div>

      @if (loading()) {
        <div class="glass-inflow catalog-state" role="status">Loading guidance catalog…</div>
      } @else if (error()) {
        <div class="alert alert--danger" role="alert">{{ error() }}</div>
      } @else {
        <div class="guidance-catalog-layout">
          <aside class="guidance-profile-list" aria-label="Guidance profiles">
            <div class="guidance-profile-list__header">
              <strong>{{ profiles().length }} profiles</strong>
              <input
                aria-label="Filter guidance profiles"
                placeholder="Filter profiles"
                [ngModel]="filterText()"
                (ngModelChange)="filterText.set($event)"
              />
            </div>
            @for (profile of filteredProfiles(); track profile.profile_id) {
              <button
                type="button"
                [class.guidance-profile-row--active]="selectedProfileId() === profile.profile_id"
                (click)="selectProfile(profile.profile_id)"
              >
                <span class="badge badge-gray badge-xs">{{ kindLabel(profile) }}</span>
                <strong>{{ profile.display_name }}</strong>
                <span>{{ profile.summary }}</span>
                <small>{{ profile.assigned_model_count }} assigned models</small>
              </button>
            } @empty {
              <p class="catalog-state">No profiles match this filter.</p>
            }
          </aside>

          <main class="guidance-profile-view">
            @if (profileLoading()) {
              <div class="catalog-state" role="status">Loading profile…</div>
            } @else if (selectedProfile(); as profile) {
              <div class="guidance-profile-view__heading">
                <div>
                  <p class="eyebrow">
                    {{ profile.kind === 'prompt_contract' ? 'Prompt contract' : 'Usage recipe' }}
                  </p>
                  <h2>{{ profile.display_name }}</h2>
                  <p>{{ profile.summary }}</p>
                </div>
                <span class="badge badge-purple"
                  >{{ selectedSummary()?.assigned_model_count ?? 0 }} models</span
                >
              </div>
              @if (profile.aliases.length) {
                <p class="guidance-aliases">Also known as: {{ profile.aliases.join(', ') }}</p>
              }
              <div class="guidance-audience-switch" role="group" aria-label="Guidance audience">
                <button
                  type="button"
                  [attr.aria-pressed]="audience() === 'user'"
                  (click)="audience.set('user')"
                >
                  For model users
                </button>
                <button
                  type="button"
                  [attr.aria-pressed]="audience() === 'developer'"
                  (click)="audience.set('developer')"
                >
                  For developers
                </button>
              </div>
              @if (audienceContent(profile); as content) {
                <p class="guidance-overview">
                  {{ content.overview || 'No overview has been published.' }}
                </p>
                <div class="guidance-prose-grid">
                  @if (content.use_cases.length) {
                    <section>
                      <h3>Useful for</h3>
                      <ul>
                        @for (item of content.use_cases; track item) {
                          <li>{{ item }}</li>
                        }
                      </ul>
                    </section>
                  }
                  @if (content.tips.length) {
                    <section>
                      <h3>Practical tips</h3>
                      <ul>
                        @for (item of content.tips; track item) {
                          <li>{{ item }}</li>
                        }
                      </ul>
                    </section>
                  }
                  @if (content.caveats.length) {
                    <section>
                      <h3>Watch for</h3>
                      <ul>
                        @for (item of content.caveats; track item) {
                          <li>{{ item }}</li>
                        }
                      </ul>
                    </section>
                  }
                </div>
              }
              @if (profile.templates?.length) {
                <section class="guidance-templates">
                  <h3>Templates</h3>
                  @for (template of profile.templates; track template.template_id) {
                    <details>
                      <summary>
                        {{ template.name }}
                        <span>{{ template.syntax_name || template.syntax }}</span>
                      </summary>
                      <pre><code>{{ template.template }}</code></pre>
                    </details>
                  }
                </section>
              }
              @if (selectedAssignments().length) {
                <section class="guidance-assigned-models" aria-labelledby="assigned-models-heading">
                  <div>
                    <h3 id="assigned-models-heading">Used by exact model records</h3>
                    <p>
                      The reusable profile is shared; each link opens the independently served model
                      record that opts into it.
                    </p>
                  </div>
                  <div>
                    @for (assignment of selectedAssignments(); track assignment.model_name) {
                      <a
                        [routerLink]="[
                          '/categories',
                          'text_generation',
                          'model',
                          assignment.model_name,
                        ]"
                        >{{ assignment.model_name }}</a
                      >
                    }
                  </div>
                </section>
              }
            } @else {
              <div class="guidance-empty">
                <strong>Select a guidance profile</strong>
                <p>
                  Profiles are reusable records, separate from the model records that reference
                  them.
                </p>
              </div>
            }
          </main>
        </div>
      }

      @if (canManage()) {
        <section class="guidance-admin glass-inflow" aria-labelledby="guidance-admin-heading">
          <div class="guidance-admin__heading">
            <div>
              <p class="eyebrow">Maintainer workflow</p>
              <h2 id="guidance-admin-heading">Propose guidance</h2>
              <p>
                Changes enter the same pending → approve → apply workflow as model-reference edits.
              </p>
            </div>
            <button
              type="button"
              class="btn btn-secondary btn-sm"
              [disabled]="migrationLoading()"
              (click)="previewMigration()"
            >
              Preview legacy migration
            </button>
          </div>

          @if (migrationPreview(); as preview) {
            <div class="guidance-migration-preview" role="status">
              <div>
                <strong>{{ preview.source_model_count }} assignments</strong
                ><span
                  >{{ preview.format_count }} new contracts synthesized from legacy labels</span
                >
              </div>
              @if (preview.change_set) {
                <button
                  type="button"
                  class="btn btn-primary btn-sm"
                  [disabled]="submitting()"
                  (click)="submit(preview.change_set)"
                >
                  Submit migration for review
                </button>
              } @else {
                <span>Everything is already represented.</span>
              }
            </div>
          }

          <form class="guidance-admin-form" (ngSubmit)="submitEditorProposal()">
            <div class="form-group">
              <label class="form-label" for="guidance-mode">Proposal type</label
              ><select
                id="guidance-mode"
                class="form-select"
                [(ngModel)]="editorMode"
                name="editorMode"
              >
                <option value="create">Create a prompt contract and assign it</option>
                <option value="assign">Reuse the selected contract on more models</option>
              </select>
            </div>
            @if (editorMode === 'create') {
              <div class="form-group">
                <label class="form-label" for="guidance-id">Stable profile ID</label
                ><input
                  id="guidance-id"
                  class="form-input"
                  required
                  pattern="[a-z0-9._-]+"
                  [(ngModel)]="profileId"
                  name="profileId"
                  placeholder="chatml"
                />
              </div>
              <div class="form-group">
                <label class="form-label" for="guidance-name">Display name</label
                ><input
                  id="guidance-name"
                  class="form-input"
                  required
                  [(ngModel)]="profileName"
                  name="profileName"
                />
              </div>
              <div class="form-group guidance-admin-form--wide">
                <label class="form-label" for="guidance-summary">Short actionable summary</label
                ><textarea
                  id="guidance-summary"
                  class="form-textarea"
                  required
                  [(ngModel)]="profileSummary"
                  name="profileSummary"
                ></textarea>
              </div>
              <div class="form-group guidance-admin-form--wide">
                <label class="form-label" for="guidance-template"
                  >Raw prompt template
                  <span class="text-muted">(displayed, never executed)</span></label
                ><textarea
                  id="guidance-template"
                  class="form-textarea form-textarea--code"
                  [(ngModel)]="rawTemplate"
                  name="rawTemplate"
                ></textarea>
              </div>
            } @else {
              <div class="form-group">
                <label class="form-label" for="guidance-profile-select">Prompt contract</label
                ><select
                  id="guidance-profile-select"
                  class="form-select"
                  required
                  [(ngModel)]="assignmentProfileId"
                  name="assignmentProfileId"
                >
                  @for (profile of promptContracts(); track profile.profile_id) {
                    <option [value]="profile.profile_id">{{ profile.display_name }}</option>
                  }
                </select>
              </div>
            }
            <div class="form-group guidance-admin-form--wide">
              <label class="form-label" for="guidance-models">Exact model identifiers</label
              ><textarea
                id="guidance-models"
                class="form-textarea form-textarea--code"
                required
                [(ngModel)]="modelNames"
                name="modelNames"
                placeholder="publisher/model-a&#10;publisher/model-b"
              ></textarea>
              <p class="form-help">
                One per line. Assignments target exact records—not an entire group or family.
              </p>
            </div>
            <div class="guidance-admin-form__actions">
              <button
                type="submit"
                class="btn btn-primary"
                [disabled]="submitting() || !assignmentsReady()"
              >
                {{ submitting() ? 'Submitting…' : 'Submit for review' }}
              </button>
              @if (!assignmentsReady()) {
                <span class="form-help" role="status">Loading current assignments…</span>
              }
            </div>
          </form>
        </section>
      }
    </div>
  `,
})
export class TextGuidanceComponent implements OnInit {
  private readonly service = inject(TextGuidanceService);
  private readonly api = inject(ModelReferenceApiService);
  private readonly viewer = inject(ViewerCapabilitiesService);
  private readonly notifications = inject(NotificationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly shell = inject(ShellContextService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly profiles = signal<TextUsageProfileSummary[]>([]);
  protected readonly selectedProfile = signal<TextUsageProfile | null>(null);
  protected readonly selectedProfileId = signal<string | null>(null);
  protected readonly loading = signal(true);
  protected readonly profileLoading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly audience = signal<'user' | 'developer'>('user');
  protected readonly migrationPreview = signal<GuidanceMigrationPreview | null>(null);
  protected readonly migrationLoading = signal(false);
  protected readonly submitting = signal(false);
  protected readonly assignments = signal<TextGuidanceAssignment[]>([]);
  protected readonly assignmentsReady = signal(false);
  protected readonly metadataRevision = signal<number | null>(null);
  protected readonly filterText = signal('');
  protected editorMode: 'create' | 'assign' = 'create';
  protected profileId = '';
  protected assignmentProfileId = '';
  protected profileName = '';
  protected profileSummary = '';
  protected rawTemplate = '';
  protected modelNames = '';

  protected readonly canManage = this.viewer.canPropose;
  protected readonly filteredProfiles = computed(() => {
    const query = this.filterText().trim().toLowerCase();
    return query
      ? this.profiles().filter((profile) =>
          `${profile.display_name} ${profile.summary} ${profile.aliases.join(' ')}`
            .toLowerCase()
            .includes(query),
        )
      : this.profiles();
  });
  protected readonly promptContracts = computed(() =>
    this.profiles().filter((profile) => profile.kind === 'prompt_contract'),
  );
  protected readonly selectedSummary = computed(() =>
    this.profiles().find((profile) => profile.profile_id === this.selectedProfileId()),
  );
  protected readonly selectedAssignments = computed(() => {
    const profileId = this.selectedProfileId();
    if (!profileId) return [];
    return this.assignments().filter(
      (assignment) =>
        assignment.primary_profile_id === profileId ||
        assignment.supplemental_profile_ids.includes(profileId),
    );
  });

  ngOnInit(): void {
    this.shell.setContext({
      breadcrumb: [{ label: 'Text guidance' }],
      title: 'Usage guidance',
      actions: [],
    });
    this.modelNames = this.route.snapshot.queryParamMap.get('assign') ?? '';
    this.loadProfiles();
    this.loadAssignments();
  }

  protected kindLabel(profile: TextUsageProfileSummary): string {
    return profile.kind === 'prompt_contract' ? 'Prompt contract' : 'Usage recipe';
  }

  protected audienceContent(profile: TextUsageProfile) {
    return this.audience() === 'user' ? profile.user : profile.developer;
  }

  protected selectProfile(profileId: string): void {
    this.selectedProfileId.set(profileId);
    this.profileLoading.set(true);
    this.service
      .getProfile(profileId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (profile) => {
          this.selectedProfile.set(profile);
          this.profileLoading.set(false);
        },
        error: () => {
          this.profileLoading.set(false);
          this.notifications.error('Unable to load that guidance profile');
        },
      });
  }

  protected previewMigration(): void {
    this.migrationLoading.set(true);
    this.service
      .previewMigration()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (preview) => {
          this.migrationPreview.set(preview);
          this.migrationLoading.set(false);
        },
        error: () => {
          this.migrationLoading.set(false);
          this.notifications.error('Unable to preview legacy guidance migration');
        },
      });
  }

  protected submitEditorProposal(): void {
    const modelNames = this.modelNames
      .split(/\r?\n|,/)
      .map((name) => name.trim())
      .filter(Boolean);
    const profileId =
      this.editorMode === 'create' ? this.profileId.trim() : this.assignmentProfileId.trim();
    if (!profileId || modelNames.length === 0) return;
    const profileChanges: Record<string, unknown>[] = [];
    if (this.editorMode === 'create') {
      const templates = this.rawTemplate.trim()
        ? [
            {
              template_id: 'primary',
              name: 'Primary template',
              syntax: 'literal',
              template: this.rawTemplate,
              variables: [],
            },
          ]
        : [];
      profileChanges.push({
        operation: 'create',
        profile_id: profileId,
        expected_before: null,
        profile: {
          profile_id: profileId,
          kind: 'prompt_contract',
          display_name: this.profileName.trim(),
          aliases: [],
          summary: this.profileSummary.trim(),
          interaction_modes: ['instruction'],
          templates,
        },
      });
    }
    this.submit({
      title:
        this.editorMode === 'create'
          ? `Document ${this.profileName.trim()}`
          : `Assign ${profileId} guidance`,
      profile_changes: profileChanges,
      assignment_changes: modelNames.map((modelName) => {
        const currentAssignment = this.assignments().find(
          (assignment) => assignment.model_name === modelName,
        );
        return {
          model_name: modelName,
          expected_before: currentAssignment ?? null,
          assignment: {
            model_name: modelName,
            primary_profile_id: profileId,
            supplemental_profile_ids: currentAssignment?.supplemental_profile_ids ?? [],
          },
        };
      }),
    });
  }

  protected submit(changeSet: TextGuidanceChangeSet): void {
    this.submitting.set(true);
    this.service
      .submitChangeSet(changeSet)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (change) => {
          this.submitting.set(false);
          this.notifications.success(`Guidance proposal #${change.change_id} submitted`);
          void this.router.navigate(['/pending-queue'], {
            queryParams: { focus: change.change_id },
          });
        },
        error: () => {
          this.submitting.set(false);
          this.notifications.error('Guidance proposal could not be submitted');
        },
      });
  }

  private loadProfiles(): void {
    this.service
      .listProfiles()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.profiles.set(page.items);
          this.metadataRevision.set(page.metadata.revision);
          this.loading.set(false);
          const first = page.items[0];
          const firstContract = page.items.find((profile) => profile.kind === 'prompt_contract');
          this.assignmentProfileId ||= firstContract?.profile_id ?? '';
          if (first) this.selectProfile(first.profile_id);
        },
        error: () => {
          this.error.set('The usage-guidance catalog could not be loaded.');
          this.loading.set(false);
        },
      });
  }

  private loadAssignments(): void {
    this.service
      .listAssignments()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.assignments.set(page.items);
          this.assignmentsReady.set(true);
        },
        error: () => {
          this.notifications.error(
            'Current guidance assignments could not be loaded; proposals are disabled to avoid overwriting newer work.',
          );
        },
      });
  }
}
