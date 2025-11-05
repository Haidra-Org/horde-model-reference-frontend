import { LegacyRecordUnion } from '../models';
import { UnifiedModelData, GroupedTextModel } from '../models/unified-model';

export const PREFERRED_FILE_HOSTS = ['huggingface.co'];

export const BACKEND_AUDIT_PRESETS = {
  DELETION_CANDIDATES: 'deletion_candidates',
  ZERO_USAGE: 'zero_usage',
  NO_WORKERS: 'no_workers',
  MISSING_DATA: 'missing_data',
  HOST_ISSUES: 'host_issues',
  CRITICAL: 'critical',
  LOW_USAGE: 'low_usage',
} as const;

export const PRESET_NAME_TO_BACKEND: Record<string, string | undefined> = {
  'Show All': undefined,
  'Deletion Candidates': BACKEND_AUDIT_PRESETS.DELETION_CANDIDATES,
  'Zero Usage': BACKEND_AUDIT_PRESETS.ZERO_USAGE,
  'No Workers': BACKEND_AUDIT_PRESETS.NO_WORKERS,
  'Missing Data': BACKEND_AUDIT_PRESETS.MISSING_DATA,
  'Host Issues': BACKEND_AUDIT_PRESETS.HOST_ISSUES,
  Critical: BACKEND_AUDIT_PRESETS.CRITICAL,
  'Low Usage': BACKEND_AUDIT_PRESETS.LOW_USAGE,
};

export interface AuditPreset {
  name: string;
  description: string;
  filters: {
    minUsagePercentage?: number;
    maxUsagePercentage?: number;
    minWorkerCount?: number;
    maxWorkerCount?: number;
    minMonthUsage?: number;
    maxMonthUsage?: number;
    minTotalUsage?: number;
    maxTotalUsage?: number;
    showOnlyFlagged?: boolean;
  };
}

export interface UsageTrend {
  dayToMonthRatio: number | null;
  monthToTotalRatio: number | null;
}

export const AUDIT_FILTER_PRESETS: Record<string, AuditPreset[]> = {
  image_generation: [
    { name: 'Show All', description: 'Clear all filters', filters: {} },
    {
      name: 'Deletion Candidates',
      description: 'Models with any flags',
      filters: { showOnlyFlagged: true },
    },
    { name: 'Zero Usage', description: 'Zero monthly usage', filters: { maxMonthUsage: 0 } },
    { name: 'No Workers', description: 'No active workers', filters: { maxWorkerCount: 0 } },
    { name: 'Missing Data', description: 'Missing data', filters: { showOnlyFlagged: true } },
    { name: 'Host Issues', description: 'File hosting issues', filters: { showOnlyFlagged: true } },
    {
      name: 'Critical',
      description: 'Critical state',
      filters: { maxMonthUsage: 0, maxWorkerCount: 0 },
    },
    { name: 'Low Usage', description: 'Low usage', filters: { maxUsagePercentage: 0.1 } },
  ],
  text_generation: [
    { name: 'Show All', description: 'Clear all filters', filters: {} },
    {
      name: 'Deletion Candidates',
      description: 'Models with any flags',
      filters: { showOnlyFlagged: true },
    },
    { name: 'Zero Usage', description: 'Zero total usage', filters: { maxTotalUsage: 0 } },
    { name: 'No Workers', description: 'No active workers', filters: { showOnlyFlagged: true } },
    { name: 'Missing Data', description: 'Missing data', filters: { showOnlyFlagged: true } },
    { name: 'Host Issues', description: 'File hosting issues', filters: { showOnlyFlagged: true } },
    { name: 'Critical', description: 'Critical state', filters: { showOnlyFlagged: true } },
    { name: 'Low Usage', description: 'Low usage', filters: { maxTotalUsage: 1000 } },
  ],
  clip: [{ name: 'Show All', description: 'Clear all filters', filters: {} }],
  blip: [{ name: 'Show All', description: 'Clear all filters', filters: {} }],
  codeformer: [{ name: 'Show All', description: 'Clear all filters', filters: {} }],
  controlnet: [{ name: 'Show All', description: 'Clear all filters', filters: {} }],
  esrgan: [{ name: 'Show All', description: 'Clear all filters', filters: {} }],
  gfpgan: [{ name: 'Show All', description: 'Clear all filters', filters: {} }],
  safety_checker: [{ name: 'Show All', description: 'Clear all filters', filters: {} }],
  miscellaneous: [{ name: 'Show All', description: 'Clear all filters', filters: {} }],
};

export function getModelFileHosts(model: UnifiedModelData | GroupedTextModel): string[] {
  const legacyModel = model as LegacyRecordUnion;
  if (!legacyModel.config?.download || legacyModel.config.download.length === 0) return [];

  const hosts = new Set<string>();
  for (const downloadEntry of legacyModel.config.download) {
    if (!downloadEntry.file_url) continue;
    try {
      hosts.add(new URL(downloadEntry.file_url).hostname);
    } catch {
      hosts.add('unknown');
    }
  }
  return Array.from(hosts);
}

export function formatFileHosts(hosts: string[]): string {
  return hosts.length === 0 ? 'None' : hosts.join(', ');
}

export function getFileHostBadgeClass(host: string): string {
  if (host === 'unknown') return 'badge-danger';
  if (PREFERRED_FILE_HOSTS.includes(host)) return 'badge-success';
  return 'badge-warning';
}
