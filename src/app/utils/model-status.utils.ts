/**
 * Utilities for determining model status badges (popular, trending, needs workers, new)
 */

export interface ModelStatusBadges {
  /** Model is in top 25% of usage */
  isPopular: boolean;
  /** Model has increasing usage trend */
  isTrending: boolean;
  /** Model has zero active workers */
  needsWorkers: boolean;
  /** Model was created in last 30 days */
  isNew: boolean;
}

/**
 * Calculate percentile for a value in a dataset
 */
function calculatePercentile(value: number, allValues: number[]): number {
  if (allValues.length === 0) return 0;

  const sorted = [...allValues].sort((a, b) => a - b);
  const countBelow = sorted.filter((v) => v < value).length;
  return (countBelow / sorted.length) * 100;
}

/**
 * Determine model status badges based on statistics
 */
export function getModelStatusBadges(
  model: {
    total_usage_count?: number;
    month_usage_count?: number;
    active_workers?: number;
    created_at?: string;
  },
  allModels: {
    total_usage_count?: number;
  }[]
): ModelStatusBadges {
  const totalUsage = model.total_usage_count || 0;
  const monthUsage = model.month_usage_count || 0;
  const activeWorkers = model.active_workers || 0;
  const createdAt = model.created_at;

  // Calculate if popular (top 25% of usage)
  const allUsageCounts = allModels.map((m) => m.total_usage_count || 0);
  const usagePercentile = calculatePercentile(totalUsage, allUsageCounts);
  const isPopular = usagePercentile >= 75 && totalUsage > 0;

  // Calculate if trending (recent usage is significant portion of total)
  const isTrending = totalUsage > 0 && monthUsage / totalUsage > 0.5 && monthUsage > 100;

  // Check if needs workers
  const needsWorkers = activeWorkers === 0;

  // Check if new (created in last 30 days)
  let isNew = false;
  if (createdAt) {
    const createdDate = new Date(createdAt);
    const daysSinceCreation = (Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
    isNew = daysSinceCreation <= 30;
  }

  return {
    isPopular,
    isTrending,
    needsWorkers,
    isNew,
  };
}

/**
 * Get badge icon SVG path for each status type
 */
export function getStatusBadgeIcon(status: keyof ModelStatusBadges): string {
  switch (status) {
    case 'isPopular':
      // Star icon
      return 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z';
    case 'isTrending':
      // Trending up icon
      return 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6';
    case 'needsWorkers':
      // Alert icon
      return 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z';
    case 'isNew':
      // Sparkles icon
      return 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z';
    default:
      return '';
  }
}

/**
 * Get badge label text
 */
export function getStatusBadgeLabel(status: keyof ModelStatusBadges): string {
  switch (status) {
    case 'isPopular':
      return 'Popular';
    case 'isTrending':
      return 'Trending';
    case 'needsWorkers':
      return 'Needs Workers';
    case 'isNew':
      return 'New';
    default:
      return '';
  }
}

/**
 * Get badge CSS class
 */
export function getStatusBadgeClass(status: keyof ModelStatusBadges): string {
  switch (status) {
    case 'isPopular':
      return 'badge-popular';
    case 'isTrending':
      return 'badge-trending';
    case 'needsWorkers':
      return 'badge-needs-workers';
    case 'isNew':
      return 'badge-new';
    default:
      return '';
  }
}

/**
 * Get tooltip text explaining the badge
 */
export function getStatusBadgeTooltip(status: keyof ModelStatusBadges): string {
  switch (status) {
    case 'isPopular':
      return 'This model is in the top 25% most used models';
    case 'isTrending':
      return 'This model has increasing usage recently (over 50% of total usage in last 30 days)';
    case 'needsWorkers':
      return 'No workers are currently serving this model. It cannot be used for generations.';
    case 'isNew':
      return 'This model was added within the last 30 days';
    default:
      return '';
  }
}

/**
 * Sort models by priority for display (popular/trending first, then needs workers, then rest)
 */
export function sortModelsByPriority<T extends { total_usage_count?: number; active_workers?: number }>(
  models: T[],
  allModels: T[]
): T[] {
  return [...models].sort((a, b) => {
    const badgesA = getModelStatusBadges(a, allModels);
    const badgesB = getModelStatusBadges(b, allModels);

    // Popular models first
    if (badgesA.isPopular && !badgesB.isPopular) return -1;
    if (!badgesA.isPopular && badgesB.isPopular) return 1;

    // Then trending
    if (badgesA.isTrending && !badgesB.isTrending) return -1;
    if (!badgesA.isTrending && badgesB.isTrending) return 1;

    // Then by usage count
    const usageA = a.total_usage_count || 0;
    const usageB = b.total_usage_count || 0;
    return usageB - usageA;
  });
}

/**
 * Filter models by status badges
 */
export function filterModelsByStatus<T extends { total_usage_count?: number; month_usage_count?: number; active_workers?: number; created_at?: string }>(
  models: T[],
  allModels: T[],
  filter: {
    onlyPopular?: boolean;
    onlyTrending?: boolean;
    onlyNeedsWorkers?: boolean;
    onlyNew?: boolean;
    hasWorkers?: boolean;
  }
): T[] {
  return models.filter((model) => {
    const badges = getModelStatusBadges(model, allModels);

    if (filter.onlyPopular && !badges.isPopular) return false;
    if (filter.onlyTrending && !badges.isTrending) return false;
    if (filter.onlyNeedsWorkers && !badges.needsWorkers) return false;
    if (filter.onlyNew && !badges.isNew) return false;
    if (filter.hasWorkers !== undefined) {
      const hasWorkers = !badges.needsWorkers;
      if (filter.hasWorkers !== hasWorkers) return false;
    }

    return true;
  });
}
