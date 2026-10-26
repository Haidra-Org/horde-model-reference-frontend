/**
 * Write-record utilities for the Propose-a-Change wizard.
 *
 * Provides blankForm() to initialize form state and formToRecord() to
 * convert wizard form state into a canonical record (the "source of truth"
 * for the JSON pane and submission).
 *
 * Reuses existing field infrastructure:
 * - applyFixedFields() for legacy fixed-field injection
 * - simplifiedToLegacyConfig() / legacyConfigToSimplified() for config shape conversion
 */

import type {
  MODEL_REFERENCE_CATEGORY,
  LicenseObligation,
  ModelLicensing,
  PermissionStatus,
} from '../api-client';
import type { GenericModelRecordConfig } from '../api-client/model/genericModelRecordConfig';
import { legacyConfigToSimplified } from './config-converter';
import { applyFixedFields } from '../models/legacy-fixed-fields.config';
import type { ModelReferenceCategory } from '../models/api.models';

// ---------------------------------------------------------------------------
// Wizard form shape — what the wizard/JSON-editor state holds
// ---------------------------------------------------------------------------

export interface WriteFormDownload {
  file_name: string;
  file_url: string;
  sha256sum: string;
  known_slow_download: boolean;
  file_purpose?: string;
  content_hash?: string;
  size_bytes?: string;
}

export interface WriteFormState {
  name: string;
  display_name: string;
  description: string;
  version: string;

  /* image_generation fields */
  baseline: string;
  style: string;
  nsfw: boolean;
  inpainting: boolean;
  tags: string; // comma-separated in form
  trigger: string; // comma-separated in form
  homepage: string;
  min_bridge_version: string;

  /* text_generation fields */
  parameters: string; // number-as-string in form
  instruct_format: string;
  text_model_group: string;

  /* files */
  download: WriteFormDownload[];

  /** Original payload preserves schema fields without dedicated controls. */
  sourceRecord?: Record<string, unknown>;
  size_on_disk_bytes?: string;
  optimization?: string;
  showcases?: string;
  requirements?: Record<string, number | string | boolean | number[] | string[]>;
  embedded_component_hashes?: Record<string, string>;

  /* licensing */
  license_expression: string;
  license_ids: string;
  commercial_use: PermissionStatus;
  redistribution: PermissionStatus;
  license_obligations: LicenseObligation[];
  license_attribution: string;
  license_evidence_source: string;
  license_evidence_description: string;
  license_evidence_checked_at?: string;
  license_additional_evidence?: import('../api-client').LicenseEvidence[];
  license_reviewed_by: string;
  license_reviewed_at: string;
  license_notes: string;
}

/** Return a blank form state for a new model (category-aware defaults). */
export function blankForm(category: MODEL_REFERENCE_CATEGORY | string): WriteFormState {
  return {
    name: '',
    display_name: '',
    description: '',
    version: '',
    baseline: category === 'image_generation' ? 'stable_diffusion_xl' : 'llama',
    nsfw: false,
    style: 'generalist',
    inpainting: false,
    tags: '',
    trigger: '',
    parameters: '',
    instruct_format: 'ChatML',
    text_model_group: '',
    homepage: '',
    min_bridge_version: '',
    license_expression: 'NOASSERTION',
    license_ids: '',
    commercial_use: 'unknown',
    redistribution: 'unknown',
    license_obligations: [],
    license_attribution: '',
    license_evidence_source: '',
    license_evidence_description: '',
    license_reviewed_by: '',
    license_reviewed_at: '',
    license_notes: 'No reviewed licensing conclusion is currently available.',
    download: [
      {
        file_name: '',
        file_url: '',
        sha256sum: '',
        known_slow_download: false,
      },
    ],
  };
}

