import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ShowcaseComponent } from '../common/showcase/showcase.component';
import { CopyButtonComponent } from '../common/copy-button/copy-button.component';
import { IconComponent } from '../common/icon.component';
import { RECORD_DISPLAY_MAP } from '../../models/maps';
import { domainMeta } from '../../shared/domain';
import type { BrowseModel } from '../../services/browse-models.service';

@Component({
  selector: 'app-model-identity-rail',
  imports: [ShowcaseComponent, CopyButtonComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="glass-inflow identity-rail"
      [class.accent-top-image]="dmn().domain === 'image'"
      [class.accent-top-text]="dmn().domain === 'text'"
      [class.accent-top-utility]="dmn().domain === 'utility'"
    >
      <!-- Showcase -->
      <app-showcase
        [src]="showcaseSrc()"
        [alt]="'Showcase for ' + displayName()"
        [name]="model().name"
        [width]="320"
        [height]="isText() ? 110 : 200"
      />

      <div class="identity-rail-body">
        <!-- Badges -->
        <div class="identity-rail-badges">
          <span
            class="badge"
            [class.badge-blue]="dmn().domain === 'image'"
            [class.badge-purple]="dmn().domain === 'text'"
            [class.badge-info]="dmn().domain === 'utility'"
          >
            <app-icon [name]="dmn().icon" />
            {{ categoryLabel() }}
          </span>
          @if (model().nsfw) {
            <span class="badge badge-danger">NSFW</span>
          }
          @if (uncensored()) {
            <span class="badge badge-warning">Uncensored</span>
          }
          @for (tag of tags(); track tag) {
            <span class="badge badge-gray">{{ tag }}</span>
          }
        </div>

        <!-- Name -->
        <div class="identity-rail-name">{{ displayName() }}</div>

        <!-- Description -->
        <div class="identity-rail-desc">
          {{ model().description || 'No description provided.' }}
        </div>

        <div class="divider"></div>

        <!-- Key-Value rows -->
        <div class="kv-row">
          <span class="kv-label">Identifier</span>
          <span class="kv-value kv-mono">
            {{ model().name }}
            <app-copy-button [text]="model().name" [ariaLabel]="'Copy identifier'" />
          </span>
        </div>

        @if (model().version) {
          <div class="kv-row">
            <span class="kv-label">Version</span>
            <span class="kv-value">{{ model().version }}</span>
          </div>
        }

        <div class="kv-row">
          <span class="kv-label">Domain · purpose</span>
          <span class="kv-value">{{ classification() }}</span>
        </div>

        <div class="kv-row">
          <span class="kv-label">Added</span>
          <span class="kv-value">{{ addedDate() }}</span>
        </div>

        <div class="kv-row">
          <span class="kv-label">Last updated</span>
          <span class="kv-value">{{ updatedDate() }}</span>
        </div>
      </div>
    </div>
  `,
})
export class ModelIdentityRailComponent {
  readonly model = input.required<BrowseModel>();
  readonly showcaseSrc = input<string | null | undefined>();

  protected readonly dmn = computed(() => domainMeta(this.model().category ?? ''));
  protected readonly displayName = computed(() => this.model().display_name ?? this.model().name);
  protected readonly isText = computed(() => this.dmn().domain === 'text');

  protected readonly categoryLabel = computed(
    () => RECORD_DISPLAY_MAP[this.model().category ?? ''] ?? this.model().category ?? '',
  );

  protected readonly categoryBadgeClass = computed(() => {
    const d = this.dmn().domain;
    if (d === 'image') return 'badge-blue';
    if (d === 'text') return 'badge-purple';
    return 'badge-info';
  });

  protected readonly classification = computed(() => {
    const raw = this.model()._raw;
    const cls = (raw as Record<string, unknown>)?.['model_classification'] as
      { domain?: string; purpose?: string } | undefined;
    const domain = cls?.domain ?? this.dmn().label;
    const purpose = cls?.purpose ?? '—';
    return `${domain} · ${purpose}`;
  });

  protected readonly uncensored = computed(() => {
    return (this.model()._raw as Record<string, unknown>)?.['uncensored'] === true;
  });

  protected readonly tags = computed(() => {
    const tags = this.model().tags;
    if (!tags || !tags.length) return [];
    // Show up to 4 tag badges
    return tags.slice(0, 4);
  });

  protected readonly addedDate = computed(() => {
    const meta = (this.model()._raw as Record<string, unknown>)?.['metadata'] as
      { added?: string } | undefined;
    return meta?.added ? this.fmtDate(meta.added) : '—';
  });

  protected readonly updatedDate = computed(() => {
    const meta = (this.model()._raw as Record<string, unknown>)?.['metadata'] as
      { updated?: string; author?: string } | undefined;
    if (!meta?.updated) return '—';
    let result = this.fmtDate(meta.updated);
    if (meta.author) result += ` · ${meta.author}`;
    return result;
  });

  private fmtDate(iso: string): string {
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return iso;
    }
  }
}
