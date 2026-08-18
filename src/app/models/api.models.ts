import {
  MODEL_REFERENCE_CATEGORY,
  ResponseReadV2ReferenceValue,
  LegacyStableDiffusionRecordInput,
  LegacyTextGenerationRecordInput as GeneratedLegacyTextGenerationRecord,
  LegacyControlnetRecordInput as GeneratedLegacyControlnetRecord,
  LegacyClipRecordInput as GeneratedLegacyClipRecord,
  ModelLicensing,
} from '../api-client';

// Type aliases for convenience
export type ModelRecord = ResponseReadV2ReferenceValue;
export type ModelReferenceCategory = MODEL_REFERENCE_CATEGORY;

// ---------------------------------------------------------------------------
// Generated-client record type seam
//
// App code imports record types from this module, never from '../api-client' directly. A
// regeneration that renames generated types — e.g. FastAPI collapsing its `-Input`/`-Output`
// record schemas into a single name — is then absorbed by editing the aliases here, instead of
// rippling across adapters, services, and tests.
// ---------------------------------------------------------------------------

// V2 write/read record types (members of NewModelRecord / ResponseReadV2ReferenceValue).
// Re-exported under their current generated names; a future rename becomes a one-line `as` here.
// `ResponseReadV2ReferenceValue` is also surfaced as `ModelRecord` (above) for read-side ergonomics.
export type {
  ImageGenerationModelRecord,
  TextGenerationModelRecord,
  ControlNetModelRecord,
  GenericModelRecord,
  NewModelRecord,
  ResponseReadV2ReferenceValue,
} from '../api-client';

// V1 (legacy) write-payload types — the exact shapes the generated v1 service methods accept.
// Distinct names because the hand-written legacy domain types below share the unprefixed names.
export type LegacyImageGenerationPayload = LegacyStableDiffusionRecordInput;
export type LegacyTextGenerationPayload = GeneratedLegacyTextGenerationRecord;
export type LegacyControlnetPayload = GeneratedLegacyControlnetRecord;
export type LegacyClipPayload = GeneratedLegacyClipRecord;

// Custom response types
export type CategoryModelsResponse = Record<string, ModelRecord>;

export interface BackendCapabilities {
  writable: boolean;
  mode: 'PRIMARY' | 'REPLICA' | 'UNKNOWN';
  canonicalFormat: 'legacy' | 'v2' | 'UNKNOWN';
}

export interface LegacyConfigFile {
  path: string;
  md5sum?: string | null;
  sha256sum?: string | null;
  file_type?: string | null;
  [key: string]: unknown;
}

export interface LegacyConfigDownload {
  file_name?: string | null;
  file_path?: string | null;
  file_url?: string | null;
  sha256sum?: string | null;
  [key: string]: unknown;
}

export interface LegacyConfig {
  files?: LegacyConfigFile[];
  download?: LegacyConfigDownload[];
}

export interface LegacyGenericRecord {
  name: string;
  type?: string | null;
  description?: string | null;
  version?: string | null;
  style?: string | null;
  nsfw?: boolean | null;
  download_all?: boolean | null;
  config?: LegacyConfig;
  available?: boolean | null;
  features_not_supported?: string[] | null;
  licensing?: ModelLicensing | null;
  [key: string]: unknown;
}

export interface LegacyStableDiffusionRecord extends LegacyGenericRecord {
  inpainting: boolean;
  baseline: string;
  tags?: string[] | null;
  showcases?: string[] | null;
  min_bridge_version?: number | null;
  trigger?: string[] | null;
  homepage?: string | null;
  size_on_disk_bytes?: number | null;
  optimization?: string | null;
  requirements?: Record<string, LegacyRequirementValue> | null;
}

export interface TextModelGroupNameFormat {
  separator: string;
  part_order: string[];
  author_included: boolean;
  common_author: string | null;
  template: string;
}

export interface TextModelGroupSummary {
  member_count: number;
  available_sizes: string[];
  available_quants: string[];
  common_baseline: string | null;
  any_nsfw: boolean;
  any_has_description: boolean;
  merged_tags: string[];
  name_format: TextModelGroupNameFormat;
}

export interface LegacyTextGenerationRecord extends LegacyGenericRecord {
  model_name?: string | null;
  baseline?: string | null;
  parameters?: number | null;
  display_name?: string | null;
  url?: string | null;
  tags?: string[] | null;
  instruct_format?: string | null;
  settings?: Record<string, LegacyRequirementValue> | null;
  text_model_group?: string | null;
  text_model_group_summary?: TextModelGroupSummary | null;
}

export interface LegacyClipRecord extends LegacyGenericRecord {
  pretrained_name?: string | null;
}

export type LegacyRecordUnion =
  | LegacyStableDiffusionRecord
  | LegacyTextGenerationRecord
  | LegacyClipRecord
  | LegacyGenericRecord;

export type LegacyModelsResponse = Record<string, LegacyRecordUnion>;

export type LegacyRequirementValue = number | string | boolean | number[] | string[];

// Horde API statistics types

export interface BackendVariation {
  backend: string; // e.g., 'aphrodite', 'koboldcpp', 'canonical'
  variant_name: string; // Full model name as reported by Horde API
  worker_count?: number;
  performance?: number | null;
  queued?: number | null;
  queued_jobs?: number | null;
  eta?: number | null;
  usage_day?: number;
  usage_month?: number;
  usage_total?: number;
}

export interface HordeModelUsageStats {
  day: number;
  month: number;
  total: number;
}

export interface HordeWorkerSummary {
  id: string;
  name: string;
  performance: string;
  online: boolean;
  trusted: boolean;
  uptime: number;
  max_length?: number | null;
  max_context_length?: number | null;
  bridge_agent: string;
  nsfw: boolean;
}

export interface BackendCombinedModelStatistics {
  worker_count?: number;
  queued_jobs?: number | null;
  performance?: number | null;
  eta?: number | null;
  queued?: number | null;
  usage_stats?: HordeModelUsageStats | null;
  worker_summaries?: Record<string, HordeWorkerSummary> | null;
  backend_variations?: Record<string, BackendVariation> | null;
  observed_at?: number;
}

export type BackendStatisticsResponse = Record<string, BackendCombinedModelStatistics>;
