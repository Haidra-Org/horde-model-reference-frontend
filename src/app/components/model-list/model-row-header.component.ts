import { Component, input, computed, ChangeDetectionStrategy } from '@angular/core';
import {
  LegacyRecordUnion,
  isLegacyStableDiffusionRecord,
  isLegacyTextGenerationRecord,
} from '../../models';
import { getDownloadCount } from './model-row.utils';

@Component({
  selector: 'app-model-row-header',
  template: `
    @if (mode() === 'compact') {
      <span class="flex items-center gap-2">
        <span>{{ model().name }}</span>
        @if (model().version && !this.isTextGenerationRecord(model())) {
          <span class="text-xs text-gray-400 dark:text-gray-400">{{ model().version }}</span>
        }
      </span>
    } @else {
      <div class="flex items-start justify-between gap-4">
        <div class="min-w-0">
          <div class="flex items-center gap-2 min-w-0">
            <div class="font-semibold text-lg text-gray-900 dark:text-gray-100 truncate">
              {{ model().name }}
            </div>
            @if (model().version) {
              <span class="badge badge-secondary">v{{ model().version }}</span>
            }
          </div>
          <div class="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {{ model().description || 'No description' }}
          </div>
          @if (hasTags()) {
            <div class="flex flex-wrap gap-2 mt-2">
              @for (tag of tags(); track tag) {
                <span class="tag tag-primary">{{ tag }}</span>
              }
              @if (hasInpainting()) {
                <span class="tag tag-success">Inpainting</span>
              }
            </div>
          }
        </div>
        <div class="flex flex-col items-end gap-2 flex-shrink-0">
          <div>
            @if (model().nsfw === true) {
              <span class="badge badge-warning">NSFW</span>
            } @else if (model().nsfw === false) {
              <span class="badge badge-success">Safe</span>
            } @else {
              <span class="badge badge-secondary">Unknown</span>
            }
          </div>
          <div>
            @if (downloadCount() > 0) {
              <span class="badge badge-info">{{ downloadCount() }} files</span>
            } @else {
              <span class="badge badge-secondary">No files</span>
            }
          </div>
        </div>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModelRowHeaderComponent {
  readonly model = input.required<LegacyRecordUnion>();
  readonly mode = input<'compact' | 'card'>('compact');

  readonly tags = computed(() => {
    const model = this.model();
    if (isLegacyStableDiffusionRecord(model) && model.tags) {
      return model.tags;
    }
    if (isLegacyTextGenerationRecord(model) && model.tags) {
      return model.tags;
    }
    return [];
  });

  readonly hasTags = computed(() => this.tags().length > 0);

  readonly hasInpainting = computed(
    () => isLegacyStableDiffusionRecord(this.model()) && this.model().inpainting === true,
  );

  readonly downloadCount = computed(() => getDownloadCount(this.model()));

  readonly isTextGenerationRecord = (model: LegacyRecordUnion): boolean => {
    return isLegacyTextGenerationRecord(model);
  };
}
