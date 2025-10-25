/**
 * Form field configuration models for building dynamic form fields.
 * Provides a type-safe way to define form fields with various input types.
 */

export type FormFieldType =
  | 'text'
  | 'number'
  | 'url'
  | 'textarea'
  | 'select'
  | 'checkbox'
  | 'tag-input'
  | 'key-value';

export interface SelectOption {
  value: string;
  label: string;
}

/**
 * Value types supported by the key-value editor
 */
export type KeyValueEditorValueType = number | string | boolean | number[] | string[];

/**
 * Base configuration for all form fields
 */
export interface BaseFieldConfig<T = unknown> {
  /** Unique identifier for the field */
  id: string;
  /** Field name used for data binding */
  name: string;
  /** Display label for the field */
  label: string;
  /** Type of form field to render */
  type: FormFieldType;
  /** Current value of the field */
  value: T;
  /** Placeholder text for input fields */
  placeholder?: string;
  /** Whether the field is required */
  required?: boolean;
  /** CSS classes to apply to the field wrapper */
  wrapperClass?: string;
  /** Additional label text (e.g., warnings or hints) */
  labelSuffix?: string;
  /** Help text explaining the field's purpose (shown below the input) */
  helpText?: string;
  /** Function to determine if field should be hidden */
  isHidden?: () => boolean;
  /** Function to determine if field should be shown (alternative to isHidden) */
  showWhen?: () => boolean;
  /** Callback when field value changes */
  onChange: (value: T) => void;
}

/**
 * Configuration for text input fields
 */
export interface TextFieldConfig extends BaseFieldConfig<string | null> {
  type: 'text' | 'url';
}

/**
 * Configuration for number input fields
 */
export interface NumberFieldConfig extends BaseFieldConfig<number | null> {
  type: 'number';
}

/**
 * Configuration for textarea fields
 */
export interface TextareaFieldConfig extends BaseFieldConfig<string | null> {
  type: 'textarea';
  /** Number of visible rows */
  rows?: number;
}

/**
 * Configuration for select dropdown fields
 */
export interface SelectFieldConfig extends BaseFieldConfig<string> {
  type: 'select';
  /** Available options for the select dropdown */
  options: SelectOption[];
}

/**
 * Configuration for checkbox fields
 */
export interface CheckboxFieldConfig extends BaseFieldConfig<boolean> {
  type: 'checkbox';
  /** Text to display next to the checkbox */
  checkboxLabel?: string;
}

/**
 * Configuration for tag input fields (array of strings)
 */
export interface TagInputFieldConfig extends BaseFieldConfig<string[]> {
  type: 'tag-input';
}

/**
 * Configuration for key-value editor fields
 */
export interface KeyValueFieldConfig
  extends BaseFieldConfig<Record<string, KeyValueEditorValueType>> {
  type: 'key-value';
}

/**
 * Union type of all possible field configurations
 */
export type FormFieldConfig =
  | TextFieldConfig
  | NumberFieldConfig
  | TextareaFieldConfig
  | SelectFieldConfig
  | CheckboxFieldConfig
  | TagInputFieldConfig
  | KeyValueFieldConfig;

/**
 * Groups form fields for layout purposes
 */
export interface FormFieldGroup {
  /** Optional group label */
  label?: string;
  /** Fields in this group */
  fields: FormFieldConfig[];
  /** CSS grid class for layout (e.g., 'form-grid-2', 'form-grid-3') */
  gridClass?: string;
  /** Whether this group should be collapsible */
  collapsible?: boolean;
  /** Whether this group starts collapsed (only applies if collapsible is true) */
  defaultCollapsed?: boolean;
  /** Help text for the entire group */
  helpText?: string;
}

/**
 * Complete form section configuration
 */
export interface FormSectionConfig {
  /** Section title */
  title: string;
  /** Field groups within the section */
  groups: (FormFieldConfig | FormFieldGroup)[];
}