/** Pre-fill form state from an existing model record for editing. */
export function editFormFromRecord(
  _category: MODEL_REFERENCE_CATEGORY | string,
  record: Record<string, unknown>,
): WriteFormState {
  const licensing = record['licensing'] as ModelLicensing | null | undefined;
  const config = record['config'] as GenericModelRecordConfig | undefined;
  const downloads: WriteFormDownload[] = legacyConfigToSimplified(
    config as unknown as import('../models/api.models').LegacyConfig,
  ).download.map((d) => ({
    file_name: d.file_name ?? '',
    file_url: d.file_url ?? '',
    sha256sum: d.sha256sum ?? '',
    known_slow_download: d.known_slow_download ?? false,
    file_purpose: d.file_purpose ?? '',
    content_hash: d.content_hash ?? '',
    size_bytes: d.size_bytes != null ? String(d.size_bytes) : '',
  }));
  if (!config?.download)
    downloads.push({ file_name: '', file_url: '', sha256sum: '', known_slow_download: false });

  return {
    sourceRecord: record,
    size_on_disk_bytes:
      record['size_on_disk_bytes'] != null ? String(record['size_on_disk_bytes']) : '',
    optimization: (record['optimization'] as string) ?? '',
    showcases: Array.isArray(record['showcases'])
      ? (record['showcases'] as string[]).join('\n')
      : '',
    requirements: (record['requirements'] as WriteFormState['requirements']) ?? {},
    embedded_component_hashes: config?.embedded_component_hashes ?? {},
    name: (record['name'] as string) ?? '',
    display_name: (record['display_name'] as string) ?? '',
    description: (record['description'] as string) ?? '',
    version: (record['version'] as string) ?? '',
    baseline: (record['baseline'] as string) ?? '',
    nsfw: !!(record['nsfw'] as boolean | undefined),
    style: (record['style'] as string) ?? '',
    inpainting: !!(record['inpainting'] as boolean | undefined),
    tags: Array.isArray(record['tags']) ? (record['tags'] as string[]).join(', ') : '',
    trigger: Array.isArray(record['trigger']) ? (record['trigger'] as string[]).join(', ') : '',
    parameters: record['parameters'] != null ? String(record['parameters']) : '',
    instruct_format: (record['instruct_format'] as string) ?? '',
    text_model_group: (record['text_model_group'] as string) ?? '',
    homepage: (record['homepage'] as string) ?? '',
    min_bridge_version:
      record['min_bridge_version'] != null ? String(record['min_bridge_version']) : '',
    license_expression: licensing?.license_expression ?? 'NOASSERTION',
    license_ids: licensing?.license_ids?.join(', ') ?? '',
    commercial_use: licensing?.commercial_use ?? 'unknown',
    redistribution: licensing?.redistribution ?? 'unknown',
    license_obligations: licensing?.obligations ?? [],
    license_attribution: licensing?.attribution ?? '',
    license_evidence_source: licensing?.evidence?.[0]?.source ?? '',
    license_evidence_description: licensing?.evidence?.[0]?.description ?? '',
    license_evidence_checked_at: licensing?.evidence?.[0]?.checked_at ?? '',
    license_additional_evidence: licensing?.evidence?.slice(1) ?? [],
    license_reviewed_by: licensing?.reviewed_by ?? '',
    license_reviewed_at: licensing?.reviewed_at ?? '',
    license_notes: licensing?.notes ?? '',
    download: downloads,
  };
}

// ---------------------------------------------------------------------------
// Form → record conversion (source of truth)
// ---------------------------------------------------------------------------

/**
 * Convert wizard form state into a canonical record.
 * This is the single source of truth for the JSON pane and submission.
 */
