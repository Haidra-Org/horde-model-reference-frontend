import { Component, input, ChangeDetectionStrategy, computed, inject, DestroyRef, TemplateRef, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Dialog, DialogRef } from '@angular/cdk/dialog';
import { AuthService } from '../../services/auth.service';
import type { UnifiedModelData, GroupedTextModel } from '../../models/unified-model';

interface VariationCoverageRow {
  trackKey: string;
  source: UnifiedModelData;
  /** The full API model name — the exact string sent to the Horde API */
  apiName: string;
  backend: string | null;
  author: string | null;
  parameters: string | null;
  version: string | null;
  variationLabel: string | null;
  modelCore: string;
}

@Component({
  selector: 'app-model-row-variations',
  imports: [RouterLink],
  template: `
    <section class="detail-panel model-detail-panel model-detail-panel--variations">
      <div class="model-variation-header">
        <div class="model-variation-header-content">
          <h4 class="detail-section-heading model-detail-section-heading-strong">
            Available Variants
          </h4>
          <p class="model-variation-subtitle">
            {{ variationCount() }} variants across {{ backendList().length }} backends &mdash;
            use the <strong>API Model Name</strong> when requesting generations
          </p>
        </div>
        <div class="model-variation-header-actions">
          <button
            type="button"
            class="btn btn-sm btn-secondary"
            (click)="openModal()"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
            Expand
          </button>
          <a
            class="btn btn-sm btn-primary"
            [routerLink]="['/categories', 'text_generation', 'group', groupName()]"
          >
            {{ canManage() ? 'Manage Group' : 'View Group' }}
          </a>
        </div>
      </div>

      <div class="model-variation-metrics-grid">
        <article class="model-variation-metric-card">
          <span class="model-variation-metric-label">Variants</span>
          <span class="model-variation-metric-value">{{ variationCount() }}</span>
        </article>
        <article class="model-variation-metric-card">
          <span class="model-variation-metric-label">Active</span>
          <span class="model-variation-metric-value">{{ activeVariationCount() }}</span>
        </article>
        <article class="model-variation-metric-card">
          <span class="model-variation-metric-label">Workers</span>
          <span class="model-variation-metric-value">{{ totalWorkers() }}</span>
        </article>
        <article class="model-variation-metric-card">
          <span class="model-variation-metric-label">Queued</span>
          <span class="model-variation-metric-value">{{ totalQueuedJobs() }}</span>
        </article>
        <article class="model-variation-metric-card">
          <span class="model-variation-metric-label">Backends</span>
          <span class="model-variation-metric-value">{{ backendList().length }}</span>
        </article>
        <article class="model-variation-metric-card">
          <span class="model-variation-metric-label">Authors</span>
          <span class="model-variation-metric-value">{{ authorList().length }}</span>
        </article>
      </div>

      @if (availableSizes().length > 0 || availableQuants().length > 0) {
        <div class="model-variation-taxonomy">
          @if (availableSizes().length > 0) {
            <div class="model-variation-taxonomy-group">
              <span class="model-variation-taxonomy-label">Sizes</span>
              <div class="model-variation-taxonomy-chips">
                @for (size of availableSizes(); track size) {
                  <span class="model-variation-chip model-variation-chip--size">{{ size }}</span>
                }
              </div>
            </div>
          }
          @if (availableQuants().length > 0) {
            <div class="model-variation-taxonomy-group">
              <span class="model-variation-taxonomy-label">Quantizations</span>
              <div class="model-variation-taxonomy-chips">
                @for (quant of availableQuants(); track quant) {
                  <span class="model-variation-chip model-variation-chip--quant">{{ quant }}</span>
                }
              </div>
            </div>
          }
        </div>
      }

      <!-- Inline preview: responsive card list on mobile, table on desktop -->
      <div class="model-variation-table-meta">
        <span class="model-variation-table-count">
          Showing {{ previewRows().length }} of {{ variationRows().length }} variants
        </span>
        @if (variationRows().length > inlinePreviewLimit) {
          <button
            type="button"
            class="btn btn-sm btn-secondary"
            (click)="openModal()"
          >
            View all {{ variationRows().length }} variants
          </button>
        }
      </div>

      <!-- Mobile card view -->
      <div class="model-variation-card-list">
        @for (row of previewRows(); track row.trackKey) {
          <article class="model-variation-card-item">
            <div class="model-variation-card-item-header">
              @if ((row.source.workerCount ?? 0) > 0) {
                <span class="model-variation-state-pill model-variation-state-pill--serving">Serving</span>
              } @else if ((row.source.queuedJobs ?? 0) > 0) {
                <span class="model-variation-state-pill model-variation-state-pill--queued">Queued</span>
              } @else {
                <span class="model-variation-state-pill model-variation-state-pill--idle">Idle</span>
              }
              @if (row.parameters) {
                <span class="model-variation-meta-pill">{{ row.parameters }}</span>
              }
            </div>
            <div class="model-variation-card-item-body">
              <button
                type="button"
                class="model-variation-api-name-btn"
                [title]="'Copy: ' + row.apiName"
                (click)="copyToClipboard(row.apiName)"
              >
                <code class="model-variation-api-name-code">{{ row.apiName }}</code>
                <svg class="model-variation-copy-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            </div>
            <div class="model-variation-card-item-stats">
              <span>{{ row.source.workerCount ?? 0 }} workers</span>
              <span>{{ row.source.queuedJobs ?? 0 }} queued</span>
            </div>
          </article>
        }
      </div>

      <!-- Desktop table view -->
      <div class="model-variation-table-shell model-variation-table-desktop">
        <table class="w-full text-sm model-variation-table model-variation-table--dense">
          <colgroup>
            <col class="model-variation-col-state" />
            <col class="model-variation-col-api-name" />
            <col class="model-variation-col-params" />
            <col class="model-variation-col-workers" />
            <col class="model-variation-col-queued" />
            <col class="model-variation-col-usage" />
          </colgroup>
          <thead class="table-head-subtle">
            <tr class="border-b border-gray-200 dark:border-gray-700">
              <th class="table-header-cell-xs-center-caps">State</th>
              <th class="table-header-cell-xs-caps">API Model Name</th>
              <th class="table-header-cell-xs-center-caps">Params</th>
              <th class="table-header-cell-xs-center-caps">Workers</th>
              <th class="table-header-cell-xs-center-caps">Queued</th>
              <th class="table-header-cell-xs-right-caps">Usage</th>
            </tr>
          </thead>
          <tbody class="table-body-default">
            @for (row of previewRows(); track row.trackKey) {
              <tr class="table-row-hover-subtle">
                <td class="table-cell-xs-center">
                  @if ((row.source.workerCount ?? 0) > 0) {
                    <span class="model-variation-state-pill model-variation-state-pill--serving">Serving</span>
                  } @else if ((row.source.queuedJobs ?? 0) > 0) {
                    <span class="model-variation-state-pill model-variation-state-pill--queued">Queued</span>
                  } @else {
                    <span class="model-variation-state-pill model-variation-state-pill--idle">Idle</span>
                  }
                </td>
                <td class="table-cell-xs">
                  <div class="model-variation-api-name-cell">
                    <code class="model-variation-api-name-code" [title]="row.apiName">{{ row.apiName }}</code>
                    <button
                      type="button"
                      class="model-variation-copy-btn"
                      [title]="'Copy model name'"
                      (click)="copyToClipboard(row.apiName); $event.stopPropagation()"
                      aria-label="Copy model name to clipboard"
                    >
                      <svg class="model-variation-copy-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                </td>
                <td class="table-cell-xs-center">
                  @if (row.parameters) {
                    <span class="model-variation-meta-pill">{{ row.parameters }}</span>
                  } @else {
                    <span class="model-variation-meta-pill model-variation-meta-pill--empty">-</span>
                  }
                </td>
                <td class="table-cell-xs-center">{{ row.source.workerCount ?? 0 }}</td>
                <td class="table-cell-xs-center">{{ row.source.queuedJobs ?? 0 }}</td>
                <td class="table-cell-xs-right">{{ row.source.usageStats?.total ?? 0 }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </section>

    <!-- Full-screen variations modal (rendered via CDK Dialog outside virtual scroll) -->
    <ng-template #modalTpl>
      <div
        class="model-variation-modal"
        [attr.aria-label]="'Variations for ' + groupName()"
      >
          <!-- Modal hero -->
          <div class="model-variation-modal-hero">
            <div class="model-variation-modal-hero-content">
              <h2 class="modal-title">{{ groupName() }}</h2>
              <p class="model-variation-modal-hero-subtitle">
                {{ variationCount() }} variants &middot;
                {{ activeVariationCount() }} active &middot;
                {{ totalWorkers() }} workers &middot;
                {{ backendList().length }} backends
              </p>
            </div>
            <div class="model-variation-modal-hero-actions">
              <a
                class="btn btn-sm btn-primary"
                [routerLink]="['/categories', 'text_generation', 'group', groupName()]"
                (click)="closeModal()"
              >
                {{ canManage() ? 'Manage Group' : 'View Group' }}
              </a>
              <button type="button" class="btn btn-sm btn-secondary" (click)="closeModal()">
                Close
              </button>
            </div>
          </div>

          @if (availableSizes().length > 0 || availableQuants().length > 0) {
            <div class="model-variation-taxonomy model-variation-modal-taxonomy">
              @if (availableSizes().length > 0) {
                <div class="model-variation-taxonomy-group">
                  <span class="model-variation-taxonomy-label">Sizes</span>
                  <div class="model-variation-taxonomy-chips">
                    @for (size of availableSizes(); track size) {
                      <span class="model-variation-chip model-variation-chip--size">{{ size }}</span>
                    }
                  </div>
                </div>
              }
              @if (availableQuants().length > 0) {
                <div class="model-variation-taxonomy-group">
                  <span class="model-variation-taxonomy-label">Quantizations</span>
                  <div class="model-variation-taxonomy-chips">
                    @for (quant of availableQuants(); track quant) {
                      <span class="model-variation-chip model-variation-chip--quant">{{ quant }}</span>
                    }
                  </div>
                </div>
              }
            </div>
          }

          <!-- Modal body: card list on mobile, full table on desktop -->
          <div class="modal-content model-variation-modal-body">
            <!-- Mobile card view -->
            <div class="model-variation-card-list">
              @for (row of variationRows(); track row.trackKey) {
                <article class="model-variation-card-item">
                  <div class="model-variation-card-item-header">
                    @if ((row.source.workerCount ?? 0) > 0) {
                      <span class="model-variation-state-pill model-variation-state-pill--serving">Serving</span>
                    } @else if ((row.source.queuedJobs ?? 0) > 0) {
                      <span class="model-variation-state-pill model-variation-state-pill--queued">Queued</span>
                    } @else {
                      <span class="model-variation-state-pill model-variation-state-pill--idle">Idle</span>
                    }
                    @if (row.parameters) {
                      <span class="model-variation-meta-pill">{{ row.parameters }}</span>
                    }
                  </div>
                  <div class="model-variation-card-item-body">
                    <button
                      type="button"
                      class="model-variation-api-name-btn"
                      [title]="'Copy: ' + row.apiName"
                      (click)="copyToClipboard(row.apiName)"
                    >
                      <code class="model-variation-api-name-code">{{ row.apiName }}</code>
                      <svg class="model-variation-copy-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                  <div class="model-variation-card-item-stats">
                    <span>{{ row.source.workerCount ?? 0 }} workers</span>
                    <span>{{ row.source.queuedJobs ?? 0 }} queued</span>
                    <span>{{ row.source.usageStats?.total ?? 0 }} usage</span>
                  </div>
                </article>
              }
            </div>

            <!-- Desktop table view -->
            <div class="model-variation-table-shell model-variation-table-desktop model-variation-modal-table-shell">
              <table class="w-full text-sm model-variation-table model-variation-table--dense">
                <colgroup>
                  <col class="model-variation-col-state" />
                  <col class="model-variation-col-api-name" />
                  <col class="model-variation-col-params" />
                  <col class="model-variation-col-workers" />
                  <col class="model-variation-col-queued" />
                  <col class="model-variation-col-usage" />
                </colgroup>
                <thead class="table-head-subtle">
                  <tr class="border-b border-gray-200 dark:border-gray-700">
                    <th class="table-header-cell-xs-center-caps">State</th>
                    <th class="table-header-cell-xs-caps">API Model Name</th>
                    <th class="table-header-cell-xs-center-caps">Params</th>
                    <th class="table-header-cell-xs-center-caps">Workers</th>
                    <th class="table-header-cell-xs-center-caps">Queued</th>
                    <th class="table-header-cell-xs-right-caps">Usage</th>
                  </tr>
                </thead>
                <tbody class="table-body-default">
                  @for (row of variationRows(); track row.trackKey) {
                    <tr class="table-row-hover-subtle">
                      <td class="table-cell-xs-center">
                        @if ((row.source.workerCount ?? 0) > 0) {
                          <span class="model-variation-state-pill model-variation-state-pill--serving">Serving</span>
                        } @else if ((row.source.queuedJobs ?? 0) > 0) {
                          <span class="model-variation-state-pill model-variation-state-pill--queued">Queued</span>
                        } @else {
                          <span class="model-variation-state-pill model-variation-state-pill--idle">Idle</span>
                        }
                      </td>
                      <td class="table-cell-xs">
                        <div class="model-variation-api-name-cell">
                          <code class="model-variation-api-name-code" [title]="row.apiName">{{ row.apiName }}</code>
                          <button
                            type="button"
                            class="model-variation-copy-btn"
                            [title]="'Copy model name'"
                            (click)="copyToClipboard(row.apiName); $event.stopPropagation()"
                            aria-label="Copy model name to clipboard"
                          >
                            <svg class="model-variation-copy-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </button>
                        </div>
                      </td>
                      <td class="table-cell-xs-center">
                        @if (row.parameters) {
                          <span class="model-variation-meta-pill">{{ row.parameters }}</span>
                        } @else {
                          <span class="model-variation-meta-pill model-variation-meta-pill--empty">-</span>
                        }
                      </td>
                      <td class="table-cell-xs-center">{{ row.source.workerCount ?? 0 }}</td>
                      <td class="table-cell-xs-center">{{ row.source.queuedJobs ?? 0 }}</td>
                      <td class="table-cell-xs-right">{{ row.source.usageStats?.total ?? 0 }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </ng-template>
  `,
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModelRowVariationsComponent {
  readonly variations = input.required<UnifiedModelData[]>();
  readonly groupName = input.required<string>();
  readonly groupSummary = input<GroupedTextModel['groupSummary']>();
  readonly inlinePreviewLimit = 6;

  readonly modalTpl = viewChild.required<TemplateRef<unknown>>('modalTpl');
  private readonly dialog = inject(Dialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly auth = inject(AuthService);

  readonly canManage = computed(() => this.auth.isRequestor());
  private dialogRef: DialogRef | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.dialogRef?.close();
      this.dialogRef = null;
    });
  }

  readonly variationCount = computed(() => this.variations().length);

  readonly totalWorkers = computed(() =>
    this.variations().reduce((total, variation) => total + (variation.workerCount ?? 0), 0),
  );

  readonly totalQueuedJobs = computed(() =>
    this.variations().reduce((total, variation) => total + (variation.queuedJobs ?? 0), 0),
  );

  readonly activeVariationCount = computed(() =>
    this.variations().filter((variation) => (variation.workerCount ?? 0) > 0).length,
  );

  readonly backendList = computed(() => {
    const backends = new Set<string>();
    for (const variation of this.variations()) {
      const backend = variation.parsedName?.backend?.trim();
      if (backend) {
        backends.add(backend);
      }
    }
    return Array.from(backends).sort();
  });

  readonly authorList = computed(() => {
    const authors = new Set<string>();
    for (const variation of this.variations()) {
      const author = variation.parsedName?.author?.trim();
      if (author) {
        authors.add(author);
      }
    }
    return Array.from(authors).sort();
  });

  readonly availableSizes = computed(() => this.groupSummary()?.available_sizes ?? []);

  readonly availableQuants = computed(() => this.groupSummary()?.available_quants ?? []);

  readonly variationRows = computed<VariationCoverageRow[]>(() => {
    const baseName = this.getGroupBaseName(this.groupName());
    return this.variations().map((variation, index) => this.toCoverageRow(variation, baseName, index));
  });

  readonly previewRows = computed(() => {
    const rows = this.variationRows();
    if (rows.length <= this.inlinePreviewLimit) {
      return rows;
    }
    // Show the most relevant rows first: serving → queued → idle, then by usage
    const sorted = [...rows].sort((a, b) => {
      const aWorkers = a.source.workerCount ?? 0;
      const bWorkers = b.source.workerCount ?? 0;
      const aQueued = a.source.queuedJobs ?? 0;
      const bQueued = b.source.queuedJobs ?? 0;
      const aServing = aWorkers > 0 ? 1 : 0;
      const bServing = bWorkers > 0 ? 1 : 0;
      if (aServing !== bServing) return bServing - aServing;
      const aActive = aQueued > 0 ? 1 : 0;
      const bActive = bQueued > 0 ? 1 : 0;
      if (aActive !== bActive) return bActive - aActive;
      const aUsage = a.source.usageStats?.total ?? 0;
      const bUsage = b.source.usageStats?.total ?? 0;
      return bUsage - aUsage;
    });
    return sorted.slice(0, this.inlinePreviewLimit);
  });

  copyToClipboard(text: string): void {
    navigator.clipboard.writeText(text).catch(() => {
      // Fallback: no-op if clipboard unavailable (e.g., SSR or insecure context)
    });
  }

  openModal(): void {
    this.dialogRef = this.dialog.open(this.modalTpl(), {
      hasBackdrop: true,
      backdropClass: 'model-variation-modal-backdrop',
      width: 'calc(100vw - 2rem)',
      maxWidth: '90rem',
      maxHeight: 'calc(100vh - 2rem)',
      disableClose: false,
      autoFocus: 'first-tabbable',
    });
  }

  closeModal(): void {
    this.dialogRef?.close();
    this.dialogRef = null;
  }

  private toCoverageRow(
    variation: UnifiedModelData,
    groupBaseName: string,
    index: number,
  ): VariationCoverageRow {
    const identity = this.extractVariationIdentity(variation);
    const parameters = this.extractParametersLabel(variation, identity.modelCore);
    const version = this.extractVersionLabel(variation, identity.modelCore);

    return {
      trackKey: `${variation.name}-${index}`,
      source: variation,
      apiName: variation.name,
      backend: identity.backend,
      author: identity.author,
      parameters,
      version,
      variationLabel: this.extractVariationLabel(identity.modelCore, groupBaseName, parameters, version),
      modelCore: identity.modelCore,
    };
  }

  private extractVariationIdentity(variation: UnifiedModelData): {
    backend: string | null;
    author: string | null;
    modelCore: string;
  } {
    const segments = variation.name
      .split('/')
      .map((segment) => segment.trim())
      .filter((segment) => segment.length > 0);

    const parsedBackend = variation.parsedName?.backend?.trim() || null;
    const firstSegment = segments[0]?.toLowerCase();
    const knownBackend = firstSegment && this.isKnownBackend(firstSegment) ? firstSegment : null;
    const backend = parsedBackend ?? knownBackend;

    let cursor = 0;
    if (backend && segments[cursor]?.toLowerCase() === backend.toLowerCase()) {
      cursor += 1;
    }
    if (backend && segments[cursor]?.toLowerCase() === backend.toLowerCase()) {
      cursor += 1;
    }

    const parsedAuthor = variation.parsedName?.author?.trim() || null;
    let author = parsedAuthor;
    if (!author && segments.length - cursor > 1) {
      author = segments[cursor] || null;
      cursor += 1;
    } else if (author && segments[cursor]?.toLowerCase() === author.toLowerCase()) {
      cursor += 1;
    }

    const modelCoreFromPath = segments.slice(cursor).join('/').trim();
    const modelCoreFromParser = variation.parsedName?.modelName?.trim();
    const modelCore = modelCoreFromPath || modelCoreFromParser || variation.name;

    return {
      backend,
      author,
      modelCore,
    };
  }

  private extractParametersLabel(variation: UnifiedModelData, modelCore: string): string | null {
    const parameterCount = variation['parameters'];
    if (typeof parameterCount === 'number' && Number.isFinite(parameterCount) && parameterCount > 0) {
      return this.formatParameterCount(parameterCount);
    }

    const parameterMatch = modelCore.match(/(\d+(?:\.\d+)?)\s*B\b/i);
    if (parameterMatch?.[1]) {
      return `${parameterMatch[1]}B`;
    }

    return null;
  }

  private extractVersionLabel(variation: UnifiedModelData, modelCore: string): string | null {
    const versionMatch = modelCore.match(/\bv\d+(?:\.\d+){0,3}[a-z0-9-]*/i);
    if (versionMatch?.[0]) {
      return versionMatch[0];
    }

    const versionValue = variation['version'];
    if (typeof versionValue === 'string' && versionValue.trim().length > 0) {
      const trimmedVersion = versionValue.trim();
      return trimmedVersion.startsWith('v') ? trimmedVersion : `v${trimmedVersion}`;
    }

    return null;
  }

  private extractVariationLabel(
    modelCore: string,
    groupBaseName: string,
    parameters: string | null,
    version: string | null,
  ): string | null {
    let normalized = this.stripLeadingGroupName(modelCore, groupBaseName);

    if (parameters) {
      normalized = this.stripToken(normalized, parameters);
    }
    if (version) {
      normalized = this.stripToken(normalized, version);
    }

    normalized = normalized.replace(/[-_/.\s]+/g, ' ').trim();
    return normalized.length > 0 ? normalized : null;
  }

  private stripLeadingGroupName(modelCore: string, groupBaseName: string): string {
    if (!groupBaseName) {
      return modelCore;
    }

    const lowerModel = modelCore.toLowerCase();
    const lowerGroup = groupBaseName.toLowerCase();

    if (lowerModel === lowerGroup) {
      return '';
    }

    const prefixedSeparators = ['-', '_', '.', ' ', '/'];
    for (const separator of prefixedSeparators) {
      const prefix = `${lowerGroup}${separator}`;
      if (lowerModel.startsWith(prefix)) {
        return modelCore.slice(prefix.length);
      }
    }

    return modelCore;
  }

  private stripToken(source: string, token: string): string {
    if (!token) {
      return source;
    }

    const escapedToken = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const boundaryPattern = new RegExp(`(^|[-_/.\\s])${escapedToken}(?=$|[-_/.\\s])`, 'ig');
    return source.replace(boundaryPattern, '$1');
  }

  private isKnownBackend(value: string): boolean {
    return [
      'aphrodite',
      'koboldcpp',
      'llama.cpp',
      'llamacpp',
      'exllamav2',
      'vllm',
      'tabbyapi',
      'ooba',
      'transformers',
      'openai',
    ].includes(value);
  }

  private formatParameterCount(value: number): string {
    if (value >= 1_000_000_000) {
      const billions = value / 1_000_000_000;
      return billions >= 10 ? `${Math.round(billions)}B` : `${Number(billions.toFixed(1))}B`;
    }
    if (value >= 1_000_000) {
      return `${Math.round(value / 1_000_000)}M`;
    }
    return `${Math.round(value)}`;
  }

  private getGroupBaseName(groupName: string): string {
    const segments = groupName
      .split('/')
      .map((segment) => segment.trim())
      .filter((segment) => segment.length > 0);
    return segments.length > 0 ? segments[segments.length - 1] : groupName;
  }
}
