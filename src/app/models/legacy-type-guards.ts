import {
  LegacyStableDiffusionRecord,
  LegacyClipRecord,
  LegacyTextGenerationRecord,
  LegacyGenericRecord,
  LegacyRecordUnion,
  ModelReferenceCategory,
} from './api.models';

export function isLegacyStableDiffusionRecord(
  record: LegacyRecordUnion
): record is LegacyStableDiffusionRecord {
  return 'inpainting' in record && 'baseline' in record;
}

export function isLegacyTextGenerationRecord(
  record: LegacyRecordUnion
): record is LegacyTextGenerationRecord {
  return 'parameters' in record && record.parameters !== undefined;
}

export function isLegacyClipRecord(
  record: LegacyRecordUnion
): record is LegacyClipRecord {
  return 'pretrained_name' in record;
}

export function isLegacyGenericRecord(
  record: LegacyRecordUnion
): record is LegacyGenericRecord {
  return (
    !isLegacyStableDiffusionRecord(record) &&
    !isLegacyTextGenerationRecord(record) &&
    !isLegacyClipRecord(record)
  );
}

export function createDefaultRecordForCategory(
  category: ModelReferenceCategory,
  name: string
): LegacyRecordUnion {
  const baseRecord: LegacyGenericRecord = {
    name,
    config: {
      files: [],
      download: [],
    },
  };

  switch (category) {
    case 'image_generation':
      return {
        ...baseRecord,
        inpainting: false,
        baseline: 'stable_diffusion_1',
        type: 'ckpt',
      } as LegacyStableDiffusionRecord;

    case 'text_generation':
      return {
        ...baseRecord,
        parameters: 0,
      } as LegacyTextGenerationRecord;

    case 'clip':
      return {
        ...baseRecord,
        pretrained_name: '',
      } as LegacyClipRecord;

    default:
      return baseRecord;
  }
}

export function getRecordCategory(record: LegacyRecordUnion): ModelReferenceCategory | null {
  if (isLegacyStableDiffusionRecord(record)) {
    return 'image_generation';
  }
  if (isLegacyTextGenerationRecord(record)) {
    return 'text_generation';
  }
  if (isLegacyClipRecord(record)) {
    return 'clip';
  }
  return null;
}

export const BASELINE_DISPLAY_MAP: Record<string, string> = {
  stable_diffusion_1: 'Stable Diffusion 1',
  stable_diffusion_2_768: 'Stable Diffusion 2',
  stable_diffusion_2_512: 'Stable Diffusion 2 512',
  stable_diffusion_xl: 'Stable Diffusion XL',
  stable_cascade: 'Stable Cascade',
};

export const BASELINE_NORMALIZATION_MAP: Record<string, string> = {
  'stable diffusion 1': 'stable_diffusion_1',
  'stable diffusion 2': 'stable_diffusion_2_768',
  'stable diffusion 2 512': 'stable_diffusion_2_512',
  stable_diffusion_xl: 'stable_diffusion_xl',
  stable_cascade: 'stable_cascade',
};
