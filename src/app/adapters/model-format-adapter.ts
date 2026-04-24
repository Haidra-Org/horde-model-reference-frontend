/**
 * Format adapter layer for bridging between API response/request shapes and form state.
 *
 * When `canonicalFormat='legacy'`, the pipeline speaks v1 (legacy) end-to-end.
 * When `canonicalFormat='v2'`, the pipeline speaks v2 end-to-end.
 * No cross-format conversion — each path is native to its format.
 *
 * Architecture:
 * - Per-category adapters handle both formats internally (category isolation, not format duplication).
 * - V2 read dispatch uses `model.record_type` (the discriminant), not shape checks.
 * - V2 write dispatch uses exhaustive `switch` on `categoryData.kind`.
 * - Adapters translate shape — they never fabricate defaults for missing fields.
 */

import {
  ControlNetModelRecordInput,
  ControlNetModelRecordOutput,
  DownloadRecord,
  GenericModelRecordConfig,
  GenericModelRecordInput,
  GenericModelRecordMetadata,
  GenericModelRecordOutput,
  ImageGenerationModelRecordInput,
  ImageGenerationModelRecordOutput,
  MODEL_REFERENCE_CATEGORY,
  ModelClassification,
  NewModelRecord,
  ResponseReadV2ReferenceValue,
  TextGenerationModelRecordInput,
  TextGenerationModelRecordOutput,
  FineTuneSeriesInfo,
} from '../api-client';
import { CommonFieldsData } from '../components/model-fields/common-fields/common-fields.component';
import { StableDiffusionFieldsData } from '../components/model-fields/stable-diffusion-fields/stable-diffusion-fields.component';
import { TextGenerationFieldsData } from '../components/model-fields/text-generation-fields/text-generation-fields.component';
import { ClipFieldsData } from '../components/model-fields/clip-fields/clip-fields.component';
import { ControlNetFieldsData } from '../components/model-fields/controlnet-fields/controlnet-fields.component';
import { LegacyRecordUnion, LegacyConfigFile } from '../models/api.models';
import { legacyConfigToSimplified, simplifiedToLegacyConfig } from '../utils/config-converter';
import { applyFixedFields } from '../models/legacy-fixed-fields.config';

/**
 * Value type for dictionary fields (requirements, settings) in the form layer.
 * The generated API client types flatten these to `{}` (empty interface) because the
 * OpenAPI schema uses `additionalProperties: true`. The backend actually sends
 * primitive / array values, so this type assertion at the adapter boundary is safe.
 */
type RecordDictValue = number | string | boolean | number[] | string[];

// ---------------------------------------------------------------------------
// Form data model — format-agnostic intermediate representation
// ---------------------------------------------------------------------------

/** Per-category discriminated union for category-specific form data. */
export type CategoryFormData =
  | { kind: 'image_generation'; data: StableDiffusionFieldsData }
  | { kind: 'text_generation'; data: TextGenerationFieldsData }
  | { kind: 'controlnet'; data: ControlNetFieldsData }
  | { kind: 'clip'; data: ClipFieldsData }
  | { kind: 'generic'; data: null };

/** V2-specific fields, grouped to clearly separate them from legacy data. */
export interface V2FormFields {
  recordType: MODEL_REFERENCE_CATEGORY;
  modelClassification: ModelClassification | undefined;
  finetuneSeries: FineTuneSeriesInfo | null;
  metadata: GenericModelRecordMetadata | undefined;
}

/**
 * All form signal values extracted from or destined for the model form.
 * Components consume this shape exclusively — they never see raw API types.
 */
export interface FormModelData {
  commonData: CommonFieldsData;
  categoryData: CategoryFormData;
  downloads: DownloadRecord[];

  /** Legacy config.files array — only populated when loading from legacy API. */
  legacyFiles: LegacyConfigFile[];

  /** V2-specific fields — null when the source is legacy format. */
  v2Fields: V2FormFields | null;
}

// ---------------------------------------------------------------------------
// Category adapter interface
// ---------------------------------------------------------------------------

/** Fields common to all V2 input types, assembled by the top-level dispatcher. */
export interface SharedV2Fields {
  name: string;
  record_type: MODEL_REFERENCE_CATEGORY;
  description: string | null | undefined;
  version: string | null | undefined;
  config: GenericModelRecordConfig | undefined;
  model_classification: ModelClassification | undefined;
  finetune_series: FineTuneSeriesInfo | null | undefined;
}

