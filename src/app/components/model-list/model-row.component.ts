import {
  Component,
  input,
  output,
  signal,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import {
  LegacyRecordUnion,
  isLegacyStableDiffusionRecord,
  isLegacyTextGenerationRecord,
} from '../../models';
import { BASELINE_SHORTHAND_MAP } from '../../models/maps';
import { ModelRowHeaderComponent } from './model-row-header.component';
import { ModelRowFieldsComponent } from './model-row-fields.component';
import { ModelRowShowcasesComponent } from './model-row-showcases.component';
import { ModelRowActionsComponent } from './model-row-actions.component';
import { hasShowcases } from './model-row.utils';

@Component({
  selector: 'app-model-row',
  imports: [
    ModelRowHeaderComponent,
    ModelRowFieldsComponent,
    ModelRowShowcasesComponent,
    ModelRowActionsComponent,
  ],
  template: `
    <!-- Compact Table Mode -->
    <tr
      [class]="
        'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ' +
        (isEven() ? 'bg-gray-50 dark:bg-gray-700/30' : 'bg-white dark:bg-gray-800')
      "
      (click)="toggleExpansion()"
    >
      <td class="text-center">
        <svg
          class="w-4 h-4 inline-block transition-transform duration-200"
          [class.rotate-90]="expanded()"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 5l7 7-7 7"
          ></path>
        </svg>
      </td>
      <td class="font-medium text-gray-900 dark:text-gray-100">
        <app-model-row-header [model]="model()" mode="compact" />
      </td>
      <td class="text-gray-600 dark:text-gray-400 max-w-md truncate">
        {{ model().description || '-' }}
      </td>
      <td>
        @if (isStableDiffusionRecord(model())) {
          {{ baselineDisplay() }}
        } @else if (isTextGenerationRecord(model())) {
          {{ model().baseline || '-' }}
        } @else {
          -
        }
      </td>
      <td class="max-w-xs">
        @if (tags().length > 0) {
          <span class="text-sm text-gray-600 dark:text-gray-400">
            {{ tags().slice(0, 3).join(', ') }}
            @if (tags().length > 3) {
              <span class="text-gray-400 italic ml-1"> +{{ tags().length - 3 }} </span>
            }
          </span>
        } @else {
          -
        }
      </td>
      <td>
        @if (model().nsfw === true) {
          <span class="badge badge-warning">NSFW</span>
        } @else if (model().nsfw === false) {
          <span class="badge badge-success">SFW</span>
        } @else {
          <span class="badge badge-secondary">Unknown</span>
        }
      </td>
      @if (writable()) {
        <td (click)="$event.stopPropagation()">
          <app-model-row-actions
            [model]="model()"
            layout="horizontal"
            (showJson)="showJson.emit($event)"
            (edit)="edit.emit($event)"
            (delete)="delete.emit($event)"
          />
        </td>
      }
    </tr>

    <!-- Expanded Details Row -->
    @if (expanded()) {
      <tr [class]="isEven() ? 'bg-gray-50 dark:bg-gray-700/30' : 'bg-white dark:bg-gray-800'">
        <td [attr.colspan]="writable() ? 7 : 6" class="py-6 px-8">
          <div class="space-y-6">
            <!-- Overview Header -->
            <div class="card-overview">
              <div class="flex items-start justify-between gap-6">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-3 mb-2">
                    <svg class="card-overview-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                    </svg>
                    <h3 class="card-overview-title">
                      {{ model().name }}
                    </h3>
                  </div>
                  <p class="card-overview-description">
                    {{ model().description || 'No description available' }}
                  </p>
                </div>
                <div class="flex flex-col gap-2 items-end flex-shrink-0">
                  @if (model().nsfw === true) {
                    <span class="badge badge-warning">NSFW</span>
                  } @else if (model().nsfw === false) {
                    <span class="badge badge-success">SFW</span>
                  } @else {
                    <span class="badge badge-secondary">Unknown</span>
                  }
                  @if (tags().length > 0) {
                    <div class="flex flex-wrap gap-1 justify-end max-w-xs">
                      @for (tag of tags(); track tag) {
                        <span class="tag tag-primary">{{ tag }}</span>
                      }
                    </div>
                  }
                </div>
              </div>
            </div>

            <!-- Main Content -->
            <app-model-row-fields [model]="model()" mode="grid" />

            <!-- Showcases Section -->
            @if (hasShowcases(model())) {
              <div class="card">
                <div class="card-body">
                  <app-model-row-showcases
                    [showcases]="getShowcases()"
                    [modelName]="model().name"
                    layout="grid"
                    [initiallyExpanded]="isShowcaseExpanded()"
                  />
                </div>
              </div>
            }
          </div>
        </td>
      </tr>
    }
  `,
  styles: [':host { display: contents; }'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModelRowComponent {
  readonly model = input.required<LegacyRecordUnion>();
  readonly writable = input<boolean>(false);
  readonly isEven = input<boolean>(false);
  readonly expandedRows = input<Set<string>>(new Set());
  readonly expandedShowcases = input<Set<string>>(new Set());

  readonly showJson = output<LegacyRecordUnion>();
  readonly edit = output<string>();
  readonly delete = output<string>();
  readonly toggleRow = output<string>();

  readonly expanded = signal(false);

  readonly hasShowcases = hasShowcases;

  readonly baselineDisplay = computed(() => {
    const model = this.model();
    if (isLegacyStableDiffusionRecord(model)) {
      return this.getBaselineDisplay(model.baseline);
    }
    return '';
  });

  readonly parametersDisplay = computed(() => {
    const model = this.model();
    if (isLegacyTextGenerationRecord(model) && model.parameters) {
      return model.parameters.toLocaleString();
    }
    return null;
  });

  ngOnInit(): void {
    this.expanded.set(this.expandedRows().has(this.model().name));
  }

  ngOnChanges(): void {
    this.expanded.set(this.expandedRows().has(this.model().name));
  }

  toggleExpansion(): void {
    this.toggleRow.emit(this.model().name);
  }

  isStableDiffusionRecord(model: LegacyRecordUnion) {
    return isLegacyStableDiffusionRecord(model);
  }

  isTextGenerationRecord(model: LegacyRecordUnion) {
    return isLegacyTextGenerationRecord(model);
  }

  getBaselineDisplay(baseline: string): string {
    return BASELINE_SHORTHAND_MAP[baseline] || baseline;
  }

  tags() {
    const model = this.model();
    if (isLegacyStableDiffusionRecord(model) && model.tags) {
      return model.tags;
    }
    if (isLegacyTextGenerationRecord(model) && model.tags) {
      return model.tags;
    }
    return [];
  }

  getShowcases(): string[] | null | undefined {
    const model = this.model();
    if (isLegacyStableDiffusionRecord(model)) {
      return model.showcases;
    }
    return null;
  }

  isShowcaseExpanded(): boolean {
    return this.expandedShowcases().has(this.model().name);
  }
}
