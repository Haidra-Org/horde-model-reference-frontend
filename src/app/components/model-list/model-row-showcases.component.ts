import { Component, input, signal, ChangeDetectionStrategy, OnInit } from '@angular/core';
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
                <div
                  class="card-showcase"
                  (click)="openLightbox(idx)"
                  (keydown.enter)="openLightbox(idx)"
                  tabindex="0"
                  role="button"
                  [attr.aria-label]="'View showcase ' + (idx + 1)"
                >
                  <img
                    [src]="showcase"
                    [alt]="'Showcase ' + (idx + 1) + ' for ' + modelName()"
                    loading="lazy"
                    (error)="handleImageError($event)"
                  />
                  <div class="showcase-overlay">
                    <svg
                      class="w-10 h-10 text-white drop-shadow-lg"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m0 0v6m0-6h6m-6 0H4"
                      ></path>
                    </svg>
                  </div>
                  <div>
                    <span class="showcase-label">Image {{ idx + 1 }}</span>
                  </div>
                </div>
              }
            </div>
          </div>
        }
      </div>
    }

    <!-- Lightbox -->
    @if (selectedImageIndex() !== null && showcases(); as index) {
      <div
        class="lightbox-overlay"
        (click)="closeLightbox()"
        (keydown.escape)="closeLightbox()"
        tabindex="-1"
        role="dialog"
        [attr.aria-label]="'Image viewer'"
      >
        <div
          class="lightbox-container"
          (click)="$event.stopPropagation()"
          (keydown)="$event.stopPropagation()"
          tabindex="0"
          role="document"
        >
          <img
            [src]="showcases()![selectedImageIndex()!]"
            [alt]="'Showcase ' + (selectedImageIndex()! + 1)"
            class="lightbox-image"
          />

          @if (showcases()!.length > 1) {
            <!-- Previous Button -->
            <button
              class="lightbox-nav lightbox-nav-left"
              (click)="prevImage()"
              [attr.aria-label]="'Previous image'"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15 19l-7-7 7-7"
                ></path>
              </svg>
            </button>

            <!-- Next Button -->
            <button
              class="lightbox-nav lightbox-nav-right"
              (click)="nextImage()"
              [attr.aria-label]="'Next image'"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 5l7 7-7 7"
                ></path>
              </svg>
            </button>

            <!-- Counter -->
            <div class="lightbox-counter">
              {{ selectedImageIndex()! + 1 }} / {{ showcases()!.length }}
            </div>
          }

          <!-- Close Button -->
          <button
            class="lightbox-close"
            (click)="closeLightbox()"
            [attr.aria-label]="'Close lightbox'"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              ></path>
            </svg>
          </button>
        </div>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModelRowShowcasesComponent implements OnInit {
  readonly showcases = input<string[] | null | undefined>();
  readonly modelName = input.required<string>();
  readonly layout = input<'grid' | 'card' | 'preview'>('grid');
  readonly initiallyExpanded = input(false);
  readonly previewCount = input<number>(3);

  readonly expanded = signal(false);
  readonly selectedImageIndex = signal<number | null>(null);

  ngOnInit(): void {
    this.expanded.set(this.initiallyExpanded());
  }

  toggleExpanded(): void {
    this.expanded.set(!this.expanded());
  }

  handleImageError(event: Event): void {
    onImageError(event);
  }

  openLightbox(index: number): void {
    this.selectedImageIndex.set(index);
  }

  closeLightbox(): void {
    this.selectedImageIndex.set(null);
  }

  nextImage(): void {
    const current = this.selectedImageIndex();
    const total = this.showcases()?.length || 0;
    if (current !== null && total > 0) {
      this.selectedImageIndex.set((current + 1) % total);
    }
  }

  prevImage(): void {
    const current = this.selectedImageIndex();
    const total = this.showcases()?.length || 0;
    if (current !== null && total > 0) {
      this.selectedImageIndex.set((current - 1 + total) % total);
    }
  }
}
