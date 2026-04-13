import { Component, input, ChangeDetectionStrategy, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HordeBadgeComponent } from '@haidra/design-system/badge';
import type { UnifiedModelData, GroupedTextModel } from '../../models/unified-model';

interface VariationCoverageRow {
  trackKey: string;
  source: UnifiedModelData;
  backend: string | null;
  author: string | null;
  parameters: string | null;
  version: string | null;
  variationLabel: string | null;
  modelCore: string;
}

@Component({
  selector: 'app-model-row-variations',
  imports: [RouterLink, HordeBadgeComponent],
  template: `
    <section class="detail-panel model-detail-panel model-detail-panel--variations">
      <div class="model-variation-header">
        <div class="model-variation-header-content">
          <h4 class="detail-section-heading model-detail-section-heading-strong">
            Variation Coverage Matrix
          </h4>
          <p class="model-variation-subtitle">
            Decomposed variant identity for grouped text models.
          </p>
        </div>
        <a
          class="btn btn-sm btn-primary"
          [routerLink]="['/categories', 'text_generation', 'group', groupName()]"
        >
          Manage Group
        </a>
      </div>

      <div class="model-variation-metrics-grid">
        <article class="model-variation-metric-card">
          <span class="model-variation-metric-label">Variants</span>
          <span class="model-variation-metric-value">{{ variationCount() }}</span>
        </article>
        <article class="model-variation-metric-card">
          <span class="model-variation-metric-label">Active Variants</span>
          <span class="model-variation-metric-value">{{ activeVariationCount() }}</span>
        </article>
        <article class="model-variation-metric-card">
          <span class="model-variation-metric-label">Total Workers</span>
          <span class="model-variation-metric-value">{{ totalWorkers() }}</span>
        </article>
        <article class="model-variation-metric-card">
          <span class="model-variation-metric-label">Queued Jobs</span>
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

      <div class="model-variation-table-meta">
        <span class="model-variation-table-count">
          Showing {{ visibleVariationRows().length }} of {{ variationRows().length }} variants
        </span>
        @if (variationRows().length > rowDisplayLimit()) {
          <button
            type="button"
            class="btn btn-sm btn-secondary"
            (click)="toggleShowAllRows()"
          >
            {{ showAllRows() ? 'Show compact view' : 'Show all variants' }}
          </button>
        }
      </div>

      <div class="model-variation-table-shell">
        <table class="w-full text-sm model-variation-table model-variation-table--dense">
          <colgroup>
            <col class="model-variation-col-backend" />
            <col class="model-variation-col-params" />
            <col class="model-variation-col-version" />
            <col class="model-variation-col-author" />
            <col class="model-variation-col-variation" />
            <col class="model-variation-col-workers" />
            <col class="model-variation-col-queued" />
            <col class="model-variation-col-usage" />
            <col class="model-variation-col-state" />
          </colgroup>
          <thead class="table-head-subtle">
            <tr class="border-b border-gray-200 dark:border-gray-700">
              <th class="table-header-cell-xs-caps">Backend</th>
              <th class="table-header-cell-xs-center-caps">Params</th>
              <th class="table-header-cell-xs-center-caps">Version</th>
              <th class="table-header-cell-xs-caps">Author</th>
              <th class="table-header-cell-xs-caps">Variation</th>
              <th class="table-header-cell-xs-center-caps">Workers</th>
              <th class="table-header-cell-xs-center-caps">Queued</th>
              <th class="table-header-cell-xs-right-caps">Usage</th>
              <th class="table-header-cell-xs-center-caps">State</th>
            </tr>
          </thead>
          <tbody class="table-body-default">
            @for (row of visibleVariationRows(); track row.trackKey) {
              <tr class="table-row-hover-subtle">
                <td class="table-cell-xs">
                  @if (row.backend) {
                    <horde-badge variant="info" class="text-xs">{{ row.backend }}</horde-badge>
                  } @else {
                    <span class="table-cell-muted-xs-inline">-</span>
                  }
                </td>
                <td class="table-cell-xs-center">
                  @if (row.parameters) {
                    <span class="model-variation-meta-pill" [title]="row.modelCore">
                      {{ row.parameters }}
                    </span>
                  } @else {
                    <span class="model-variation-meta-pill model-variation-meta-pill--empty">-</span>
                  }
                </td>
                <td class="table-cell-xs-center">
                  @if (row.version) {
                    <span class="model-variation-meta-pill" [title]="row.modelCore">
                      {{ row.version }}
                    </span>
                  } @else {
                    <span class="model-variation-meta-pill model-variation-meta-pill--empty">-</span>
                  }
                </td>
                <td class="table-cell-xs">
                  @if (row.author) {
                    <span class="model-variation-cell-truncate" [title]="row.author">{{ row.author }}</span>
                  } @else {
                    <span class="table-cell-muted-xs-inline">-</span>
                  }
                </td>
                <td class="table-cell-xs">
                  @if (row.variationLabel) {
                    <span class="model-variation-cell-truncate" [title]="row.modelCore">
                      {{ row.variationLabel }}
                    </span>
                  } @else {
                    <span class="table-cell-muted-xs-inline">Base</span>
                  }
                </td>
                <td class="table-cell-xs-center">
                  {{ row.source.workerCount ?? 0 }}
                </td>
                <td class="table-cell-xs-center">
                  {{ row.source.queuedJobs ?? 0 }}
                </td>
                <td class="table-cell-xs-right">
                  {{ row.source.usageStats?.total ?? 0 }}
                </td>
                <td class="table-cell-xs-center">
                  @if ((row.source.workerCount ?? 0) > 0) {
                    <span class="model-variation-state-pill model-variation-state-pill--serving">
                      Serving
                    </span>
                  } @else if ((row.source.queuedJobs ?? 0) > 0) {
                    <span class="model-variation-state-pill model-variation-state-pill--queued">
                      Queued
                    </span>
                  } @else {
                    <span class="model-variation-state-pill model-variation-state-pill--idle">
                      Idle
                    </span>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </section>
  `,
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModelRowVariationsComponent {
  readonly variations = input.required<UnifiedModelData[]>();
  readonly groupName = input.required<string>();
  readonly groupSummary = input<GroupedTextModel['groupSummary']>();
  readonly showAllRows = signal(false);

  readonly variationCount = computed(() => this.variations().length);

  readonly rowDisplayLimit = computed(() => 16);

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

  readonly visibleVariationRows = computed(() => {
    const rows = this.variationRows();
    if (this.showAllRows() || rows.length <= this.rowDisplayLimit()) {
      return rows;
    }
    return rows.slice(0, this.rowDisplayLimit());
  });

  toggleShowAllRows(): void {
    this.showAllRows.update((current) => !current);
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
