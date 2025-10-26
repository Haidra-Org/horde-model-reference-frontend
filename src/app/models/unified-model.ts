import {
  HordeModelStatsResponse,
  HordeModelStatus,
  HordeModelUsageStats,
  HordeWorker,
} from './horde-api.models';
import {
  parseTextModelName,
  getBaseModelName,
  getNameWithoutBackend,
  type ParsedTextModelName,
} from './text-model-name';

export interface HordeWorkerSummary {
  /**
   * Worker ID
   */
  id: string;

  /**
   * Worker name
   */
  name: string;

  /**
   * Performance metric string
   */
  performance: string;

  /**
   * Whether worker is online
   */
  online: boolean;

  /**
   * Whether worker is trusted
   */
  trusted: boolean;

  /**
   * Worker uptime in seconds
   */
  uptime: number;
}

/**
 * Unified model data that combines reference data with Horde runtime stats.
 * This interface accepts any model type (image, text, controlnet, etc.) and adds
 * Horde-specific fields.
 */
export interface UnifiedModelData {
  /**
   * Model name (required, from reference data)
   */
  name: string;

  /**
   * Parsed text model name components (for text generation models only)
   */
  parsedName?: ParsedTextModelName;

  /**
   * Number of workers currently serving this model (from Horde status API)
   */
  workerCount?: number;

  /**
   * Number of queued jobs for this model (from Horde status API)
   */
  queuedJobs?: number;

  /**
   * Performance metric (from Horde status API)
   */
  performance?: number;

  /**
   * Estimated time to completion in seconds (from Horde status API)
   */
  eta?: number;

  /**
   * Queued amount (pixelsteps for image, tokens for text) (from Horde status API)
   */
  queued?: number;

  /**
   * Usage statistics from Horde (from Horde stats API)
   */
  usageStats?: HordeModelUsageStats;

  /**
   * Workers currently serving this model (from Horde workers API)
   */
  workers?: HordeWorkerSummary[];

  /**
   * Allow any other properties from the reference data
   */
  [key: string]: unknown;
}

/**
 * Grouped text model data that represents a base model with multiple backend variations
 */
export interface GroupedTextModel extends Omit<UnifiedModelData, 'name' | 'workerCount'> {
  /**
   * Base model name (without backend prefix)
   */
  name: string;

  /**
   * Flag indicating this is a grouped model
   */
  isGrouped: true;

  /**
   * Array of backend variations for this base model
   */
  variations: UnifiedModelData[];

  /**
   * Array of unique backends available for this model
   */
  availableBackends: string[];

  /**
   * Array of unique authors for this model
   */
  availableAuthors: string[];

  /**
   * Total number of workers across all backends
   */
  workerCount?: number;

  /**
   * Model description (from one of the variations)
   */
  description?: string;

  /**
   * Baseline (from one of the variations)
   */
  baseline?: string;

  /**
   * Tags (from one of the variations)
   */
  tags?: string[];

  /**
   * NSFW flag (from one of the variations)
   */
  nsfw?: boolean;

  /**
   * Parameter count (from one of the variations)
   */
  parameters?: number;
}

export function mergeModelData<T extends { name: string }>(
  referenceData: T,
  hordeStatus?: HordeModelStatus[],
  hordeStats?: HordeModelStatsResponse,
  options?: { parseTextModelNames?: boolean },
): UnifiedModelData {
  const unified: UnifiedModelData = { ...referenceData };

  // Parse text model names if requested
  if (options?.parseTextModelNames && referenceData.name) {
    unified.parsedName = parseTextModelName(referenceData.name);
  }

  if (hordeStatus) {
    const status = hordeStatus.find(
      (s) => s.name.toLowerCase() === referenceData.name?.toLowerCase(),
    );
    if (status) {
      unified.workerCount = status.count;
      unified.queuedJobs = status.jobs;
      unified.performance = status.performance;
      unified.eta = status.eta;
      unified.queued = status.queued;
    }
  }

  if (hordeStats && referenceData.name) {
    const modelName = referenceData.name;
    const exactMatch =
      hordeStats.day[modelName] !== undefined ||
      hordeStats.month[modelName] !== undefined ||
      hordeStats.total[modelName] !== undefined;

    if (exactMatch) {
      unified.usageStats = {
        day: hordeStats.day[modelName] || 0,
        month: hordeStats.month[modelName] || 0,
        total: hordeStats.total[modelName] || 0,
      };
    } else {
      const lowerModelName = modelName.toLowerCase();
      let matchedKey: string | undefined;

      for (const key of Object.keys(hordeStats.total)) {
        if (key.toLowerCase() === lowerModelName) {
          matchedKey = key;
          break;
        }
      }

      if (matchedKey) {
        unified.usageStats = {
          day: hordeStats.day[matchedKey] || 0,
          month: hordeStats.month[matchedKey] || 0,
          total: hordeStats.total[matchedKey] || 0,
        };
      }
    }
  }

  return unified;
}

