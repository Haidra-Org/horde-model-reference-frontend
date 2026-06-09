import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';

/**
 * Gradients for deterministic showcase fallbacks, keyed by model name.
 * Mirrors the prototype's color mapping for image models.
 */
const GRADIENT_PAIRS: string[][] = [
  ['#3b82f6', '#1d4ed8'],
  ['#8b5cf6', '#6d28d9'],
  ['#06b6d4', '#0891b2'],
  ['#10b981', '#047857'],
  ['#f59e0b', '#b45309'],
  ['#ef4444', '#b91c1c'],
  ['#ec4899', '#be185d'],
  ['#6366f1', '#4338ca'],
  ['#14b8a6', '#0f766e'],
  ['#f97316', '#c2410c'],
];

@Component({
  selector: 'app-showcase',
  imports: [NgOptimizedImage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (src() && !imgError()) {
      <img
        [ngSrc]="src()!"
        [alt]="alt()"
        [width]="width()"
        [height]="height()"
        class="showcase-image"
        (error)="onImgError()"
      />
    } @else {
      <div
        class="showcase-fallback"
        [style.background]="gradientStyle()"
        [style.width.px]="width()"
        [style.height.px]="height()"
        [style.minHeight.px]="height()"
        role="img"
        [attr.aria-label]="alt() + ' placeholder'"
      >
        <span class="showcase-initials">{{ initials() }}</span>
      </div>
    }
  `,
})
export class ShowcaseComponent {
  readonly src = input<string | null | undefined>();
  readonly alt = input('');
  readonly name = input('');
  readonly width = input(320);
  readonly height = input(180);

  protected readonly imgError = signal(false);

  protected readonly initials = computed(() => {
    const n = this.name() || '??';
    return (
      n
        .replace(/[^A-Za-z0-9]/g, '')
        .slice(0, 2)
        .toUpperCase() || '??'
    );
  });

  /** Deterministic gradient based on the model name. */
  protected readonly gradientStyle = computed(() => {
    const n = this.name();
    let hash = 0;
    for (let i = 0; i < n.length; i++) {
      hash = n.charCodeAt(i) + ((hash << 5) - hash);
    }
    const pair = GRADIENT_PAIRS[Math.abs(hash) % GRADIENT_PAIRS.length];
    return `linear-gradient(135deg, ${pair[0]}, ${pair[1]})`;
  });

  protected onImgError(): void {
    this.imgError.set(true);
  }
}
