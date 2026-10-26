import {
  afterNextRender,
  afterRenderEffect,
  DestroyRef,
  signal,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  output,
} from '@angular/core';

/** A clear action beside a projected, independently labeled form control. */
@Component({
  selector: 'app-clearable-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': '"write-clearable-field write-clearable-field--" + width()' },
  template: `
    <ng-content />
    @if (filled() && !disabled()) {
      <button
        type="button"
        class="write-field-clear"
        [style.left.px]="position().left"
        [style.top.px]="position().top"
        [attr.aria-label]="'Clear ' + label()"
        (click)="clear()"
      >
        Clear
      </button>
    }
  `,
})
export class ClearableFieldComponent {
  readonly label = input.required<string>();
  readonly filled = input(false);
  readonly disabled = input(false);
  readonly width = input<'standard' | 'short' | 'wide' | 'url'>('standard');
  readonly cleared = output<void>();
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly position = signal({ left: 0, top: 0 });
  constructor() {
    const destroyRef = inject(DestroyRef);
    afterRenderEffect(() => {
      this.filled();
      this.width();
      this.positionButton();
    });
    afterNextRender(() => {
      const control = this.element.nativeElement.querySelector('input, textarea, select');
      if (!control || typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver(() => this.positionButton());
      observer.observe(control);
      observer.observe(this.element.nativeElement);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }
  private positionButton(): void {
    const host = this.element.nativeElement;
    const control = host.querySelector('input, textarea, select');
    if (!control) return;
    const field = control.getBoundingClientRect();
    const bounds = host.getBoundingClientRect();
    this.position.set({
      left: field.right - bounds.left + 6,
      top: field.top - bounds.top + Math.max(0, (Math.min(field.height, 44) - 32) / 2),
    });
  }
  clear(): void {
    this.cleared.emit();
    const control = this.element.nativeElement.querySelector<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >('input, textarea, select');
    // Also discard an invalid draft whose last valid bound value was already empty.
    if (control?.tagName !== 'SELECT' && control) control.value = '';
    control?.focus();
  }
}
