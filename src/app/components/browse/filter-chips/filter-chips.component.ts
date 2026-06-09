import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { IconComponent } from '../../common/icon.component';
import {
  SegmentedControlComponent,
  SegmentedOption,
} from '../../../../shared/design-system/components/segmented-control/segmented-control.component';
import type { Facets, NsfwFilter } from '../../../services/browse-models.service';

@Component({
  selector: 'app-filter-chips',
  imports: [IconComponent, SegmentedControlComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      style="display:flex;gap:18px;flex-wrap:wrap;align-items:center;row-gap:11px;margin-bottom:12px"
    >
      <!-- Baseline filter (image domain) -->
      @if (showBaselines()) {
        <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center">
          <span class="filter-chips-label">Baseline</span>
          @for (opt of facets().baselines; track opt.value) {
            <button
              type="button"
              class="filter-chip"
              [class.filter-chip--active]="activeBaselines().includes(opt.value)"
              [attr.aria-pressed]="activeBaselines().includes(opt.value)"
              (click)="toggleBaseline(opt.value)"
            >
              {{ opt.label }}<span class="filter-chip__count">{{ opt.count }}</span>
            </button>
          }
        </div>
      }

      <!-- Style filter (image domain) -->
      @if (showStyles()) {
        <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center">
          <span class="filter-chips-label">Style</span>
          @for (opt of facets().styles; track opt.value) {
            <button
              type="button"
              class="filter-chip"
              style="--chip-accent:var(--color-accent-text)"
              [class.filter-chip--active]="activeStyles().includes(opt.value)"
              [attr.aria-pressed]="activeStyles().includes(opt.value)"
              (click)="toggleStyle(opt.value)"
            >
              {{ opt.label }}<span class="filter-chip__count">{{ opt.count }}</span>
            </button>
          }
        </div>
      }

      <!-- Family filter (text domain) -->
      @if (showFamilies()) {
        <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center">
          <span class="filter-chips-label">Family</span>
          @for (opt of facets().families; track opt.value) {
            <button
              type="button"
              class="filter-chip"
              style="--chip-accent:var(--color-accent-text)"
              [class.filter-chip--active]="activeFamilies().includes(opt.value)"
              [attr.aria-pressed]="activeFamilies().includes(opt.value)"
              (click)="toggleFamily(opt.value)"
            >
              {{ opt.label }}<span class="filter-chip__count">{{ opt.count }}</span>
            </button>
          }
        </div>
      }

      <!-- Safety filter -->
      @if (showSafety()) {
        <div style="display:flex;gap:6px;align-items:center">
          <span class="filter-chips-label">Safety</span>
          <app-segmented-control
            size="sm"
            [options]="safetyOptions"
            [(value)]="nsfwFilter"
            ariaLabel="Safety filter"
          />
        </div>
      }

      <!-- Pending-only toggle -->
      @if (hasPending()) {
        <button
          type="button"
          class="filter-chip"
          style="--chip-accent:var(--color-accent-pending)"
          [class.filter-chip--active]="pendingOnly()"
          [attr.aria-pressed]="pendingOnly()"
          (click)="pendingOnly.set(!pendingOnly())"
        >
          <app-icon name="clock" />Pending only
        </button>
      }
    </div>
  `,
})
export class FilterChipsComponent {
  readonly facets = input.required<Facets>();
  readonly activeBaselines = model<string[]>([]);
  readonly activeStyles = model<string[]>([]);
  readonly activeFamilies = model<string[]>([]);
  readonly nsfwFilter = model<NsfwFilter>('all');
  readonly pendingOnly = model(false);
  readonly hasPending = input(false);
  readonly isImageDomain = input(false);
  readonly isTextDomain = input(false);

  readonly showBaselines = input(false);
  readonly showStyles = input(false);
  readonly showFamilies = input(false);
  readonly showSafety = input(false);

  readonly safetyOptions: SegmentedOption[] = [
    { value: 'all', label: 'All' },
    { value: 'sfw', label: 'SFW' },
    { value: 'nsfw', label: 'NSFW' },
  ];

  toggleBaseline(value: string): void {
    const arr = this.activeBaselines();
    this.activeBaselines.set(
      arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value],
    );
  }

  toggleStyle(value: string): void {
    const arr = this.activeStyles();
    this.activeStyles.set(arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]);
  }

  toggleFamily(value: string): void {
    const arr = this.activeFamilies();
    this.activeFamilies.set(arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]);
  }
}
