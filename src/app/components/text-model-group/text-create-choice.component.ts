import {
  ChangeDetectionStrategy,
  Component,
  output,
  signal,
  inject,
  DestroyRef,
  computed,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { HordeButtonComponent } from '@haidra/design-system/button';
import { ModelReferenceApiService } from '../../services/model-reference-api.service';
import { AutocompleteInputComponent } from '../form-fields/autocomplete-input/autocomplete-input.component';

export type CreateChoice =
  | { kind: 'new-group' }
  | { kind: 'add-to-group'; groupName: string }
  | { kind: 'standalone' };

@Component({
  selector: 'app-text-create-choice',
  imports: [FormsModule, HordeButtonComponent, AutocompleteInputComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="modal-overlay modal-overlay--high text-create-choice-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-choice-title"
      tabindex="0"
      (click)="dismiss.emit()"
      (keydown)="$event.key === 'Escape' && dismiss.emit()"
    >
      <div
        class="modal-backdrop modal-backdrop--blur text-create-choice-backdrop"
        aria-hidden="true"
      ></div>

      <div
        class="modal-dialog modal-dialog--xl text-create-choice-dialog"
        role="document"
        (click)="$event.stopPropagation()"
        (keydown)="$event.stopPropagation()"
      >
        <h2 class="modal-title" id="create-choice-title">Create Text Generation Model</h2>
        <div class="modal-content">
          <p class="text-muted text-sm mb-4">
            Text models are typically organized into groups. How would you like to proceed?
          </p>
          <div class="flex flex-col gap-3">
            <!-- New Group -->
            <button
              type="button"
              class="choice-card choice-card--primary"
              (click)="chosen.emit({ kind: 'new-group' })"
            >
              <span class="text-2xl mt-0.5">📦</span>
              <div>
                <span class="choice-card-title">New Group</span>
                <p class="text-xs text-muted mt-0.5">
                  Start a new model family with a naming schema and first variation.
                </p>
              </div>
            </button>

            <!-- Add to Existing Group -->
            <div class="choice-card" [class.choice-card--active]="showGroupPicker()">
              <button
                type="button"
                class="flex w-full items-start gap-3 text-left"
                (click)="openGroupPicker()"
              >
                <span class="text-2xl mt-0.5">➕</span>
                <div class="flex-1">
                  <span class="choice-card-title">Add to Existing Group</span>
                  <p class="text-xs text-muted mt-0.5">
                    Add a new size, quant, or variant to an existing model group.
                  </p>
                </div>
              </button>

              @if (showGroupPicker()) {
                <div class="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700" role="group">
                  <app-autocomplete-input
                    [label]="'Search groups'"
                    [ariaLabel]="'Search groups'"
                    [value]="selectedGroup()"
                    [suggestions]="groupNames()"
                    placeholder="Search groups..."
                    (valueChange)="selectedGroup.set($event ?? '')"
                  />

                  @if (loadingGroups()) {
                    <p class="text-xs text-muted mt-2">Loading available groups...</p>
                  } @else if (groupNames().length === 0) {
                    <p class="text-xs text-warning-600 dark:text-warning-400 mt-2">
                      No groups were found. Create a new group instead.
                    </p>
                  }

                  @if (selectedGroup()) {
                    <horde-button
                      variant="primary"
                      size="sm"
                      class="mt-2"
                      [disabled]="!selectedGroupExists()"
                      (click)="chooseSelectedGroup()"
                    >
                      Go to {{ selectedGroup().trim() }}
                    </horde-button>

                    @if (!selectedGroupExists()) {
                      <p class="text-xs text-warning-600 dark:text-warning-400 mt-2">
                        Select an existing group from autocomplete suggestions.
                      </p>
                    }
                  }
                </div>
              }
            </div>

            <!-- Standalone -->
            <button
              type="button"
              class="choice-card choice-card--neutral"
              (click)="chosen.emit({ kind: 'standalone' })"
            >
              <span class="text-2xl mt-0.5">📄</span>
              <div>
                <span class="choice-card-title">Standalone Model</span>
                <p class="text-xs text-muted mt-0.5">
                  Create a single model without group association.
                </p>
              </div>
            </button>
          </div>
        </div>
        <div class="modal-actions">
          <horde-button variant="secondary" (click)="dismiss.emit()">Cancel</horde-button>
        </div>
      </div>
    </div>
  `,
})
export class TextCreateChoiceComponent {
  private readonly api = inject(ModelReferenceApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly chosen = output<CreateChoice>();
  readonly dismiss = output<void>();

  readonly showGroupPicker = signal(false);
  readonly selectedGroup = signal('');
  readonly groupNames = signal<string[]>([]);
  readonly loadingGroups = signal(false);

  readonly selectedGroupExists = computed(() => {
    const selected = this.selectedGroup().trim().toLowerCase();
    if (!selected) {
      return false;
    }

    return this.groupNames().some((name) => name.toLowerCase() === selected);
  });

  constructor() {
    this.loadGroupNames();
  }

  openGroupPicker(): void {
    this.showGroupPicker.set(true);
    if (this.groupNames().length === 0 && !this.loadingGroups()) {
      this.loadGroupNames();
    }
  }

  chooseSelectedGroup(): void {
    const groupName = this.selectedGroup().trim();
    if (!groupName || !this.selectedGroupExists()) {
      return;
    }

    this.chosen.emit({ kind: 'add-to-group', groupName });
  }

  private loadGroupNames(): void {
    this.loadingGroups.set(true);
    this.api
      .getGroupNames()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (names) => {
          this.groupNames.set(names);
          this.loadingGroups.set(false);
        },
        error: () => {
          this.groupNames.set([]);
          this.loadingGroups.set(false);
        },
      });
  }
}
