import { ChangeDetectionStrategy, Component, output, signal, inject, DestroyRef } from '@angular/core';
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
    <div class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="create-choice-title" tabindex="0" (click)="dismiss.emit()" (keydown)="$event.key === 'Escape' && dismiss.emit()">
      <div class="modal-dialog max-w-lg" role="document" (click)="$event.stopPropagation()" (keydown)="$event.stopPropagation()">
        <h2 class="modal-title" id="create-choice-title">Create Text Generation Model</h2>
        <div class="modal-content">
          <p class="text-muted text-sm mb-4">
            Text models are typically organized into groups. How would you like to proceed?
          </p>
          <div class="flex flex-col gap-3">
            <!-- New Group -->
            <button
              type="button"
              class="flex items-start gap-3 p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-primary-400 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-950 transition-colors text-left"
              (click)="chosen.emit({ kind: 'new-group' })"
            >
              <span class="text-2xl mt-0.5">📦</span>
              <div>
                <span class="font-semibold text-gray-900 dark:text-gray-100">New Group</span>
                <p class="text-xs text-muted mt-0.5">
                  Start a new model family with a naming schema and first variation.
                </p>
              </div>
            </button>

            <!-- Add to Existing Group -->
            <button
              type="button"
              class="flex items-start gap-3 p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-primary-400 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-950 transition-colors text-left"
              [class.border-primary-500]="showGroupPicker()"
              (click)="showGroupPicker.set(true)"
            >
              <span class="text-2xl mt-0.5">➕</span>
              <div class="flex-1">
                <span class="font-semibold text-gray-900 dark:text-gray-100">Add to Existing Group</span>
                <p class="text-xs text-muted mt-0.5">
                  Add a new size, quant, or variant to an existing model group.
                </p>
                @if (showGroupPicker()) {
                  <div class="mt-3" role="group" (click)="$event.stopPropagation()" (keydown)="$event.stopPropagation()">
                    <app-autocomplete-input
                      [value]="selectedGroup()"
                      [suggestions]="groupNames()"
                      placeholder="Search groups..."
                      (valueChange)="selectedGroup.set($event ?? '')"
                    />
                    @if (selectedGroup()) {
                      <horde-button
                        variant="primary"
                        size="sm"
                        class="mt-2"
                        (click)="chosen.emit({ kind: 'add-to-group', groupName: selectedGroup() })"
                      >
                        Go to {{ selectedGroup() }}
                      </horde-button>
                    }
                  </div>
                }
              </div>
            </button>

            <!-- Standalone -->
            <button
              type="button"
              class="flex items-start gap-3 p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
              (click)="chosen.emit({ kind: 'standalone' })"
            >
              <span class="text-2xl mt-0.5">📄</span>
              <div>
                <span class="font-semibold text-gray-900 dark:text-gray-100">Standalone Model</span>
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

  constructor() {
    this.api
      .getGroupNames()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (names) => this.groupNames.set(names),
        error: () => this.groupNames.set([]),
      });
  }
}
