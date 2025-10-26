import { LegacyRecordUnion, isLegacyStableDiffusionRecord } from '../models';
import { UnifiedModelData, GroupedTextModel } from '../models/unified-model';
import { HordeModelUsageStats } from '../models/horde-api.models';

/**
 * Preferred file hosts for model downloads (can be extended in future)
 */
export const PREFERRED_FILE_HOSTS = ['huggingface.co'];

/**
 * Default audit thresholds by category
 * Values represent minimum usage percentage (0-100)
 * @deprecated Use AUDIT_FILTER_DEFAULTS instead
 */
export const AUDIT_DEFAULTS_BY_CATEGORY: Record<string, number> = {
  image_generation: 0.1,
  text_generation: 0.05,
  clip: 0.1,
  blip: 0.1,
  codeformer: 0.1,
  controlnet: 0.1,
  esrgan: 0.1,
  gfpgan: 0.1,
  safety_checker: 0.1,
  miscellaneous: 0.1,
};

/**
 * Default values for filter inputs by category
 * These are reasonable starting values when a filter is enabled
 * null means no constraint (filter disabled for that boundary)
 */
export const AUDIT_FILTER_DEFAULTS: Record<
  string,
  {
    minUsagePercentage?: number | null;
    maxUsagePercentage?: number | null;
    minWorkerCount?: number | null;
    maxWorkerCount?: number | null;
    minMonthUsage?: number | null;
    maxMonthUsage?: number | null;
    minTotalUsage?: number | null;
    maxTotalUsage?: number | null;
  }
> = {
  image_generation: {
    minUsagePercentage: null,
    maxUsagePercentage: null,
    minWorkerCount: null,
    maxWorkerCount: null,
    minMonthUsage: null,
    maxMonthUsage: null,
  },
  text_generation: {
    minTotalUsage: null,
    maxTotalUsage: null,
  },
  clip: {},
  blip: {},
  codeformer: {},
  controlnet: {},
  esrgan: {},
  gfpgan: {},
  safety_checker: {},
  miscellaneous: {},
};

/**
 * Available filter types for each category
 */
export type AuditFilterType =
  | 'usagePercentage'
  | 'workerCount'
  | 'monthUsage'
  | 'totalUsage'
  | 'hosts'
  | 'baselines'
  | 'flagged';

/**
 * Filter configuration by category
 * Defines which filters are available for each model category
 */
export const AUDIT_FILTERS_BY_CATEGORY: Record<string, AuditFilterType[]> = {
  image_generation: [
    'usagePercentage',
    'workerCount',
    'monthUsage',
    'hosts',
    'baselines',
    'flagged',
  ],
  text_generation: ['totalUsage', 'baselines', 'flagged'],
  clip: ['hosts', 'baselines', 'flagged'],
  blip: ['hosts', 'baselines', 'flagged'],
  codeformer: ['hosts', 'baselines', 'flagged'],
  controlnet: ['hosts', 'baselines', 'flagged'],
  esrgan: ['hosts', 'baselines', 'flagged'],
  gfpgan: ['hosts', 'baselines', 'flagged'],
  safety_checker: ['hosts', 'baselines', 'flagged'],
  miscellaneous: ['hosts', 'baselines', 'flagged'],
};

/**
 * Preset filter configuration
 */
export interface AuditPreset {
  name: string;
  description: string;
  filters: {
    minUsagePercentage?: number; // Percentage of category's 30-day usage
    maxUsagePercentage?: number; // Percentage of category's 30-day usage
    minWorkerCount?: number;
    maxWorkerCount?: number;
    minMonthUsage?: number;
    maxMonthUsage?: number;
    minTotalUsage?: number;
    maxTotalUsage?: number;
    showOnlyFlagged?: boolean;
  };
}

/**
 * Quick preset filters by category
 */
export const AUDIT_FILTER_PRESETS: Record<string, AuditPreset[]> = {
  image_generation: [
    {
      name: 'Show All',
      description: 'Clear all filters',
      filters: {},
    },
    {
      name: 'Deletion Candidates',
      description: 'Low 30-day usage and few workers',
      filters: {
        maxUsagePercentage: 0.01,
        maxWorkerCount: 5,
        maxMonthUsage: 300,
      },
    },
    {
      name: 'Low Activity',
      description: 'Below 0.03% of 30-day usage',
      filters: {
        maxUsagePercentage: 0.03,
      },
    },
    {
      name: 'No Workers',
      description: 'Zero active workers',
      filters: {
        maxWorkerCount: 0,
      },
    },
  ],
  text_generation: [
    {
      name: 'Show All',
      description: 'Clear all filters',
      filters: {},
    },
    {
      name: 'Deletion Candidates',
      description: 'Very rarely used (sparse availability expected)',
      filters: {
        maxTotalUsage: 1000,
      },
    },
    {
      name: 'Rarely Used',
      description: 'Under 100 total requests',
      filters: {
        maxTotalUsage: 100,
      },
    },
    {
      name: 'Never Used',
      description: 'Zero usage',
      filters: {
        maxTotalUsage: 0,
      },
    },
  ],
  // Other categories get basic presets
  clip: [
    {
      name: 'Show All',
      description: 'Clear all filters',
      filters: {},
    },
  ],
  blip: [
    {
      name: 'Show All',
      description: 'Clear all filters',
      filters: {},
    },
  ],
  codeformer: [
    {
      name: 'Show All',
      description: 'Clear all filters',
      filters: {},
    },
  ],
  controlnet: [
    {
      name: 'Show All',
      description: 'Clear all filters',
      filters: {},
    },
  ],
  esrgan: [
    {
      name: 'Show All',
      description: 'Clear all filters',
      filters: {},
    },
  ],
  gfpgan: [
    {
      name: 'Show All',
      description: 'Clear all filters',
      filters: {},
    },
  ],
  safety_checker: [
    {
      name: 'Show All',
      description: 'Clear all filters',
      filters: {},
    },
  ],
  miscellaneous: [
    {
      name: 'Show All',
      description: 'Clear all filters',
      filters: {},
    },
  ],
};

