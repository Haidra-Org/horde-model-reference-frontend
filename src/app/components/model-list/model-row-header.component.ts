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
      <div class="model-card-header">
        <div class="flex items-center gap-2 mb-2">
          <h3 class="model-card-title flex-1">{{ model().name }}</h3>
          @if (model().version) {
            <span class="badge badge-secondary flex-shrink-0">v{{ model().version }}</span>
          }
        </div>
        <div class="flex items-start justify-between gap-3 mb-3">
          <div class="model-card-badges flex-wrap">
            <!-- Status Badges (Popular, Trending, Needs Workers, New) -->
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
            <!-- Worker Count Badge (always shown) -->
            <span class="badge badge-info" [title]="workerCountTooltip()">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              {{ workerCount() }} {{ workerCount() === 1 ? 'worker' : 'workers' }}
            </span>
          </div>
        </div>

        <div class="model-card-description">
          {{ model().description || 'No description available' }}
        </div>

        <div class="flex items-center justify-between gap-3">
          <div class="model-card-tags">
            @if (hasTags()) {
              @for (tag of tags(); track tag) {
                <span class="tag tag-primary">{{ tag }}</span>
              }
              @if (hasInpainting()) {
                <span class="tag tag-success">Inpainting</span>
              }
            }
          </div>

          <div class="flex flex-col items-end gap-1.5 flex-shrink-0">
            @if (!isTextModel()) {
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
              @if (model().nsfw === true) {
                <span class="badge badge-warning">NSFW</span>
              } @else if (model().nsfw === false) {
                <span class="badge badge-success">Safe</span>
              } @else {
                <span class="badge badge-secondary">Unknown</span>
              }

              <!-- Download Count Badge -->
              @if (downloadCount() > 0) {
                <span class="badge badge-info">{{ downloadCount() }} files</span>
              } @else {
                <span class="badge badge-secondary">No files</span>
              }
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

  readonly isTextModel = computed(() => {
    return isLegacyTextGenerationRecord(this.model());
  });

  readonly gpuRequirement = computed(() => {
    const model = this.model();

    if (isLegacyStableDiffusionRecord(model) && model.baseline) {
      let requirement = getImageModelGpuRequirements(model.baseline);

      // Override VRAM requirement if file size is over 16GB
      if (requirement && model.size_on_disk_bytes) {
        const sizeInGB = model.size_on_disk_bytes / (1024 * 1024 * 1024);
        if (sizeInGB > 16) {
          requirement = {
            ...requirement,
            minVramGb: 24,
            recommendedVramGb: 24,
          };
        }
      }

      return requirement;
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
      active_workers: (model as Record<string, unknown>)['workerCount'] as number | undefined,
      created_at: (model as Record<string, unknown>)['created_at'] as string | undefined,
    };

    const allModelsData = allModels.map((m) => ({
      total_usage_count: (m as Record<string, unknown>)['total_usage_count'] as number | undefined,
    }));

    return getModelStatusBadges(modelData, allModelsData);
  });

  readonly workerCount = computed(() => {
    const model = this.model();
    return ((model as Record<string, unknown>)['workerCount'] as number | undefined) ?? 0;
  });

  readonly workerCountTooltip = computed(() => {
    const count = this.workerCount();
    return count === 0
      ? 'No workers are currently serving this model'
      : `${count} worker${count === 1 ? ' is' : 's are'} currently serving this model`;
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