/**
 * Per-category adapter that handles both legacy and V2 format conversions.
 * Each category implements this interface once; format branching happens
 * at the top-level dispatcher, not inside category logic.
 */
export interface CategoryAdapter<TFormData> {
  /** Extract category-specific form data from a legacy API response. */
  legacyToForm(model: LegacyRecordUnion): TFormData;

  /** Merge category-specific form data into a legacy API payload. */
  formToLegacy(data: TFormData, base: LegacyRecordUnion): LegacyRecordUnion;

  /** Extract category-specific form data from a V2 API response. */
  v2ToForm(model: ResponseReadV2ReferenceValue): TFormData;

  /** Build the category-specific V2 input record from form data + shared fields. */
  formToV2(data: TFormData, shared: SharedV2Fields, commonData: CommonFieldsData): NewModelRecord;
}

// ---------------------------------------------------------------------------
// Per-category adapters
// ---------------------------------------------------------------------------

const imageGenerationAdapter: CategoryAdapter<StableDiffusionFieldsData> = {
  legacyToForm(model) {
    const m = model as LegacyRecordUnion & {
      inpainting?: boolean;
      baseline?: string;
      tags?: string[] | null;
      showcases?: string[] | null;
      min_bridge_version?: number | null;
      trigger?: string[] | null;
      homepage?: string | null;
      size_on_disk_bytes?: number | null;
      optimization?: string | null;
      requirements?: Record<string, RecordDictValue> | null;
    };
    return {
      inpainting: m.inpainting ?? false,
      baseline: m.baseline ?? '',
      tags: m.tags,
      showcases: m.showcases,
      min_bridge_version: m.min_bridge_version,
      trigger: m.trigger,
      homepage: m.homepage,
      size_on_disk_bytes: m.size_on_disk_bytes,
      optimization: m.optimization,
      requirements: m.requirements ?? null,
    };
  },

  formToLegacy(data, base) {
    return { ...base, ...data };
  },

  v2ToForm(model) {
    const m = model as ImageGenerationModelRecordOutput;
    return {
      inpainting: m.inpainting ?? false,
      baseline: m.baseline,
      tags: m.tags ?? null,
      showcases: m.showcases ?? null,
      min_bridge_version: m.min_bridge_version ?? null,
      trigger: m.trigger ?? null,
      homepage: m.homepage ?? null,
      size_on_disk_bytes: m.size_on_disk_bytes ?? null,
      optimization: m.optimization ?? null,
      requirements: (m.requirements as Record<string, RecordDictValue> | null) ?? null,
    };
  },

  formToV2(data, shared, commonData) {
    const record: ImageGenerationModelRecordInput = {
      ...shared,
      nsfw: commonData.nsfw,
      style: commonData.style,
      baseline: data.baseline,
      inpainting: data.inpainting,
      tags: data.tags,
      showcases: data.showcases,
      trigger: data.trigger,
      homepage: data.homepage,
      size_on_disk_bytes: data.size_on_disk_bytes,
      optimization: data.optimization,
      requirements: data.requirements,
    };
    return record;
  },
};

const textGenerationAdapter: CategoryAdapter<TextGenerationFieldsData> = {
  legacyToForm(model) {
    const m = model as LegacyRecordUnion & {
      parameters?: number | null;
      model_name?: string | null;
      baseline?: string | null;
      display_name?: string | null;
      url?: string | null;
      tags?: string[] | null;
      instruct_format?: string | null;
      settings?: Record<string, RecordDictValue> | null;
    };
    return {
      parameters: m.parameters,
      model_name: m.model_name,
      baseline: m.baseline,
      display_name: m.display_name,
      url: m.url,
      tags: m.tags,
      instruct_format: m.instruct_format ?? null,
      settings: m.settings ?? null,
    };
  },

  formToLegacy(data, base) {
    return { ...base, ...data };
  },

  v2ToForm(model) {
    const m = model as TextGenerationModelRecordOutput;
    return {
      parameters: m.parameters,
      baseline: m.baseline ?? null,
      display_name: m.display_name ?? null,
      url: m.url ?? null,
      tags: m.tags ?? null,
      instruct_format: m.instruct_format ?? null,
      settings: (m.settings as Record<string, RecordDictValue> | null) ?? null,
      text_model_group: m.text_model_group ?? null,
    };
  },

  formToV2(data, shared, commonData) {
    const record: TextGenerationModelRecordInput = {
      ...shared,
      nsfw: commonData.nsfw,
      style: commonData.style,
      parameters: data.parameters!,
      baseline: data.baseline,
      display_name: data.display_name,
      url: data.url,
      tags: data.tags,
      instruct_format: data.instruct_format,
      settings: data.settings,
      text_model_group: data.text_model_group,
    };
    return record;
  },
};

