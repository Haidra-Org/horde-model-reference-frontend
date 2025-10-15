import { Component, input, signal, ChangeDetectionStrategy } from '@angular/core';
import { onImageError } from './model-row.utils';

@Component({
  selector: 'app-model-row-showcases',
  template: `
    @if (showcases() && showcases()!.length > 0) {
      <div [class.col-span-4]="layout() === 'grid'" [class.md:col-span-2]="layout() === 'card'">
        <div class="flex items-center justify-between">
          <button
            type="button"
            class="text-sm link flex items-center gap-1"
            (click)="toggleExpanded()"
          >
            @if (expanded()) {
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M5 15l7-7 7 7"
                ></path>
              </svg>
              Hide {{ layout() === 'grid' ? 'Showcases' : 'Images' }}
            } @else {
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M19 9l-7 7-7-7"
                ></path>
              </svg>
              Show {{ layout() === 'grid' ? 'Showcases' : 'Images' }}
            }
          </button>
        </div>
        @if (expanded()) {
          <div class="mt-2 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            @for (showcase of showcases(); track showcase; let idx = $index) {
              <div
                class="group relative aspect-square overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800"
              >
                <img
                  [src]="showcase"
                  [alt]="'Showcase ' + (idx + 1) + ' for ' + modelName()"
                  class="w-full h-full object-cover transition-transform duration-200 group-hover:scale-110"
                  loading="lazy"
                  (error)="handleImageError($event)"
                />
                <a
                  [href]="showcase"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
                  [attr.aria-label]="'Open showcase ' + (idx + 1) + ' in new tab'"
                >
                  <svg
                    class="w-8 h-8 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    ></path>
                  </svg>
                </a>
              </div>
            }
          </div>
        }
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModelRowShowcasesComponent {
  readonly showcases = input<string[] | null | undefined>();
  readonly modelName = input.required<string>();
  readonly layout = input<'grid' | 'card'>('grid');
  readonly initiallyExpanded = input(false);

  readonly expanded = signal(false);

  ngOnInit(): void {
    this.expanded.set(this.initiallyExpanded());
  }

  toggleExpanded(): void {
    this.expanded.set(!this.expanded());
  }

  handleImageError(event: Event): void {
    onImageError(event);
  }
}
