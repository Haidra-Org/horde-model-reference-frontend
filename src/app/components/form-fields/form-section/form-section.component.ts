import { Component, input, signal, computed, ChangeDetectionStrategy, OnInit } from '@angular/core';

/**
 * Purpose-built form section wrapper providing consistent card-like styling,
 * collapsible behavior, and edit-mode dirty-change badges.
 *
 * Replaces ad-hoc card + field-group patterns with a single reusable container.
 */
@Component({
  selector: 'app-form-section',
  template: `
    <div class="form-section-card" [class.form-section-card--collapsed]="isCollapsed()">
      <button
        type="button"
        class="form-section-header"
        [class.cursor-pointer]="collapsible()"
        [class.cursor-default]="!collapsible()"
        (click)="collapsible() && toggleCollapsed()"
        [attr.aria-expanded]="collapsible() ? !isCollapsed() : null"
      >
        <div class="form-section-header-left">
          @if (collapsible()) {
            <span
              class="form-section-chevron"
              [class.rotate-90]="!isCollapsed()"
              aria-hidden="true"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </span>
          }
          <div>
            <h3 class="form-section-title">
              {{ title() }}
            </h3>
            @if (subtitle() && !isCollapsed()) {
              <p class="form-section-subtitle">{{ subtitle() }}</p>
            }
          </div>
        </div>
        <div class="form-section-header-right">
          @if (changedFieldCount() > 0) {
            <span class="form-section-change-badge"> {{ changedFieldCount() }} changed </span>
          }
          @if (badge()) {
            <span class="badge" [class]="badgeClass()">{{ badge() }}</span>
          }
        </div>
      </button>

      @if (!isCollapsed()) {
        <div class="form-section-body">
          <ng-content />
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormSectionComponent implements OnInit {
  readonly title = input.required<string>();
  readonly subtitle = input<string>();
  readonly icon = input<string>();
  /** Label for a badge shown in the header (e.g., "Required", "Optional") */
  readonly badge = input<string>();
  readonly badgeVariant = input<'required' | 'recommended' | 'optional' | 'advanced'>();
  readonly collapsible = input(false);
  readonly defaultCollapsed = input(false);
  /** Number of fields modified in this section (edit mode) */
  readonly changedFieldCount = input(0);

  readonly isCollapsed = signal(false);
  private initialized = false;

  readonly badgeClass = computed(() => {
    switch (this.badgeVariant()) {
      case 'required':
        return 'badge-danger';
      case 'recommended':
        return 'badge-success';
      case 'optional':
        return 'badge-info';
      case 'advanced':
        return 'badge-secondary';
      default:
        return 'badge-secondary';
    }
  });

  ngOnInit(): void {
    if (!this.initialized) {
      this.isCollapsed.set(this.defaultCollapsed());
      this.initialized = true;
    }
  }

  toggleCollapsed(): void {
    this.isCollapsed.update((v) => !v);
  }
}
