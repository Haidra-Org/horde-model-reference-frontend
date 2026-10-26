import type { DownloadRecord } from '../api-client';
import type { ModelReferenceCategory } from '../models/api.models';
import { simplifiedToLegacyConfig } from './config-converter';
import { applyLegacyFixedFields } from './write-record';

export function prepareWriteRequest(
  record: Record<string, unknown>,
  category: ModelReferenceCategory,
  format: string,
): Record<string, unknown> {
  if (format !== 'legacy') return { ...record, record_type: category };
  const config = record['config'] as { download?: DownloadRecord[] } | undefined;
  return applyLegacyFixedFields(
    {
      ...record,
      config: { ...config, ...simplifiedToLegacyConfig({ download: config?.download ?? [] }) },
    },
    category,
  );
}
