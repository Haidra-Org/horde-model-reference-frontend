import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';

@Component({
  selector: 'app-name-composition-preview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-wrap items-center gap-0.5 font-mono text-sm">
      @if (author()) {
        <span
          class="px-1.5 py-0.5 rounded bg-info-100 dark:bg-info-900/30 text-info-700 dark:text-info-300"
          >{{ author() }}/</span
        >
      }
      @for (part of orderedParts(); track part.key) {
        <span [class]="part.classes">{{ part.prefix }}{{ part.value }}</span>
      }
    </div>
    <div class="mt-1 text-xs text-muted flex items-center gap-2">
      <span class="font-mono">{{ composedName() }}</span>
      @if (alreadyExists()) {
        <span class="text-danger-600 dark:text-danger-400 font-medium">Already exists</span>
      } @else if (composedName()) {
        <span class="text-success-600 dark:text-success-400">Available</span>
      }
    </div>
  `,
})
export class NameCompositionPreviewComponent {
  readonly author = input<string | null>(null);
  readonly baseName = input.required<string>();
  readonly size = input<string | null>(null);
  readonly variant = input<string | null>(null);
  readonly version = input<string | null>(null);
  readonly quant = input<string | null>(null);
  readonly separator = input<string>('-');
  readonly composedName = input<string>('');
  readonly alreadyExists = input(false);

  private static readonly PART_STYLES: Record<string, string> = {
    base: 'px-1.5 py-0.5 rounded bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300',
    size: 'px-1.5 py-0.5 rounded bg-info-100 dark:bg-info-900/30 text-info-700 dark:text-info-300',
    variant:
      'px-1.5 py-0.5 rounded bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-300',
    version: 'px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
    quant:
      'px-1.5 py-0.5 rounded bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-300',
  };

  readonly orderedParts = computed(() => {
    const sep = this.separator();
    const allParts: { key: string; value: string | null }[] = [
      { key: 'base', value: this.baseName() },
      { key: 'size', value: this.size() },
      { key: 'version', value: this.version() },
      { key: 'variant', value: this.variant() },
      { key: 'quant', value: this.quant() },
    ];

    return allParts
      .filter((p) => p.value)
      .map((p, i) => ({
        key: p.key,
        value: p.value!,
        prefix: i === 0 ? '' : sep,
        classes: NameCompositionPreviewComponent.PART_STYLES[p.key] ?? '',
      }));
  });
}
