import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CdkOverlayOrigin, CdkConnectedOverlay, ConnectedPosition } from '@angular/cdk/overlay';
import { IconComponent } from '../../common/icon.component';
import { domainMeta, domainOf, type ModelDomain } from '../../../shared/domain';
import { RECORD_DISPLAY_MAP } from '../../../models/maps';

type SelectorGroupKey = 'generation' | 'utility';

interface SelectorGroup {
  key: SelectorGroupKey;
  label: string;
  cats: string[];
}

/**
 * Coarse domains collapse into two user-facing buckets: anything that produces output
 * (image/text/video/audio) is "Generation"; helper models (upscalers, clip, controlnet, …)
 * are "Utility".
 */
const GROUP_ORDER: { key: SelectorGroupKey; label: string; domains: ModelDomain[] }[] = [
  { key: 'generation', label: 'Generation', domains: ['image', 'text'] },
  { key: 'utility', label: 'Utility', domains: ['utility'] },
];

/**
 * Compact replacement for the always-visible category rail: a single trigger that opens a
 * grouped popover. Drop-in compatible with the rail's inputs so Browse and Analytics can swap
 * it in without other changes.
 */
@Component({
  selector: 'app-category-selector',
  imports: [RouterLink, IconComponent, CdkOverlayOrigin, CdkConnectedOverlay],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="category-selector">
      <button
        type="button"
        class="category-selector__trigger"
        [class]="'category-selector__trigger--' + activeDomain()"
        [class.category-selector__trigger--open]="open()"
        cdkOverlayOrigin
        #selectorOrigin="cdkOverlayOrigin"
        (click)="toggle()"
        [attr.aria-expanded]="open()"
        aria-haspopup="listbox"
        aria-controls="category-selector-popover"
      >
        <app-icon [name]="activeMeta().icon" />
        <span class="category-selector__trigger-label">{{ activeLabel() }}</span>
        <span class="category-selector__trigger-count">{{ activeCount() }}</span>
        <svg
          class="category-selector__chevron"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 9l6 6 6-6" />
        </svg>
      </button>

      <ng-template
        cdkConnectedOverlay
        [cdkConnectedOverlayOrigin]="selectorOrigin"
        [cdkConnectedOverlayOpen]="open()"
        [cdkConnectedOverlayPositions]="overlayPositions"
        [cdkConnectedOverlayHasBackdrop]="false"
        (overlayOutsideClick)="close()"
        (overlayKeydown)="onOverlayKeydown($event)"
        (detach)="close()"
      >
        <div
          id="category-selector-popover"
          class="category-selector__popover glass-overlay"
          role="listbox"
          aria-label="Model categories"
        >
          @for (group of groupedCategories(); track group.key) {
            <div class="category-selector__group">
              <div class="category-selector__group-label">{{ group.label }}</div>
              @for (cat of group.cats; track cat) {
                @let isActive = cat === activeCategory();
                <a
                  class="category-selector__item"
                  [class]="'category-selector__item--' + domainFor(cat)"
                  [class.category-selector__item--active]="isActive"
                  [routerLink]="linkFor(cat)"
                  [queryParams]="queryParamsFor(cat)"
                  [queryParamsHandling]="variant() === 'analytics' ? 'merge' : ''"
                  role="option"
                  [attr.aria-selected]="isActive"
                  [attr.aria-current]="isActive ? 'page' : null"
                  (click)="close()"
                >
                  <app-icon [name]="metaFor(cat).icon" />
                  <span class="category-selector__item-label">{{ displayName(cat) }}</span>
                  <span class="category-selector__item-count">{{ countFor(cat) }}</span>
                </a>
              }
            </div>
          }
        </div>
      </ng-template>
    </div>
  `,
})
export class CategorySelectorComponent {
  readonly activeCategory = input.required<string>();
  readonly counts = input<Map<string, number>>(new Map());

  /** All model reference categories (from the API enum values). */
  readonly categories = input.required<string[]>();

  /**
   * Where items navigate. 'browse' (default) opens the browse page; 'analytics' stays on the
   * analytics page, switching only the category query param.
   */
  readonly variant = input<'browse' | 'analytics'>('browse');

  readonly open = signal(false);

  /** CDK overlay positions: prefer below the trigger, fall back to above. */
  readonly overlayPositions: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 6 },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -6 },
  ];

  readonly groupedCategories = computed<SelectorGroup[]>(() => {
    const cats = this.categories();
    return GROUP_ORDER.map(({ key, label, domains }) => ({
      key,
      label,
      cats: cats.filter((c) => domains.includes(domainOf(c))),
    })).filter((g) => g.cats.length > 0);
  });

  readonly activeMeta = computed(() => domainMeta(this.activeCategory()));
  readonly activeDomain = computed<ModelDomain>(() => domainOf(this.activeCategory()));
  readonly activeLabel = computed(() => this.displayName(this.activeCategory()));
  readonly activeCount = computed(() => this.countFor(this.activeCategory()));

  toggle(): void {
    this.open.update((v) => !v);
  }

  close(): void {
    this.open.set(false);
  }

  onOverlayKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.close();
    }
  }

  linkFor(cat: string): (string | undefined)[] {
    return this.variant() === 'analytics' ? ['/analytics'] : ['/categories', cat];
  }

  queryParamsFor(cat: string): Record<string, string> | null {
    return this.variant() === 'analytics' ? { category: cat } : null;
  }

  displayName(cat: string): string {
    return RECORD_DISPLAY_MAP[cat] ?? cat;
  }

  countFor(cat: string): string {
    const c = this.counts().get(cat);
    return c !== undefined ? String(c) : '—';
  }

  metaFor(cat: string) {
    return domainMeta(cat);
  }

  domainFor(cat: string): ModelDomain {
    return domainOf(cat);
  }
}
