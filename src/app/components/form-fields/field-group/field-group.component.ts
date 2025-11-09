import {
  Component,
  input,
  computed,
  signal,
  effect,
  inject,
  ChangeDetectionStrategy,
  OnInit,
  Injector,
  runInInjectionContext,
} from '@angular/core';
import { FormFieldConfig, FormFieldGroup } from '../../../models/form-field-config';
import { DynamicFieldComponent } from '../dynamic-field/dynamic-field.component';

/**
 * Component that renders a group of form fields, optionally with grid layout.
 * This handles both individual fields and field groups with custom layouts.
 * Supports collapsible sections for better UX on complex forms.
 */
@Component({
  selector: 'app-field-group',
  imports: [DynamicFieldComponent],
  templateUrl: './field-group.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FieldGroupComponent implements OnInit {
  readonly item = input.required<FormFieldConfig | FormFieldGroup>();

  /**
   * Writable signal to track if the group is currently collapsed
   */
  readonly isCollapsed = signal(false);

  /**
   * Track if we've initialized the collapsed state to prevent resetting on item changes
   */
  private hasInitialized = false;
  private readonly injector = inject(Injector);

  ngOnInit(): void {
    runInInjectionContext(this.injector, () =>
      effect(() => {
        const item = this.item();
        if ('fields' in item && item.collapsible && !this.hasInitialized) {
          this.isCollapsed.set(item.defaultCollapsed ?? false);
          this.hasInitialized = true;
        }
      }),
    );
  }

  /**
   * Computed signal that returns the item as a FormFieldConfig if it's a field,
   * or null if it's a group. This allows proper type narrowing in the template.
   */
  readonly asField = computed<FormFieldConfig | null>(() => {
    const item = this.item();
    return 'fields' in item ? null : item;
  });

  /**
   * Computed signal that returns the item as a FormFieldGroup if it's a group,
   * or null if it's a field. This allows proper type narrowing in the template.
   */
  readonly asGroup = computed<FormFieldGroup | null>(() => {
    const item = this.item();
    return 'fields' in item ? item : null;
  });

  /**
   * Computed signal that returns the color variant class for the group.
   * Priority-based classes take precedence over colorVariant classes.
   */
  readonly colorVariantClass = computed<string>(() => {
    const group = this.asGroup();
    if (!group) {
      return '';
    }

    // Priority-based classes take precedence
    if (group.priority) {
      return `field-group-${group.priority}`;
    }

    // Fall back to colorVariant classes
    if (group.colorVariant) {
      return `field-group-collapsible-${group.colorVariant}`;
    }

    return '';
  });

  /**
   * Computed signal that returns the priority badge class
   */
  readonly priorityBadgeClass = computed<string>(() => {
    const group = this.asGroup();
    if (!group?.priority) {
      return '';
    }

    switch (group.priority) {
      case 'required':
        return 'badge-danger';
      case 'recommended':
        return 'badge-success';
      case 'optional':
        return 'badge-info';
      case 'advanced':
        return 'badge-secondary';
      default:
        return '';
    }
  });

  /**
   * Computed signal that returns the priority label text
   */
  readonly priorityLabel = computed<string>(() => {
    const group = this.asGroup();
    if (!group?.priority) {
      return '';
    }

    return group.priority.charAt(0).toUpperCase() + group.priority.slice(1);
  });

  /**
   * Toggle the collapsed state of a collapsible group
   */
  toggleCollapsed(): void {
    this.isCollapsed.update((current) => !current);
  }

  /**
   * Generate a safe ID for the collapsible content area
   */
  getContentId(label?: string): string {
    if (label) {
      return label.replace(/\s+/g, '-').toLowerCase() + '-content';
    }
    return 'group-content';
  }
}
