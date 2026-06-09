import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MODEL_REFERENCE_CATEGORY } from '../../api-client';
import { domainMeta } from '../../shared/domain';
import { IconComponent } from '../common/icon.component';

@Component({
  selector: 'app-endpoint-banner',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="glass-inflow endpoint-banner">
      <!-- Domain badge -->
      <span class="badge" [class]="domainAccentClass()">
        <app-icon [name]="domainIcon()" />
        {{ categoryLabel() }}
      </span>

      <!-- Inline Image/Text switch for create mode (image/text categories only) -->
      @if (!isEdit() && isSwitcherCategory()) {
        <div class="endpoint-banner-switcher" role="radiogroup" aria-label="Category">
          @for (opt of switcherOptions; track opt.value) {
            <button
              type="button"
              class="endpoint-banner-switch-option"
              [class.endpoint-banner-switch-option--active]="category() === opt.value"
              [attr.aria-checked]="category() === opt.value"
              role="radio"
              (click)="onSwitch(opt.value)"
            >
              {{ opt.label }}
            </button>
          }
        </div>
      }

      <div class="endpoint-banner-spacer"></div>

      <!-- Endpoint string -->
      <span class="endpoint-banner-endpoint">
        <span class="badge badge-secondary badge-xs">{{ versionBadge() }}</span>
        <code>{{ endpoint() }}</code>
      </span>
    </div>
  `,
})
export class EndpointBannerComponent {
  readonly category = input.required<string>();
  readonly isEdit = input(false);
  readonly endpoint = input('');
  readonly categoryChange = output<string>();

  readonly domainMeta = computed(() => {
    const cat = this.category();
    return cat ? domainMeta(cat) : domainMeta('miscellaneous');
  });
  readonly domainAccentClass = computed(() => `badge-${this.domainMeta().accentClass}`);
  readonly domainIcon = computed(() => this.domainMeta().icon);
  readonly categoryLabel = computed(() => {
    const cat = this.category();
    if (!cat) return '';
    return cat.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  });

  readonly versionBadge = computed(() => (this.endpoint().includes('/v1/') ? 'v1' : 'v2'));

  readonly isSwitcherCategory = computed(() => {
    const c = this.category();
    return (
      c === MODEL_REFERENCE_CATEGORY.ImageGeneration ||
      c === MODEL_REFERENCE_CATEGORY.TextGeneration
    );
  });

  readonly switcherOptions = [
    { value: MODEL_REFERENCE_CATEGORY.ImageGeneration, label: 'Image' },
    { value: MODEL_REFERENCE_CATEGORY.TextGeneration, label: 'Text' },
  ];

  onSwitch(value: string): void {
    if (value !== this.category()) {
      this.categoryChange.emit(value);
    }
  }
}