export function formToRecord(
  form: WriteFormState,
  category: MODEL_REFERENCE_CATEGORY | string,
): Record<string, unknown> {
  const record: Record<string, unknown> = { ...form.sourceRecord, name: form.name.trim() };
  // Remove read-only response enrichment.
  delete record['guidance'];
  delete record['text_model_group_summary'];

  for (const key of ['display_name', 'description', 'version']) delete record[key];
  if (form.display_name) record['display_name'] = form.display_name;
  if (form.description) record['description'] = form.description;
  if (form.version) record['version'] = form.version;

  if (category === 'image_generation') {
    for (const key of ['inpainting', 'tags', 'trigger', 'homepage', 'min_bridge_version'])
      delete record[key];
    record['baseline'] = form.baseline;
    record['nsfw'] = form.nsfw;
    if (form.inpainting) record['inpainting'] = true;
    record['style'] = form.style;
    if (form.tags)
      record['tags'] = form.tags
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    if (form.trigger)
      record['trigger'] = form.trigger
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    if (form.homepage) record['homepage'] = form.homepage;
    if (form.min_bridge_version) record['min_bridge_version'] = Number(form.min_bridge_version);
  } else if (category === 'text_generation') {
    delete record['tags'];
    record['baseline'] = form.baseline;
    record['parameters'] = form.parameters ? Number(form.parameters) : null;
    record['nsfw'] = form.nsfw;
    record['instruct_format'] = form.instruct_format;
    record['text_model_group'] = form.text_model_group || form.name;
    if (form.tags)
      record['tags'] = form.tags
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
  }

  if (form.size_on_disk_bytes) record['size_on_disk_bytes'] = Number(form.size_on_disk_bytes);
  else delete record['size_on_disk_bytes'];
  if (category === 'image_generation') {
    record['requirements'] = form.requirements ?? {};
    if (form.optimization) record['optimization'] = form.optimization;
    else delete record['optimization'];
    record['showcases'] = (form.showcases ?? '')
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  record['config'] = {
    ...(form.sourceRecord?.['config'] as Record<string, unknown> | undefined),
    ...(Object.keys(form.embedded_component_hashes ?? {}).length
      ? { embedded_component_hashes: form.embedded_component_hashes }
      : { embedded_component_hashes: undefined }),
    download: form.download
      .filter((d) => d.file_name || d.file_url)
      .map((d) => ({
        file_name: d.file_name,
        file_url: d.file_url,
        sha256sum: d.sha256sum || undefined,
        ...(d.file_purpose ? { file_purpose: d.file_purpose } : {}),
        ...(d.content_hash ? { content_hash: d.content_hash } : {}),
        ...(d.size_bytes?.trim() ? { size_bytes: Number(d.size_bytes) } : {}),
        ...(d.known_slow_download ? { known_slow_download: true } : {}),
      })),
  };

  delete (record['config'] as Record<string, unknown>)['files'];

  const licenseExpression = form.license_expression.trim() || 'NOASSERTION';
  const isUnknownConclusion = licenseExpression === 'NOASSERTION';
  const preservedLicensing = {
    ...(form.sourceRecord?.['licensing'] as ModelLicensing | undefined),
  };
  for (const key of ['attribution', 'evidence', 'reviewed_by', 'reviewed_at', 'notes'] as const)
    delete preservedLicensing[key];
  record['licensing'] = {
    ...preservedLicensing,
    license_expression: licenseExpression,
    license_ids: isUnknownConclusion
      ? []
      : form.license_ids
          .split(',')
          .map((licenseId) => licenseId.trim())
          .filter(Boolean),
    commercial_use: isUnknownConclusion ? 'unknown' : form.commercial_use,
    redistribution: isUnknownConclusion ? 'unknown' : form.redistribution,
    obligations: isUnknownConclusion ? [] : form.license_obligations,
    ...(form.license_attribution.trim() ? { attribution: form.license_attribution.trim() } : {}),
    ...(form.license_evidence_source.trim()
      ? {
          evidence: [
            {
              source: form.license_evidence_source.trim(),
              ...(form.license_evidence_checked_at
                ? { checked_at: form.license_evidence_checked_at }
                : {}),
              ...(form.license_evidence_description.trim()
                ? { description: form.license_evidence_description.trim() }
                : {}),
            },
            ...(form.license_additional_evidence ?? []),
          ],
        }
      : {}),
    ...(form.license_reviewed_by ? { reviewed_by: form.license_reviewed_by } : {}),
    ...(form.license_reviewed_at ? { reviewed_at: form.license_reviewed_at } : {}),
    ...(form.license_notes.trim() ? { notes: form.license_notes.trim() } : {}),
  } satisfies ModelLicensing;

  return record;
}

/**
 * Apply legacy fixed fields to the record before submission.
 * Returns a new record with fixed fields merged in.
 */
export function applyLegacyFixedFields(
  record: Record<string, unknown>,
  category: ModelReferenceCategory,
): Record<string, unknown> {
  const merged = { ...record };
  return applyFixedFields(category, merged);
}

/** Reuse files/settings while requiring identity and a fresh licensing review. */
export function templateFormFromRecord(
  category: string,
  record: Record<string, unknown>,
): WriteFormState {
  const source = structuredClone(record);
  for (const key of [
    'name',
    'display_name',
    'metadata',
    'licensing',
    'text_model_group',
    'name_schema_exception',
  ])
    delete source[key];
  return editFormFromRecord(category, source);
}