const controlnetAdapter: CategoryAdapter<ControlNetFieldsData> = {
  legacyToForm(model) {
    const m = model as LegacyRecordUnion & { controlnet_style?: string };
    return {
      controlnet_style: m.controlnet_style ?? '',
    };
  },

  formToLegacy(data, base) {
    return { ...base, ...data };
  },

  v2ToForm(model) {
    const m = model as ControlNetModelRecordOutput;
    return {
      controlnet_style: m.controlnet_style ?? '',
    };
  },

  formToV2(data, shared) {
    const record: ControlNetModelRecordInput = {
      ...shared,
      controlnet_style: data.controlnet_style,
    };
    return record;
  },
};

const clipAdapter: CategoryAdapter<ClipFieldsData> = {
  legacyToForm(model) {
    const m = model as LegacyRecordUnion & { pretrained_name?: string | null };
    return {
      pretrained_name: m.pretrained_name,
    };
  },

  formToLegacy(data, base) {
    return { ...base, ...data };
  },

  v2ToForm(model) {
    // Clip uses GenericModelRecordOutput in V2 — no dedicated output type
    const m = model as GenericModelRecordOutput & { pretrained_name?: string | null };
    return {
      pretrained_name: m.pretrained_name,
    };
  },

  formToV2(_data, shared) {
    // Clip maps to GenericModelRecordInput in V2
    const record: GenericModelRecordInput = {
      ...shared,
      record_type: shared.record_type as string,
      model_classification: shared.model_classification ?? {
        domain: 'image',
        purpose: 'miscellaneous',
      },
    };
    return record;
  },
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

interface AdapterRegistryEntry<T> {
  kind: CategoryFormData['kind'];
  adapter: CategoryAdapter<T>;
}

const CATEGORY_ADAPTERS = new Map<MODEL_REFERENCE_CATEGORY, AdapterRegistryEntry<unknown>>([
  [
    MODEL_REFERENCE_CATEGORY.ImageGeneration,
    { kind: 'image_generation', adapter: imageGenerationAdapter },
  ],
  [
    MODEL_REFERENCE_CATEGORY.TextGeneration,
    { kind: 'text_generation', adapter: textGenerationAdapter },
  ],
  [MODEL_REFERENCE_CATEGORY.Controlnet, { kind: 'controlnet', adapter: controlnetAdapter }],
  [MODEL_REFERENCE_CATEGORY.Clip, { kind: 'clip', adapter: clipAdapter }],
]);

function assertNever(value: never): never {
  throw new Error(`Unhandled category form data kind: ${JSON.stringify(value)}`);
}

// ---------------------------------------------------------------------------
// Legacy (v1) top-level adapters
// ---------------------------------------------------------------------------

/**
 * Convert a legacy API response record into form signal values.
 */
export function legacyApiToForm(
  model: LegacyRecordUnion,
  category: MODEL_REFERENCE_CATEGORY,
): FormModelData {
  const commonData: CommonFieldsData = {
    nsfw: model.nsfw ?? true,
    description: model.description,
    type: model.type,
    version: model.version,
    style: model.style,
    download_all: model.download_all,
    available: model.available,
    features_not_supported: model.features_not_supported,
  };

  const simplified = model.config ? legacyConfigToSimplified(model.config) : { download: [] };
  const legacyFiles = model.config?.files ?? [];

  const entry = CATEGORY_ADAPTERS.get(category);
  const categoryData: CategoryFormData = entry
    ? ({ kind: entry.kind, data: entry.adapter.legacyToForm(model) } as CategoryFormData)
    : { kind: 'generic', data: null };

  return {
    commonData,
    categoryData,
    downloads: simplified.download,
    legacyFiles,
    v2Fields: null,
  };
}

/**
 * Convert form signal values into a legacy API payload for create/update.
 */
export function formToLegacyApi(
  data: FormModelData,
  modelName: string,
  category: MODEL_REFERENCE_CATEGORY,
): LegacyRecordUnion {
  const config = simplifiedToLegacyConfig({ download: data.downloads }, data.legacyFiles);

  const base: LegacyRecordUnion = {
    name: modelName,
    ...data.commonData,
    config,
  };

  const cd = data.categoryData;
  let result: LegacyRecordUnion;
  switch (cd.kind) {
    case 'image_generation':
      result = imageGenerationAdapter.formToLegacy(cd.data, base);
      break;
    case 'text_generation':
      result = textGenerationAdapter.formToLegacy(cd.data, base);
      break;
    case 'controlnet':
      result = controlnetAdapter.formToLegacy(cd.data, base);
      break;
    case 'clip':
      result = clipAdapter.formToLegacy(cd.data, base);
      break;
    case 'generic':
      result = base;
      break;
    default:
      assertNever(cd);
  }

  return applyFixedFields(category, result);
}

// ---------------------------------------------------------------------------
// V2 top-level adapters
// ---------------------------------------------------------------------------

/**
 * Convert a V2 API response record into form signal values.
 * Dispatches by `model.record_type` (the discriminant), not shape checks.
 */
export function v2ApiToForm(
  model: ResponseReadV2ReferenceValue,
  category: MODEL_REFERENCE_CATEGORY,
): FormModelData {
  const commonData: CommonFieldsData = {
    nsfw: 'nsfw' in model ? (model as { nsfw: boolean }).nsfw : false,
    description: model.description,
    version: model.version,
    style: 'style' in model ? (model as { style: string | null }).style : undefined,
  };

  const downloads = model.config?.download ?? [];

  // Dispatch by record_type (the discriminant) when available, fall back to category
  const recordType = model.record_type ?? category;
  const entry = CATEGORY_ADAPTERS.get(recordType as MODEL_REFERENCE_CATEGORY);
  const categoryData: CategoryFormData = entry
    ? ({ kind: entry.kind, data: entry.adapter.v2ToForm(model) } as CategoryFormData)
    : { kind: 'generic', data: null };

  return {
    commonData,
    categoryData,
    downloads,
    legacyFiles: [],
    v2Fields: {
      recordType: recordType as MODEL_REFERENCE_CATEGORY,
      modelClassification: model.model_classification,
      finetuneSeries: model.finetune_series ?? null,
      metadata: model.metadata,
    },
  };
}

/**
 * Convert form signal values into a V2 API payload for create/update.
 * Dispatches by `categoryData.kind` with exhaustive switch.
 */
export function formToV2Api(
  data: FormModelData,
  modelName: string,
  category: MODEL_REFERENCE_CATEGORY,
): NewModelRecord {
  const config = data.downloads.length > 0 ? { download: data.downloads } : undefined;

  const shared: SharedV2Fields = {
    name: modelName,
    record_type: category,
    description: data.commonData.description,
    version: data.commonData.version,
    config,
    model_classification: data.v2Fields?.modelClassification,
    finetune_series: data.v2Fields?.finetuneSeries,
  };

  const cd = data.categoryData;
  switch (cd.kind) {
    case 'image_generation':
      return imageGenerationAdapter.formToV2(cd.data, shared, data.commonData);
    case 'text_generation':
      return textGenerationAdapter.formToV2(cd.data, shared, data.commonData);
    case 'controlnet':
      return controlnetAdapter.formToV2(cd.data, shared, data.commonData);
    case 'clip':
      return clipAdapter.formToV2(cd.data, shared, data.commonData);
    case 'generic': {
      const record: GenericModelRecordInput = {
        ...shared,
        record_type: category as string,
        model_classification: shared.model_classification ?? {
          domain: 'image',
          purpose: 'miscellaneous',
        },
      };
      return record;
    }
    default:
      return assertNever(cd);
  }
}

/**
 * Convert a legacy-shaped payload into a typed V2 request payload via the
 * format-agnostic form model.
 */
export function legacyApiToV2Api(
  model: LegacyRecordUnion | Partial<LegacyRecordUnion>,
  modelName: string,
  category: MODEL_REFERENCE_CATEGORY,
): NewModelRecord {
  const normalized: LegacyRecordUnion = {
    ...(model as LegacyRecordUnion),
    name: modelName,
  };

  const formData = legacyApiToForm(normalized, category);
  return formToV2Api(formData, modelName, category);
}
