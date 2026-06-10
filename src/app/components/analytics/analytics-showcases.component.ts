import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ModelReferenceApiService } from '../../services/model-reference-api.service';
import { catchError, map, of } from 'rxjs';
import { NgOptimizedImage } from '@angular/common';

interface ShowcaseModel {
  name: string;
  display_name?: string | null;
  showcases: string[];
}

/**
 * AnalyticsShowcasesComponent — gallery of models with showcase images.
 * Reuses Browse gallery patterns with NgOptimizedImage.
 * Includes a focus-trapped lightbox for full-size preview.
 */
@Component({
  selector: 'app-analytics-showcases',
  imports: [NgOptimizedImage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="analytics-tab-content">
      <!-- Loading -->
      @if (loading()) {
        <div class="glass-inflow" style="padding:24px;text-align:center">
          <p style="color:var(--color-content-muted)">Loading showcases…</p>
        </div>
      }

      <!-- Gallery -->
      @if (!loading() && showcaseModels().length) {
        <div class="showcase-gallery-grid">
          @for (m of showcaseModels(); track m.name) {
            @for (img of m.showcases; track img) {
              <button
                type="button"
                class="card-showcase"
                (click)="openLightbox(img, m.display_name ?? m.name)"
                (keydown.enter)="openLightbox(img, m.display_name ?? m.name)"
                (keydown.space)="
                  $event.preventDefault(); openLightbox(img, m.display_name ?? m.name)
                "
                [attr.aria-label]="'View showcase for ' + (m.display_name ?? m.name)"
              >
                <img
                  [ngSrc]="img"
                  [alt]="'Showcase for ' + (m.display_name ?? m.name)"
                  width="200"
                  height="200"
                  loading="lazy"
                />
                <div class="card-showcase-overlay">
                  <span class="card-showcase-label">{{ m.display_name ?? m.name }}</span>
                </div>
              </button>
            }
          }
        </div>
      } @else if (!loading()) {
        <div class="glass-inflow" style="padding:40px;text-align:center">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-content-muted)"
            style="margin:0 auto 12px"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <p style="font-weight:600;color:var(--color-content-secondary)">No showcase images</p>
          <p style="font-size:13px;color:var(--color-content-muted);margin-top:4px">
            Models in this category don't have showcase images yet.
          </p>
        </div>
      }

      <!-- Lightbox -->
      @if (lightboxSrc()) {
        <div
          class="lightbox-scrim"
          role="dialog"
          aria-modal="true"
          tabindex="-1"
          [attr.aria-label]="'Showcase: ' + lightboxLabel()"
          (keyup)="closeLightbox()"
          (click)="onScrimClick($event)"
        >
          <div class="lightbox-content">
            <button
              type="button"
              class="lightbox-close"
              (click)="closeLightbox()"
              aria-label="Close showcase"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
            <img
              [ngSrc]="lightboxSrc()!"
              [alt]="lightboxLabel()"
              width="800"
              height="800"
              priority
            />
          </div>
        </div>
      }
    </div>
  `,
})
export class AnalyticsShowcasesComponent implements OnInit {
  readonly category = input.required<string>();

  private readonly api = inject(ModelReferenceApiService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly showcaseModels = signal<ShowcaseModel[]>([]);

  // Lightbox
  protected readonly lightboxSrc = signal<string | null>(null);
  protected readonly lightboxLabel = signal('');

  ngOnInit(): void {
    this.api
      .getDisplayModelsAsArray(this.category())
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        map((records) => this.extractShowcases(records)),
        catchError(() => of([])),
      )
      .subscribe((models) => {
        this.showcaseModels.set(models);
        this.loading.set(false);
      });
  }

  private extractShowcases(records: unknown[]): ShowcaseModel[] {
    const result: ShowcaseModel[] = [];
    for (const r of records) {
      const rec = r as Record<string, unknown>;
      const showcases = rec['showcases'] as string[] | null | undefined;
      const showcase = rec['showcase'] as string | null | undefined;
      const images = rec['showcase_images'] as string[] | null | undefined;
      const allImages = [...(showcases ?? []), ...(showcase ? [showcase] : []), ...(images ?? [])];
      if (allImages.length > 0) {
        result.push({
          name: String(rec['name'] ?? ''),
          display_name: (rec['display_name'] as string | null | undefined) ?? null,
          showcases: allImages,
        });
      }
    }
    return result;
  }

  protected openLightbox(src: string, label: string): void {
    this.lightboxSrc.set(src);
    this.lightboxLabel.set(label);
  }

  protected onScrimClick(event: MouseEvent): void {
    // Only close if the scrim itself was clicked (not the content)
    if ((event.target as HTMLElement).classList.contains('lightbox-scrim')) {
      this.closeLightbox();
    }
  }

  protected closeLightbox(): void {
    this.lightboxSrc.set(null);
    this.lightboxLabel.set('');
  }
}
