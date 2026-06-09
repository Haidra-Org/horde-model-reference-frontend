import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../common/icon.component';
import { domainMeta } from '../../../shared/domain';
import { RECORD_DISPLAY_MAP } from '../../../models/maps';

@Component({
  selector: 'app-category-rail',
  imports: [RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="category-rail" aria-label="Model categories">
      @for (cat of categories(); track cat) {
        @let dm = metaFor(cat);
        @let isActive = cat === activeCategory();
        <a
          class="category-rail__item"
          [class.category-rail__item--active]="isActive"
          [routerLink]="['/categories', cat]"
          [attr.aria-current]="isActive ? 'page' : null"
        >
          <app-icon [name]="dm.icon" />
          <span>{{ displayName(cat) }}</span>
          <span class="category-rail__count">{{ countFor(cat) }}</span>
        </a>
      }
    </nav>
  `,
})
export class CategoryRailComponent {
  readonly activeCategory = input.required<string>();
  readonly counts = input<Map<string, number>>(new Map());

  /** All model reference categories (from the API enum values). */
  readonly categories = input.required<string[]>();

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
}
