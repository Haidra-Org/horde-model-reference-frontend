import { Component, input, computed, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  FormFieldConfig,
  TextFieldConfig,
  NumberFieldConfig,
  TextareaFieldConfig,
  SelectFieldConfig,
  CheckboxFieldConfig,
  TagInputFieldConfig,
  KeyValueFieldConfig,
  RequirementsFieldConfig,
  KeyValueEditorValueType,
} from '../../../models/form-field-config';
import { TagInputComponent } from '../tag-input/tag-input.component';
import { KeyValueEditorComponent } from '../key-value-editor/key-value-editor.component';
import { ModelRequirementsEditorComponent } from '../model-requirements-editor/model-requirements-editor.component';
import { GlossaryTooltipDirective } from '../../common/tooltip.directive';

/**
 * Generic form field component that renders different field types
 * based on the provided configuration.
 *
 * This component abstracts away the conditional rendering logic and
 * provides a single entry point for rendering form fields declaratively.
 */
@Component({
  selector: 'app-dynamic-field',
  imports: [
    FormsModule,
    TagInputComponent,
    KeyValueEditorComponent,
    ModelRequirementsEditorComponent,
    GlossaryTooltipDirective,
  ],
  templateUrl: './dynamic-field.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DynamicFieldComponent {
  readonly config = input.required<FormFieldConfig>();

  /**
   * Computed signals that return properly typed configs or null.
   * This enables proper type narrowing in templates using @if (signal(); as variable)
   */
  readonly textConfig = computed<TextFieldConfig | null>(() => {
    const cfg = this.config();
    return cfg.type === 'text' || cfg.type === 'url' ? (cfg as TextFieldConfig) : null;
  });

  readonly numberConfig = computed<NumberFieldConfig | null>(() => {
    const cfg = this.config();
    return cfg.type === 'number' ? (cfg as NumberFieldConfig) : null;
  });

  readonly textareaConfig = computed<TextareaFieldConfig | null>(() => {
    const cfg = this.config();
    return cfg.type === 'textarea' ? (cfg as TextareaFieldConfig) : null;
  });

  readonly selectConfig = computed<SelectFieldConfig | null>(() => {
    const cfg = this.config();
    return cfg.type === 'select' ? (cfg as SelectFieldConfig) : null;
  });

  readonly checkboxConfig = computed<CheckboxFieldConfig | null>(() => {
    const cfg = this.config();
    return cfg.type === 'checkbox' ? (cfg as CheckboxFieldConfig) : null;
  });

  readonly tagInputConfig = computed<TagInputFieldConfig | null>(() => {
    const cfg = this.config();
    return cfg.type === 'tag-input' ? (cfg as TagInputFieldConfig) : null;
  });

  readonly keyValueConfig = computed<KeyValueFieldConfig | null>(() => {
    const cfg = this.config();
    return cfg.type === 'key-value' ? (cfg as KeyValueFieldConfig) : null;
  });

  readonly requirementsConfig = computed<RequirementsFieldConfig | null>(() => {
    const cfg = this.config();
    return cfg.type === 'requirements' ? (cfg as RequirementsFieldConfig) : null;
  });

  /**
   * Computed signal to determine if the field should be hidden.
   * Using a computed signal instead of a method avoids unnecessary change detection.
   * A field is hidden if:
   * - isHidden() returns true, OR
   * - showWhen() exists and returns false
   */
  readonly isHidden = computed<boolean>(() => {
    const cfg = this.config();
    if (cfg.isHidden && cfg.isHidden()) {
      return true;
    }
    if (cfg.showWhen && !cfg.showWhen()) {
      return true;
    }
    return false;
  });

  /**
   * Computed signal to generate the grid column span class.
   * Maps gridColumnSpan to the appropriate CSS class (grid-col-span-1, etc.)
   */
  readonly gridSpanClass = computed<string>(() => {
    const span = this.config().gridColumnSpan;
    if (!span || span < 1 || span > 4) {
      return '';
    }
    return `grid-col-span-${span}`;
  });

  /**
   * Computed signal for priority badge CSS class.
   * Maps priority level to the appropriate badge color variant.
   */
  readonly priorityBadgeClass = computed<string>(() => {
    const priority = this.config().priority;
    if (!priority) return '';

    switch (priority) {
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
   * Computed signal for priority badge label text.
   * Capitalizes the first letter of the priority level.
   */
  readonly priorityLabel = computed<string>(() => {
    const priority = this.config().priority;
    if (!priority) return '';
    return priority.charAt(0).toUpperCase() + priority.slice(1);
  });

  /**
   * Determine the glossary term key from field ID
   * Maps common field IDs to their glossary terms
   */
  readonly glossaryTerm = computed<string | null>(() => {
    const id = this.config().id;
    const glossaryMap: Record<string, string> = {
      'baseline': 'baseline',
      'parameters': 'parameters',
      'nsfw': 'NSFW',
      'inpainting': 'inpainting',
      'tags': 'tags',
      'trigger': 'trigger words',
      'style': 'style',
      'showcases': 'showcases',
      'min_bridge_version': 'bridge version',
      'workers': 'worker',
      'kudos': 'kudos',
      'lora': 'LoRA',
      'controlnet': 'ControlNet',
      'quantization': 'quantization',
    };
    return glossaryMap[id] || null;
  });

  /**
   * Handle value changes for text inputs
   */
  onTextChange(cfg: TextFieldConfig, value: string | null): void {
    cfg.onChange(value || null);
  }

  /**
   * Handle value changes for number inputs
   */
  onNumberChange(cfg: NumberFieldConfig, value: string | number | null): void {
    const numValue = typeof value === 'number' ? value : value ? parseFloat(value) : null;
    cfg.onChange(numValue);
  }

  /**
   * Handle value changes for textarea inputs
   */
  onTextareaChange(cfg: TextareaFieldConfig, value: string | null): void {
    cfg.onChange(value || null);
  }

  /**
   * Handle value changes for select inputs
   */
  onSelectChange(cfg: SelectFieldConfig, value: string): void {
    cfg.onChange(value);
  }

  /**
   * Handle value changes for checkbox inputs
   */
  onCheckboxChange(cfg: CheckboxFieldConfig, checked: boolean): void {
    cfg.onChange(checked);
  }

  /**
   * Handle value changes for tag input
   */
  onTagInputChange(cfg: TagInputFieldConfig, values: string[]): void {
    cfg.onChange(values);
  }

  /**
   * Handle value changes for key-value editor
   */
  onKeyValueChange(
    cfg: KeyValueFieldConfig,
    values: Record<string, KeyValueEditorValueType>,
  ): void {
    cfg.onChange(values);
  }

  /**
   * Handle value changes for requirements editor
   */
  onRequirementsChange(
    cfg: RequirementsFieldConfig,
    values: Record<string, KeyValueEditorValueType>,
  ): void {
    cfg.onChange(values);
  }
}
