/**
 * Form field builder utility for creating field configurations declaratively.
 * Provides a fluent API for constructing form fields with type safety.
 */

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
  SelectOption,
  FormFieldGroup,
} from '../models/form-field-config';
import { ModelReferenceCategory } from '../models/api.models';
import { isFieldHidden } from '../models/legacy-fixed-fields.config';
import { ModelRequirementsConfig } from '../components/form-fields/model-requirements-editor/model-requirements-editor.component';

/**
 * Builder class for creating form field configurations with a fluent API
 */
export class FormFieldBuilder {
  /**
   * Create a text input field
   */
  static text(
    id: string,
    label: string,
    value: string | null,
    onChange: (value: string | null) => void,
  ): TextFieldBuilder {
    return new TextFieldBuilder({
      id,
      name: id,
      label,
      type: 'text',
      value,
      onChange,
    });
  }

  /**
   * Create a number input field
   */
  static number(
    id: string,
    label: string,
    value: number | null,
    onChange: (value: number | null) => void,
  ): NumberFieldBuilder {
    return new NumberFieldBuilder({
      id,
      name: id,
      label,
      type: 'number',
      value,
      onChange,
    });
  }

  /**
   * Create a URL input field
   */
  static url(
    id: string,
    label: string,
    value: string | null,
    onChange: (value: string | null) => void,
  ): TextFieldBuilder {
    return new TextFieldBuilder({
      id,
      name: id,
      label,
      type: 'url',
      value,
      onChange,
    });
  }

  /**
   * Create a textarea field
   */
  static textarea(
    id: string,
    label: string,
    value: string | null,
    onChange: (value: string | null) => void,
  ): TextareaFieldBuilder {
    return new TextareaFieldBuilder({
      id,
      name: id,
      label,
      type: 'textarea',
      value,
      onChange,
    });
  }

  /**
   * Create a select dropdown field
   */
  static select(
    id: string,
    label: string,
    value: string,
    options: SelectOption[],
    onChange: (value: string) => void,
  ): SelectFieldBuilder {
    return new SelectFieldBuilder({
      id,
      name: id,
      label,
      type: 'select',
      value,
      options,
      onChange,
    });
  }

  /**
   * Create a checkbox field
   */
  static checkbox(
    id: string,
    label: string,
    value: boolean,
    onChange: (value: boolean) => void,
  ): CheckboxFieldBuilder {
    return new CheckboxFieldBuilder({
      id,
      name: id,
      label,
      type: 'checkbox',
      value,
      onChange,
    });
  }

  /**
   * Create a tag input field
   */
  static tagInput(
    id: string,
    label: string,
    value: string[],
    onChange: (value: string[]) => void,
  ): TagInputFieldBuilder {
    return new TagInputFieldBuilder({
      id,
      name: id,
      label,
      type: 'tag-input',
      value,
      onChange,
    });
  }

  /**
   * Create a key-value editor field
   */
  static keyValue(
    id: string,
    label: string,
    value: Record<string, KeyValueEditorValueType>,
    onChange: (value: Record<string, KeyValueEditorValueType>) => void,
  ): KeyValueFieldBuilder {
    return new KeyValueFieldBuilder({
      id,
      name: id,
      label,
      type: 'key-value',
      value,
      onChange,
    });
  }

  /**
   * Create a model requirements/settings editor field with structured fields
   */
  static requirements(
    id: string,
    label: string,
    value: Record<string, KeyValueEditorValueType>,
    onChange: (value: Record<string, KeyValueEditorValueType>) => void,
    config?: ModelRequirementsConfig,
  ): RequirementsFieldBuilder {
    return new RequirementsFieldBuilder({
      id,
      name: id,
      label,
      type: 'requirements',
      value,
      onChange,
      config,
    });
  }

