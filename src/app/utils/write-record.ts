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
  DownloadRecord,
  LicenseObligation,
  ModelLicensing,
  PermissionStatus,
} from '../api-client';
import type { GenericModelRecordConfig } from '../api-client/model/genericModelRecordConfig';
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

  /* licensing */
  license_expression: string;
  license_ids: string;
  commercial_use: PermissionStatus;
  redistribution: PermissionStatus;
  license_obligations: LicenseObligation[];
  license_attribution: string;
  license_evidence_source: string;
  license_evidence_description: string;
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
  const downloads: WriteFormDownload[] = (
    record['config'] as GenericModelRecordConfig
  )?.download?.map((d: DownloadRecord) => ({
    file_name: d.file_name ?? '',
    file_url: d.file_url ?? '',
    sha256sum: d.sha256sum ?? '',
    known_slow_download: d.known_slow_download ?? false,
  })) ?? [{ file_name: '', file_url: '', sha256sum: '', known_slow_download: false }];

  return {
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
  const record: Record<string, unknown> = { name: form.name.trim() };

  if (form.display_name) record['display_name'] = form.display_name;
  if (form.description) record['description'] = form.description;
  if (form.version) record['version'] = form.version;

  if (category === 'image_generation') {
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

  record['config'] = {
    download: form.download
      .filter((d) => d.file_name || d.file_url)
      .map((d) => ({
        file_name: d.file_name,
        file_url: d.file_url,
        sha256sum: d.sha256sum || undefined,
        ...(d.known_slow_download ? { known_slow_download: true } : {}),
      })),
  };

  const licenseExpression = form.license_expression.trim() || 'NOASSERTION';
  const isUnknownConclusion = licenseExpression === 'NOASSERTION';
  record['licensing'] = {
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
              ...(form.license_evidence_description.trim()
                ? { description: form.license_evidence_description.trim() }
                : {}),
            },
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
