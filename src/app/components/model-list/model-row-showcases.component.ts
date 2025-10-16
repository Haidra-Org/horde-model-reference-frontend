import { Component, input, signal, ChangeDetectionStrategy } from '@angular/core';
import { onImageError } from './model-row.utils';

@Component({
  selector: 'app-model-row-showcases',
  template: `
    @if (showcases() && showcases()!.length > 0) {
      <div class="card">
        <div class="card-header">
          <h4 class="heading-card flex items-center gap-2">
            <svg
              class="w-5 h-5 text-info-600 dark:text-info-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              ></path>
            </svg>
            Showcases
            <span class="badge badge-info ml-2">{{ showcases()!.length }}</span>
          </h4>
        </div>
        <div class="card-body">
          <button
            type="button"
            class="btn btn-sm btn-secondary flex items-center gap-1.5"
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
              Hide
            } @else {
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M19 9l-7 7-7-7"
                ></path>
              </svg>
              Show
            }
          </button>
        </div>
        @if (expanded()) {
          <div class="card-body">
            <div
              class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4"
            >
              @for (showcase of showcases(); track showcase; let idx = $index) {
                <div class="card-showcase">
                  <img
                    [src]="showcase"
                    [alt]="'Showcase ' + (idx + 1) + ' for ' + modelName()"
                    loading="lazy"
                    (error)="handleImageError($event)"
                  />
                  <a
                    [href]="showcase"
                    target="_blank"
                    rel="noopener noreferrer"
                    [attr.aria-label]="'Open showcase ' + (idx + 1) + ' in new tab'"
                  >
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      ></path>
                    </svg>
                  </a>
                  <div>
                    <span class="text-white text-xs font-medium">Image {{ idx + 1 }}</span>
                  </div>
                </div>
              }
            </div>
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
