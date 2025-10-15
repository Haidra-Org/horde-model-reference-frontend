import {
  LegacyRecordUnion,
  isLegacyStableDiffusionRecord,
  isLegacyTextGenerationRecord,
  isLegacyClipRecord,
} from '../../models';
import { formatSizeInGB, getObjectKeysLength } from './model-row.utils';

export type FieldType = 'text' | 'link' | 'array' | 'formatted';

export interface ModelFieldConfig {
  label: string;
  type: FieldType;
  getValue: (model: LegacyRecordUnion) => string | number | string[] | null | undefined;
  formatValue?: (value: unknown) => string;
  isLink?: boolean;
  colspan?: number;
}

export const STABLE_DIFFUSION_FIELDS: ModelFieldConfig[] = [
  {
    label: 'Baseline',
    type: 'text',
    getValue: (model) =>
      isLegacyStableDiffusionRecord(model) ? model.baseline : null,
  },
  {
    label: 'Model Version',
    type: 'text',
    getValue: (model) => model.version ?? '-',
  },
  {
    label: 'Style',
    type: 'text',
    getValue: (model) => model.style ?? '-',
  },
  {
    label: 'Size',
    type: 'formatted',
    getValue: (model) =>
      isLegacyStableDiffusionRecord(model) ? model.size_on_disk_bytes : null,
    formatValue: (value) =>
      value && typeof value === 'number' ? `${formatSizeInGB(value)} GB` : '-',
  },
  {
    label: 'Homepage',
    type: 'link',
    colspan: 4,
    getValue: (model) =>
      isLegacyStableDiffusionRecord(model) ? model.homepage : null,
  },
  {
    label: 'Triggers',
    type: 'array',
    colspan: 4,
    getValue: (model) =>
      isLegacyStableDiffusionRecord(model) ? model.trigger : null,
  },
];

export const TEXT_GENERATION_FIELDS: ModelFieldConfig[] = [
  {
    label: 'Baseline',
    type: 'text',
    getValue: (model) =>
      isLegacyTextGenerationRecord(model) ? model.baseline : null,
  },
  {
    label: 'Model Version',
    type: 'text',
    getValue: (model) => model.version ?? '-',
  },
  {
    label: 'Parameters',
    type: 'formatted',
    getValue: (model) =>
      isLegacyTextGenerationRecord(model) ? model.parameters : null,
    formatValue: (value) =>
      value && typeof value === 'number' ? value.toLocaleString() : '-',
  },
  {
    label: 'Type',
    type: 'text',
    getValue: (model) => model.type ?? '-',
  },
  {
    label: 'Display Name',
    type: 'text',
    getValue: (model) =>
      isLegacyTextGenerationRecord(model) ? model.display_name : null,
  },
  {
    label: 'Model Name',
    type: 'text',
    getValue: (model) =>
      isLegacyTextGenerationRecord(model) ? model.model_name : null,
  },
  {
    label: 'Style',
    type: 'text',
    getValue: (model) => model.style ?? '-',
  },
  {
    label: 'Settings',
    type: 'formatted',
    getValue: (model) =>
      isLegacyTextGenerationRecord(model) && model.settings
        ? JSON.stringify(model.settings)
        : null,
    formatValue: (value) => {
      if (!value) return '-';
      try {
        const settings = JSON.parse(String(value)) as Record<string, unknown>;
        return `${getObjectKeysLength(settings)} setting(s)`;
      } catch {
        return '-';
      }
    },
  },
  {
    label: 'URL',
    type: 'link',
    colspan: 4,
    getValue: (model) =>
      isLegacyTextGenerationRecord(model) ? model.url : null,
  },
  {
    label: 'Features Not Supported',
    type: 'array',
    colspan: 4,
    getValue: (model) => model.features_not_supported,
  },
];

export const CLIP_FIELDS: ModelFieldConfig[] = [
  {
    label: 'Pretrained Name',
    type: 'text',
    getValue: (model) =>
      isLegacyClipRecord(model) ? model.pretrained_name : null,
  },
  {
    label: 'Model Version',
    type: 'text',
    getValue: (model) => model.version ?? '-',
  },
  {
    label: 'Type',
    type: 'text',
    getValue: (model) => model.type ?? '-',
  },
  {
    label: 'Style',
    type: 'text',
    getValue: (model) => model.style ?? '-',
  },
  {
    label: 'Features Not Supported',
    type: 'array',
    colspan: 4,
    getValue: (model) => model.features_not_supported,
  },
];

export function getFieldsForModel(model: LegacyRecordUnion): ModelFieldConfig[] {
  if (isLegacyStableDiffusionRecord(model)) {
    return STABLE_DIFFUSION_FIELDS;
  }
  if (isLegacyTextGenerationRecord(model)) {
    return TEXT_GENERATION_FIELDS;
  }
  if (isLegacyClipRecord(model)) {
    return CLIP_FIELDS;
  }
  return [];
}
