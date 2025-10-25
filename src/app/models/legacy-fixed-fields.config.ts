import { ModelReferenceCategory } from './api.models';

/**
 * Configuration for fields that should be hidden from users in legacy (v1) model forms
 * but need to have fixed values automatically applied on submission for backward compatibility.
 */

export interface FixedFieldConfig {
  /** Fixed value to be applied on form submission */
  value: unknown;
  /** Human-readable reason for why this field is fixed */
  reason: string;
}

export interface CategoryFixedFields {
  /** Common fixed fields that apply to all categories */
  all: Record<string, FixedFieldConfig>;
  /** Category-specific fixed fields */
  categories: Partial<Record<ModelReferenceCategory, Record<string, FixedFieldConfig>>>;
}

/**
 * Fixed field configuration for legacy (v1) models.
 *
 * These fields are obsolete from a user perspective but required by the legacy API schema
 * for backward compatibility. They will be hidden from the form UI and automatically
 * injected with the specified values during form submission.
 */
export const LEGACY_FIXED_FIELDS: CategoryFixedFields = {
  // Fields that are fixed for ALL model categories
  all: {
    available: {
      value: null,
      reason:
        "The 'available' field is deprecated and should not be set by users. It's managed internally by the system.",
    },
  },

  // Category-specific fixed fields
  categories: {
    image_generation: {
      type: {
        value: 'ckpt',
        reason:
          "For image generation models, the 'type' field is always 'ckpt' in the legacy format.",
      },
      min_bridge_version: {
        value: null,
        reason:
          "The 'min_bridge_version' field is deprecated and should not be set by users. It's managed internally by the system.",
      },
      download_all: {
        value: false,
        reason: "The 'download_all' field has a fixed default value of false.",
      },
    },
    text_generation: {
      download_all: {
        value: false,
        reason: "The 'download_all' field has a fixed default value of false.",
      },
    },
    clip: {
      download_all: {
        value: false,
        reason: "The 'download_all' field has a fixed default value of false.",
      },
    },
  },
};

/**
 * Get all fixed fields (both common and category-specific) for a given category.
 *
 * @param category - The model reference category
 * @returns A merged object of all fixed field configurations for the category
 */
export function getFixedFieldsForCategory(
  category: ModelReferenceCategory,
): Record<string, FixedFieldConfig> {
  const categorySpecific = LEGACY_FIXED_FIELDS.categories[category] || {};
  return {
    ...LEGACY_FIXED_FIELDS.all,
    ...categorySpecific,
  };
}

/**
 * Get the names of all fields that should be hidden from the form for a given category.
 *
 * @param category - The model reference category
 * @returns Array of field names that should be hidden
 */
export function getHiddenFieldNamesForCategory(category: ModelReferenceCategory): string[] {
  return Object.keys(getFixedFieldsForCategory(category));
}

/**
 * Apply fixed field values to a model record.
 * This should be called before submitting the form to ensure all fixed fields
 * have their required values.
 *
 * @param category - The model reference category
 * @param modelData - The model data to enhance with fixed fields
 * @returns The model data with fixed fields applied
 */
export function applyFixedFields<T extends Record<string, unknown>>(
  category: ModelReferenceCategory,
  modelData: T,
): T {
  const fixedFields = getFixedFieldsForCategory(category);
  const fixedValues: Record<string, unknown> = {};

  for (const [fieldName, config] of Object.entries(fixedFields)) {
    fixedValues[fieldName] = config.value;
  }

  return {
    ...modelData,
    ...fixedValues,
  };
}

/**
 * Check if a specific field should be hidden in the form for a given category.
 *
 * @param category - The model reference category
 * @param fieldName - The field name to check
 * @returns true if the field should be hidden, false otherwise
 */
export function isFieldHidden(category: ModelReferenceCategory, fieldName: string): boolean {
  const fixedFields = getFixedFieldsForCategory(category);
  return fieldName in fixedFields;
}