/**
 * Extract hostname from a URL
 */
export function extractFileHostFromUrl(url: string): string {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.hostname.toLowerCase();
  } catch {
    return 'unknown';
  }
}

/**
 * Get all unique file hosts from a model's download configuration
 */
export function getModelFileHosts(model: UnifiedModelData | GroupedTextModel): string[] {
  const hosts = new Set<string>();
  const legacyModel = model as LegacyRecordUnion;

  if (legacyModel.config?.download) {
    for (const download of legacyModel.config.download) {
      if (download.file_url) {
        const host = extractFileHostFromUrl(download.file_url);
        hosts.add(host);
      }
    }
  }

  return Array.from(hosts);
}

/**
 * Calculate usage percentage relative to category total (30-day basis)
 * @param modelUsage The model's 30-day usage count
 * @param categoryTotal The category's total 30-day usage count
 * @returns Percentage of category's 30-day usage (0-100)
 */
export function calculateUsagePercentage(modelUsage: number, categoryTotal: number): number {
  if (categoryTotal === 0) return 0;
  return (modelUsage / categoryTotal) * 100;
}

/**
 * Calculate usage trends
 */
export interface UsageTrend {
  dayToMonthRatio: number | null; // day usage / month usage
  monthToTotalRatio: number | null; // month usage / total usage
}

export function calculateUsageTrend(usageStats?: {
  day: number;
  month: number;
  total: number;
}): UsageTrend {
  if (!usageStats) {
    return {
      dayToMonthRatio: null,
      monthToTotalRatio: null,
    };
  }

  return {
    dayToMonthRatio: usageStats.month > 0 ? usageStats.day / usageStats.month : null,
    monthToTotalRatio: usageStats.total > 0 ? usageStats.month / usageStats.total : null,
  };
}

/**
 * Calculate cost-benefit score (usage per GB)
 * Higher is better - more usage per unit of disk space
 */
export function getCostBenefitScore(model: UnifiedModelData | GroupedTextModel): number | null {
  const legacyModel = model as LegacyRecordUnion;

  if (!isLegacyStableDiffusionRecord(legacyModel)) {
    return null;
  }

  const sizeBytes = legacyModel.size_on_disk_bytes;
  const usage = model.usageStats ? (model.usageStats as HordeModelUsageStats).month : 0;

  if (!sizeBytes || sizeBytes === 0) {
    return null;
  }

  const sizeGB = sizeBytes / (1024 * 1024 * 1024);
  return usage / sizeGB;
}

/**
 * Deletion candidate flags for a model
 */
export interface DeletionFlags {
  zeroUsageDay: boolean;
  zeroUsageMonth: boolean;
  zeroUsageTotal: boolean;
  noActiveWorkers: boolean;
  hasMultipleHosts: boolean;
  hasNonPreferredHost: boolean;
  hasUnknownHost: boolean;
  noDownloadUrls: boolean;
}

/**
 * Get deletion candidate flags for a model
 */
export function getDeletionFlags(
  model: UnifiedModelData | GroupedTextModel,
  preferredHosts: string[] = PREFERRED_FILE_HOSTS,
): DeletionFlags {
  const hosts = getModelFileHosts(model);
  const legacyModel = model as LegacyRecordUnion;
  const stats = model.usageStats as HordeModelUsageStats | undefined;

  const flags: DeletionFlags = {
    zeroUsageDay: (stats?.day ?? 0) === 0,
    zeroUsageMonth: (stats?.month ?? 0) === 0,
    zeroUsageTotal: (stats?.total ?? 0) === 0,
    noActiveWorkers: (model.workerCount ?? 0) === 0,
    hasMultipleHosts: hosts.length > 1,
    hasNonPreferredHost: false,
    hasUnknownHost: hosts.includes('unknown'),
    noDownloadUrls: !legacyModel.config?.download || legacyModel.config.download.length === 0,
  };

  // Check if any host is not in preferred list
  if (hosts.length > 0) {
    flags.hasNonPreferredHost = hosts.some((host) => !preferredHosts.includes(host));
  }

  return flags;
}

/**
 * Check if a model is critical (high deletion risk)
 */
export function isCriticalModel(flags: DeletionFlags): boolean {
  return flags.zeroUsageMonth && flags.noActiveWorkers;
}

/**
 * Check if a model has warnings (medium deletion risk)
 */
export function hasWarnings(flags: DeletionFlags): boolean {
  return (
    flags.hasMultipleHosts ||
    flags.hasNonPreferredHost ||
    flags.noDownloadUrls ||
    flags.hasUnknownHost
  );
}

/**
 * Count active flags on a model
 */
export function countActiveFlags(flags: DeletionFlags): number {
  return Object.values(flags).filter((value) => value === true).length;
}

/**
 * Format file hosts for display
 */
export function formatFileHosts(hosts: string[]): string {
  if (hosts.length === 0) return 'None';
  return hosts.join(', ');
}

/**
 * Get badge class for a file host
 */
export function getFileHostBadgeClass(host: string): string {
  if (host === 'unknown') return 'badge-danger';
  if (PREFERRED_FILE_HOSTS.includes(host)) return 'badge-success';
  if (host.includes('civitai')) return 'badge-warning';
  return 'badge-secondary';
}