export function mergeMultipleModels<T extends { name: string }>(
  referenceModels: T[],
  hordeStatus?: HordeModelStatus[],
  hordeStats?: HordeModelStatsResponse,
  options?: { parseTextModelNames?: boolean },
): UnifiedModelData[] {
  return referenceModels.map((model) => mergeModelData(model, hordeStatus, hordeStats, options));
}

export function sortByWorkerCount(
  models: UnifiedModelData[],
  descending = true,
): UnifiedModelData[] {
  return [...models].sort((a, b) => {
    const aCount = a.workerCount ?? 0;
    const bCount = b.workerCount ?? 0;
    return descending ? bCount - aCount : aCount - bCount;
  });
}

export function sortByUsageTotal(
  models: UnifiedModelData[],
  descending = true,
): UnifiedModelData[] {
  return [...models].sort((a, b) => {
    const aTotal = a.usageStats?.total ?? 0;
    const bTotal = b.usageStats?.total ?? 0;
    return descending ? bTotal - aTotal : aTotal - bTotal;
  });
}

export function filterByMinWorkerCount(
  models: UnifiedModelData[],
  minCount: number,
): UnifiedModelData[] {
  return models.filter((m) => (m.workerCount ?? 0) >= minCount);
}

export function hasHordeData(model: UnifiedModelData): boolean {
  return !!(
    model.workerCount !== undefined ||
    model.queuedJobs !== undefined ||
    model.usageStats !== undefined
  );
}

export function getWorkersForModel(
  modelName: string,
  workers: HordeWorker[],
): HordeWorkerSummary[] {
  const lowerModelName = modelName.toLowerCase();

  return workers
    .filter((worker) => worker.models.some((m) => m.toLowerCase() === lowerModelName))
    .map((worker) => ({
      id: worker.id,
      name: worker.name,
      performance: worker.performance,
      online: worker.online,
      trusted: worker.trusted,
      uptime: worker.uptime,
    }));
}

export function associateWorkersWithModels<T extends { name: string }>(
  referenceModels: T[],
  workers: HordeWorker[],
  hordeStatus?: HordeModelStatus[],
  hordeStats?: HordeModelStatsResponse,
  options?: { parseTextModelNames?: boolean },
): UnifiedModelData[] {
  return referenceModels.map((model) => {
    const unified = mergeModelData(model, hordeStatus, hordeStats, options);
    const modelWorkers = getWorkersForModel(model.name, workers);

    if (modelWorkers.length > 0) {
      unified.workers = modelWorkers;
    }

    return unified;
  });
}

export function hasActiveWorkers(model: UnifiedModelData): boolean {
  // Check if we have worker count data (from Horde status API)
  if (model.workerCount !== undefined && model.workerCount > 0) {
    return true;
  }

  // Fall back to checking the detailed workers array if available
  return !!model.workers && model.workers.length > 0 && model.workers.some((w) => w.online);
}

/**
 * Get the base model name for display purposes (without backend prefix)
 *
 * @param model The unified model data
 * @returns The base model name to display
 */
export function getDisplayName(model: UnifiedModelData): string {
  if (model.parsedName) {
    return getBaseModelName(model.name);
  }
  return model.name;
}

/**
 * Group text generation models by their base name (collapsing backend and author variations)
 *
 * @param models Array of unified model data
 * @returns Map of base names to arrays of model variations
 */
export function groupTextModelsByBaseName(
  models: UnifiedModelData[],
): Map<string, UnifiedModelData[]> {
  const groups = new Map<string, UnifiedModelData[]>();

  for (const model of models) {
    // Group by just the final model name component (no backend, no author)
    const baseName = model.parsedName ? getBaseModelName(model.name) : model.name;

    if (!groups.has(baseName)) {
      groups.set(baseName, []);
    }
    groups.get(baseName)!.push(model);
  }

  return groups;
}

/**
 * Get all backend variations available for a text model
 *
 * @param models Array of unified model data
 * @param baseModelName The base model name to find variations for
 * @returns Array of models matching the base name
 */
export function getBackendVariations(
  models: UnifiedModelData[],
  baseModelName: string,
): UnifiedModelData[] {
  return models.filter((model) => {
    const modelBaseName = model.parsedName ? getBaseModelName(model.name) : model.name;
    return modelBaseName.toLowerCase() === baseModelName.toLowerCase();
  });
}

/**
 * Find a model by checking all possible name variations
 * Useful for finding text models that might have different backend prefixes
 *
 * @param models Array of unified model data
 * @param searchName The name to search for (can include or exclude backend)
 * @returns The matching model or undefined
 */