  /**
   * Create a tri-state boolean select (true/false/null)
   */
  static triStateBoolean(
    id: string,
    label: string,
    value: boolean | null,
    onChange: (value: boolean | null) => void,
    options: { nullLabel?: string; trueLabel?: string; falseLabel?: string } = {},
  ): SelectFieldBuilder {
    const currentValue = value === null ? 'null' : value ? 'true' : 'false';

    return new SelectFieldBuilder({
      id,
      name: id,
      label,
      type: 'select',
      value: currentValue,
      options: [
        { value: 'null', label: options.nullLabel || 'Not Set' },
        { value: 'true', label: options.trueLabel || 'Yes' },
        { value: 'false', label: options.falseLabel || 'No' },
      ],
      onChange: (strValue: string) => {
        if (strValue === 'null') {
          onChange(null);
        } else {
          onChange(strValue === 'true');
        }
      },
    });
  }

  /**
   * Create a field group with grid layout
   */
  static group(
    fields: FormFieldConfig[],
    gridClass?: string,
    options?: {
      label?: string;
      collapsible?: boolean;
      defaultCollapsed?: boolean;
      helpText?: string;
      colorVariant?: 'primary' | 'success' | 'info' | 'warning';
      icon?: string;
    },
  ): FormFieldGroup {
    return {
      fields,
      gridClass,
      label: options?.label,
      collapsible: options?.collapsible,
      defaultCollapsed: options?.defaultCollapsed,
      helpText: options?.helpText,
      colorVariant: options?.colorVariant,
      icon: options?.icon,
    };
  }
}

/**
 * Base builder class with common fluent methods
 */
abstract class BaseFieldBuilder<T extends FormFieldConfig> {
  constructor(protected config: T) { }

  placeholder(text: string): this {
    this.config.placeholder = text;
    return this;
  }

  required(isRequired = true): this {
    this.config.required = isRequired;
    return this;
  }

  labelSuffix(text: string): this {
    this.config.labelSuffix = text;
    return this;
  }

  helpText(text: string): this {
    this.config.helpText = text;
    return this;
  }

  wrapperClass(className: string): this {
    this.config.wrapperClass = className;
    return this;
  }

  /**
   * Hide this field for specific categories using the legacy fixed fields config
   */
  hideForCategory(category: ModelReferenceCategory): this {
    this.config.isHidden = () => isFieldHidden(category, this.config.name);
    return this;
  }

  /**
   * Hide this field based on a custom condition
   */
  hideWhen(condition: () => boolean): this {
    this.config.isHidden = condition;
    return this;
  }

  /**
   * Show this field only when a condition is true
   */
  showWhen(condition: () => boolean): this {
    this.config.showWhen = condition;
    return this;
  }

  build(): T {
    return this.config;
  }
}

class TextFieldBuilder extends BaseFieldBuilder<TextFieldConfig> { }

class NumberFieldBuilder extends BaseFieldBuilder<NumberFieldConfig> { }

class TextareaFieldBuilder extends BaseFieldBuilder<TextareaFieldConfig> {
  rows(count: number): this {
    this.config.rows = count;
    return this;
  }
}

class SelectFieldBuilder extends BaseFieldBuilder<SelectFieldConfig> { }

class CheckboxFieldBuilder extends BaseFieldBuilder<CheckboxFieldConfig> {
  checkboxLabel(text: string): this {
    this.config.checkboxLabel = text;
    return this;
  }
}

class TagInputFieldBuilder extends BaseFieldBuilder<TagInputFieldConfig> {
  /**
   * Add autocomplete suggestions
   */
  suggestions(values: readonly string[]): this {
    this.config.suggestions = values;
    return this;
  }
}

class KeyValueFieldBuilder extends BaseFieldBuilder<KeyValueFieldConfig> { }

class RequirementsFieldBuilder extends BaseFieldBuilder<RequirementsFieldConfig> {
  /**
   * Configure which structured fields to show
   */
  configure(config: ModelRequirementsConfig): this {
    this.config.config = config;
    return this;
  }
}
