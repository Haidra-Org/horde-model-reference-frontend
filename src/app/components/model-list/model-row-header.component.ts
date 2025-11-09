import { Component, input, computed, ChangeDetectionStrategy } from '@angular/core';
import {
  LegacyRecordUnion,
  isLegacyStableDiffusionRecord,
  isLegacyTextGenerationRecord,
} from '../../models';
import { getDownloadCount } from './model-row.utils';
import {
  getImageModelGpuRequirements,
  getTextModelGpuRequirements,
  getSpeedTierBadgeClass,
  formatVramRequirement,
} from '../../utils/gpu-requirements.utils';
import {
  getModelStatusBadges,
  getStatusBadgeLabel,
  getStatusBadgeTooltip,
  getStatusBadgeIcon,
} from '../../utils/model-status.utils';

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
          <!-- Status Badges (Popular, Trending, Needs Workers, New) -->
          <div class="flex flex-wrap gap-1 justify-end">
            @if (statusBadges(); as badges) {
              @if (badges.isPopular) {
                <span class="badge-popular" [title]="getStatusTooltip('isPopular')">
                  <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                    <path [attr.d]="getStatusIcon('isPopular')" />
                  </svg>
                  {{ getStatusLabel('isPopular') }}
                </span>
              }
              @if (badges.isTrending) {
                <span class="badge-trending" [title]="getStatusTooltip('isTrending')">
                  <svg
                    class="w-3 h-3"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      [attr.d]="getStatusIcon('isTrending')"
                    />
                  </svg>
                  {{ getStatusLabel('isTrending') }}
                </span>
              }
              @if (badges.needsWorkers) {
                <span class="badge-needs-workers" [title]="getStatusTooltip('needsWorkers')">
                  <svg
                    class="w-3 h-3"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      [attr.d]="getStatusIcon('needsWorkers')"
                    />
                  </svg>
                  {{ getStatusLabel('needsWorkers') }}
                </span>
              }
              @if (badges.isNew) {
                <span class="badge-new" [title]="getStatusTooltip('isNew')">
                  <svg
                    class="w-3 h-3"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      [attr.d]="getStatusIcon('isNew')"
                    />
                  </svg>
                  {{ getStatusLabel('isNew') }}
                </span>
              }
            }
          </div>

          <!-- GPU Requirements Badge -->
          @if (gpuRequirement(); as req) {
            <span class="badge-gpu-requirement" [title]="req.speedDescription">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
                />
              </svg>
              {{ formatVram(req.minVramGb) }}
            </span>
          }

          <!-- Speed Tier Badge -->
          @if (speedTierBadge(); as speed) {
            <span [class]="speed.class" [title]="speed.description">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
              {{ speed.label }}
            </span>
          }

          <!-- NSFW Badge -->
          <div>
            @if (model().nsfw === true) {
              <span class="badge badge-warning">NSFW</span>
            } @else if (model().nsfw === false) {
              <span class="badge badge-success">Safe</span>
            } @else {
              <span class="badge badge-secondary">Unknown</span>
            }
          </div>

          <!-- Download Count Badge -->
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
  readonly allModels = input<LegacyRecordUnion[]>([]);

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

  readonly gpuRequirement = computed(() => {
    const model = this.model();

    if (isLegacyStableDiffusionRecord(model) && model.baseline) {
      return getImageModelGpuRequirements(model.baseline);
    }

    if (isLegacyTextGenerationRecord(model) && model.parameters) {
      const parametersInBillions = model.parameters / 1_000_000_000;
      return getTextModelGpuRequirements(parametersInBillions);
    }

    return null;
  });

  readonly speedTierBadge = computed(() => {
    const req = this.gpuRequirement();
    if (!req) return null;

    return {
      class: getSpeedTierBadgeClass(req.speedTier),
      label: req.speedTier.charAt(0).toUpperCase() + req.speedTier.slice(1),
      description: `${req.speedDescription} (${req.generationTimeEstimate})`,
    };
  });

  readonly statusBadges = computed(() => {
    const model = this.model();
    const allModels = this.allModels();

    // Extract required fields for status badges
    const modelData = {
      total_usage_count: (model as Record<string, unknown>)['total_usage_count'] as
        | number
        | undefined,
      month_usage_count: (model as Record<string, unknown>)['month_usage_count'] as
        | number
        | undefined,
      active_workers: (model as Record<string, unknown>)['active_workers'] as number | undefined,
      created_at: (model as Record<string, unknown>)['created_at'] as string | undefined,
    };

    const allModelsData = allModels.map((m) => ({
      total_usage_count: (m as Record<string, unknown>)['total_usage_count'] as number | undefined,
    }));

    return getModelStatusBadges(modelData, allModelsData);
  });

  formatVram(vramGb: number): string {
    return formatVramRequirement(vramGb);
  }

  getStatusLabel(status: 'isPopular' | 'isTrending' | 'needsWorkers' | 'isNew'): string {
    return getStatusBadgeLabel(status);
  }

  getStatusTooltip(status: 'isPopular' | 'isTrending' | 'needsWorkers' | 'isNew'): string {
    return getStatusBadgeTooltip(status);
  }

  getStatusIcon(status: 'isPopular' | 'isTrending' | 'needsWorkers' | 'isNew'): string {
    return getStatusBadgeIcon(status);
  }
}