export function findModelByNameVariation(
  models: UnifiedModelData[],
  searchName: string,
): UnifiedModelData | undefined {
  // First try exact match
  const exactMatch = models.find((m) => m.name.toLowerCase() === searchName.toLowerCase());
  if (exactMatch) {
    return exactMatch;
  }

  // For text models, try matching by base name (without backend but with author)
  const searchBaseName = getNameWithoutBackend(searchName).toLowerCase();
  const match = models.find((model) => {
    if (!model.parsedName) {
      return false;
    }
    const modelBaseName = getNameWithoutBackend(model.name).toLowerCase();
    return modelBaseName === searchBaseName;
  });

  if (match) {
    return match;
  }

  // Try matching just the model name (without backend and author)
  const searchModelName = getBaseModelName(searchName).toLowerCase();
  return models.find((model) => {
    if (!model.parsedName) {
      return false;
    }
    const modelName = getBaseModelName(model.name).toLowerCase();
    return modelName === searchModelName;
  });
}

/**
 * Merge stats from multiple backend variations of the same model
 *
 * @param models Array of model variations for the same base model
 * @returns Aggregated stats across all variations
 */
export function aggregateModelVariations(models: UnifiedModelData[]): {
  totalWorkerCount: number;
  totalQueuedJobs: number;
  combinedUsageStats?: HordeModelUsageStats;
  allWorkers: HordeWorkerSummary[];
} {
  const result = {
    totalWorkerCount: 0,
    totalQueuedJobs: 0,
    combinedUsageStats: undefined as HordeModelUsageStats | undefined,
    allWorkers: [] as HordeWorkerSummary[],
  };

  const usageDay = new Map<string, number>();
  const usageMonth = new Map<string, number>();
  const usageTotal = new Map<string, number>();

  for (const model of models) {
    result.totalWorkerCount += model.workerCount ?? 0;
    result.totalQueuedJobs += model.queuedJobs ?? 0;

    if (model.workers) {
      // Use a Set to avoid duplicate workers
      const workerIds = new Set(result.allWorkers.map((w) => w.id));
      for (const worker of model.workers) {
        if (!workerIds.has(worker.id)) {
          result.allWorkers.push(worker);
          workerIds.add(worker.id);
        }
      }
    }

    if (model.usageStats) {
      // Aggregate usage stats by model name key
      const key = model.name;
      usageDay.set(key, model.usageStats.day);
      usageMonth.set(key, model.usageStats.month);
      usageTotal.set(key, model.usageStats.total);
    }
  }

  // Sum up all usage stats
  if (usageDay.size > 0 || usageMonth.size > 0 || usageTotal.size > 0) {
    result.combinedUsageStats = {
      day: Array.from(usageDay.values()).reduce((sum, val) => sum + val, 0),
      month: Array.from(usageMonth.values()).reduce((sum, val) => sum + val, 0),
      total: Array.from(usageTotal.values()).reduce((sum, val) => sum + val, 0),
    };
  }

  return result;
}

/**
 * Convert grouped text models into a flat list with aggregated stats
 *
 * @param models Array of unified model data
 * @returns Array with grouped models (one per base name) for text models with variations
 */
export function createGroupedTextModels(
  models: UnifiedModelData[],
): (UnifiedModelData | GroupedTextModel)[] {
  const textModels = models.filter((m) => m.parsedName !== undefined);
  const otherModels = models.filter((m) => m.parsedName === undefined);

  if (textModels.length === 0) {
    return models;
  }

  const groups = groupTextModelsByBaseName(textModels);
  const result: (UnifiedModelData | GroupedTextModel)[] = [...otherModels];

  for (const [baseName, variations] of groups.entries()) {
    if (variations.length === 1) {
      // Single variation - add as-is
      result.push(variations[0]);
    } else {
      // Multiple variations - create grouped model
      const aggregated = aggregateModelVariations(variations);
      const primaryVariation = variations[0]; // Use first variation as base

      // Extract unique backends and authors
      const backends = new Set<string>();
      const authors = new Set<string>();
      for (const variation of variations) {
        if (variation.parsedName?.backend) {
          backends.add(variation.parsedName.backend);
        }
        if (variation.parsedName?.author) {
          authors.add(variation.parsedName.author);
        }
      }

      // Type assertion to access legacy fields
      const legacyPrimary = primaryVariation as Record<string, unknown>;

      const grouped: GroupedTextModel = {
        name: baseName,
        isGrouped: true,
        variations,
        availableBackends: Array.from(backends),
        availableAuthors: Array.from(authors),
        workerCount: aggregated.totalWorkerCount,
        queuedJobs: aggregated.totalQueuedJobs,
        usageStats: aggregated.combinedUsageStats,
        workers: aggregated.allWorkers,
        parsedName: primaryVariation.parsedName,
        description: legacyPrimary['description'] as string | undefined,
        baseline: legacyPrimary['baseline'] as string | undefined,
        tags: legacyPrimary['tags'] as string[] | undefined,
        nsfw: legacyPrimary['nsfw'] as boolean | undefined,
        parameters: legacyPrimary['parameters'] as number | undefined,
      };

      result.push(grouped);
    }
  }

  return result;
}

/**
 * Check if a model is a grouped text model
 *
 * @param model The model to check
 * @returns True if the model is a grouped text model
 */
export function isGroupedTextModel(
  model: UnifiedModelData | GroupedTextModel,
): model is GroupedTextModel {
  return 'isGrouped' in model && model.isGrouped === true;
}
