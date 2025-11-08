/**
 * Test helpers and builders for audit-related types
 */

import {
  CategoryAuditResponse,
  CategoryAuditSummary,
  DeletionRiskFlags,
  ModelAuditInfo,
  UsageTrend,
  MODEL_REFERENCE_CATEGORY,
} from '../../api-client';

/**
 * Creates a mock DeletionRiskFlags object with all flags set to false by default
 */
export function createMockDeletionRiskFlags(
  overrides?: Partial<DeletionRiskFlags>,
): DeletionRiskFlags {
  return {
    zero_usage_day: false,
    zero_usage_month: false,
    zero_usage_total: false,
    no_active_workers: false,
    has_multiple_hosts: false,
    has_non_preferred_host: false,
    has_unknown_host: false,
    no_download_urls: false,
    missing_description: false,
    missing_baseline: false,
    low_usage: false,
    ...overrides,
  };
}

/**
 * Creates a mock UsageTrend object with null ratios by default
 */
export function createMockUsageTrend(overrides?: Partial<UsageTrend>): UsageTrend {
  return {
    day_to_month_ratio: null,
    month_to_total_ratio: null,
    ...overrides,
  };
}

/**
 * Creates a mock ModelAuditInfo object with minimal required fields
 */
export function createMockModelAuditInfo(overrides?: Partial<ModelAuditInfo>): ModelAuditInfo {
  const flags = overrides?.deletion_risk_flags ?? createMockDeletionRiskFlags();
  const workerCount = overrides?.worker_count ?? 0;
  const usageMonth = overrides?.usage_month ?? 0;

  // Compute is_critical and has_warning based on flags (matching backend logic)
  const is_critical = !!(flags.zero_usage_month && flags.no_active_workers);
  const has_warning = !!(
    flags.has_multiple_hosts ||
    flags.has_non_preferred_host ||
    flags.no_download_urls ||
    flags.has_unknown_host
  );

  return {
    name: 'test-model',
    category: 'image_generation' as MODEL_REFERENCE_CATEGORY,
    deletion_risk_flags: flags,
    at_risk: false,
    risk_score: 0,
    usage_trend: createMockUsageTrend(),
    worker_count: workerCount,
    usage_day: 0,
    usage_month: usageMonth,
    usage_total: 0,
    usage_hour: null,
    usage_minute: null,
    usage_percentage_of_category: 0,
    cost_benefit_score: null,
    size_gb: null,
    baseline: null,
    nsfw: null,
    has_description: false,
    download_count: 0,
    download_hosts: [],
    is_critical,
    has_warning,
    ...overrides,
  };
}

/**
 * Creates a mock CategoryAuditSummary with minimal required fields
 */
export function createMockCategoryAuditSummary(
  overrides?: Partial<CategoryAuditSummary>,
): CategoryAuditSummary {
  return {
    total_models: 0,
    models_at_risk: 0,
    models_critical: 0,
    models_with_warnings: 0,
    models_with_zero_day_usage: 0,
    models_with_zero_month_usage: 0,
    models_with_zero_total_usage: 0,
    models_with_no_active_workers: 0,
    models_with_no_downloads: 0,
    models_with_non_preferred_hosts: 0,
    models_with_multiple_hosts: 0,
    models_with_low_usage: 0,
    average_risk_score: 0,
    category_total_month_usage: 0,
    ...overrides,
  };
}

/**
 * Creates a mock CategoryAuditResponse with minimal required fields
 */
export function createMockCategoryAuditResponse(
  overrides?: Partial<CategoryAuditResponse>,
): CategoryAuditResponse {
  return {
    category: 'image_generation' as MODEL_REFERENCE_CATEGORY,
    category_total_month_usage: 0,
    total_count: 0,
    returned_count: 0,
    offset: 0,
    limit: null,
    models: [],
    summary: createMockCategoryAuditSummary(),
    ...overrides,
  };
}

/**
 * Builder pattern for creating ModelAuditInfo test data
 */
export class ModelAuditInfoBuilder {
  private info: ModelAuditInfo;

  constructor() {
    this.info = createMockModelAuditInfo();
  }

  withName(name: string): this {
    this.info.name = name;
    return this;
  }

  withCategory(category: MODEL_REFERENCE_CATEGORY): this {
    this.info.category = category;
    return this;
  }

  withUsage(day: number, month: number, total: number): this {
    this.info.usage_day = day;
    this.info.usage_month = month;
    this.info.usage_total = total;
    return this;
  }

  withUsagePercentage(percentage: number): this {
    this.info.usage_percentage_of_category = percentage;
    return this;
  }

  withWorkerCount(count: number): this {
    this.info.worker_count = count;
    return this;
  }

  withTrend(dayToMonth: number | null, monthToTotal: number | null): this {
    this.info.usage_trend = {
      day_to_month_ratio: dayToMonth,
      month_to_total_ratio: monthToTotal,
    };
    return this;
  }

  withBaseline(baseline: string): this {
    this.info.baseline = baseline;
    return this;
  }

  withNsfw(nsfw: boolean): this {
    this.info.nsfw = nsfw;
    return this;
  }

  withSizeGB(size: number): this {
    this.info.size_gb = size;
    return this;
  }

  withCostBenefitScore(score: number): this {
    this.info.cost_benefit_score = score;
    return this;
  }

  withDescription(hasDescription: boolean): this {
    this.info.has_description = hasDescription;
    return this;
  }

  withDownloads(count: number, hosts: string[]): this {
    this.info.download_count = count;
    this.info.download_hosts = hosts;
    return this;
  }

  withFlags(flags: Partial<DeletionRiskFlags>): this {
    this.info.deletion_risk_flags = createMockDeletionRiskFlags(flags);
    return this;
  }

  withCriticalFlags(): this {
    this.info.deletion_risk_flags = createMockDeletionRiskFlags({
      zero_usage_month: true,
      no_active_workers: true,
    });
    this.info.at_risk = true;
    this.info.risk_score = 2;
    this.info.worker_count = 0;
    this.info.usage_month = 0;
    return this;
  }

  withWarningFlags(): this {
    this.info.deletion_risk_flags = createMockDeletionRiskFlags({
      has_multiple_hosts: true,
      has_non_preferred_host: true,
    });
    this.info.at_risk = true;
    this.info.risk_score = 2;
    return this;
  }

  withZeroUsageDay(): this {
    this.info.deletion_risk_flags = createMockDeletionRiskFlags({
      zero_usage_day: true,
    });
    this.info.usage_day = 0;
    return this;
  }

  withZeroUsageMonth(): this {
    this.info.deletion_risk_flags = createMockDeletionRiskFlags({
      zero_usage_month: true,
    });
    this.info.usage_month = 0;
    return this;
  }

  withZeroUsageTotal(): this {
    this.info.deletion_risk_flags = createMockDeletionRiskFlags({
      zero_usage_total: true,
    });
    this.info.usage_total = 0;
    return this;
  }

  withNoActiveWorkers(): this {
    this.info.deletion_risk_flags = createMockDeletionRiskFlags({
      no_active_workers: true,
    });
    this.info.worker_count = 0;
    return this;
  }

  withRiskScore(score: number): this {
    this.info.risk_score = score;
    this.info.at_risk = score > 0;
    return this;
  }

  build(): ModelAuditInfo {
    return this.info;
  }
}

/**
 * Builder pattern for creating CategoryAuditResponse test data
 */
export class CategoryAuditResponseBuilder {
  private response: CategoryAuditResponse;

  constructor() {
    this.response = createMockCategoryAuditResponse();
  }

  withCategory(category: MODEL_REFERENCE_CATEGORY): this {
    this.response.category = category;
    return this;
  }

  withCategoryTotalUsage(total: number): this {
    this.response.category_total_month_usage = total;
    return this;
  }

  withModels(models: ModelAuditInfo[]): this {
    this.response.models = models;
    this.response.total_count = models.length;
    this.response.returned_count = models.length;
    return this;
  }

  withPagination(total: number, returned: number, offset: number, limit: number | null): this {
    this.response.total_count = total;
    this.response.returned_count = returned;
    this.response.offset = offset;
    this.response.limit = limit;
    return this;
  }

  withSummary(summary: Partial<CategoryAuditSummary>): this {
    this.response.summary = createMockCategoryAuditSummary(summary);
    return this;
  }

  build(): CategoryAuditResponse {
    return this.response;
  }
}

/**
 * Generates a large dataset of ModelAuditInfo for performance testing
 */
export function generateLargeAuditDataset(count: number): ModelAuditInfo[] {
  const models: ModelAuditInfo[] = [];
  const baselines = ['stable_diffusion_1', 'stable_diffusion_2', 'stable_diffusion_xl', 'flux_1'];
  const hosts = ['huggingface.co', 'civitai.com', 'github.com'];

  for (let i = 0; i < count; i++) {
    const hasUsage = Math.random() > 0.3;
    const hasWorkers = Math.random() > 0.2;
    const usageMonth = hasUsage ? Math.floor(Math.random() * 10000) : 0;
    const usageTotal = usageMonth * (1 + Math.random() * 10);
    const usageDay = hasUsage ? Math.floor(usageMonth * (0.01 + Math.random() * 0.1)) : 0;

    models.push(
      new ModelAuditInfoBuilder()
        .withName(`model-${i}`)
        .withCategory('image_generation' as MODEL_REFERENCE_CATEGORY)
        .withUsage(usageDay, usageMonth, usageTotal)
        .withUsagePercentage((usageMonth / 1000000) * 100)
        .withWorkerCount(hasWorkers ? Math.floor(Math.random() * 20) : 0)
        .withTrend(
          usageMonth > 0 ? usageDay / usageMonth : null,
          usageTotal > 0 ? usageMonth / usageTotal : null,
        )
        .withBaseline(baselines[Math.floor(Math.random() * baselines.length)])
        .withNsfw(Math.random() > 0.5)
        .withSizeGB(1 + Math.random() * 10)
        .withCostBenefitScore(Math.random() * 100)
        .withDescription(Math.random() > 0.3)
        .withDownloads(
          Math.floor(Math.random() * 5),
          Math.random() > 0.5 ? [hosts[Math.floor(Math.random() * hosts.length)]] : [],
        )
        .withFlags({
          zero_usage_day: usageDay === 0,
          zero_usage_month: usageMonth === 0,
          zero_usage_total: usageTotal === 0,
          no_active_workers: !hasWorkers,
          has_multiple_hosts: Math.random() > 0.8,
          has_non_preferred_host: Math.random() > 0.9,
          has_unknown_host: Math.random() > 0.95,
          no_download_urls: Math.random() > 0.9,
          missing_description: Math.random() > 0.7,
          missing_baseline: Math.random() > 0.95,
          low_usage: usageMonth > 0 && usageMonth < 100,
        })
        .withRiskScore(Math.floor(Math.random() * 11))
        .build(),
    );
  }

  return models;
}

/**
 * Creates a CategoryAuditResponse with a large dataset for performance testing
 */
export function generateLargeAuditResponse(
  modelCount: number,
  category: MODEL_REFERENCE_CATEGORY = 'image_generation' as MODEL_REFERENCE_CATEGORY,
): CategoryAuditResponse {
  const models = generateLargeAuditDataset(modelCount);
  const totalMonthUsage = models.reduce((sum, m) => sum + (m.usage_month ?? 0), 0);

  return new CategoryAuditResponseBuilder()
    .withCategory(category)
    .withCategoryTotalUsage(totalMonthUsage)
    .withModels(models)
    .withSummary({
      total_models: modelCount,
      models_at_risk: models.filter((m) => m.at_risk).length,
      models_critical: models.filter(
        (m) => m.deletion_risk_flags?.zero_usage_month && m.deletion_risk_flags?.no_active_workers,
      ).length,
      models_with_warnings: models.filter(
        (m) =>
          m.deletion_risk_flags?.has_multiple_hosts ||
          m.deletion_risk_flags?.has_non_preferred_host ||
          m.deletion_risk_flags?.no_download_urls ||
          m.deletion_risk_flags?.has_unknown_host,
      ).length,
      models_with_zero_month_usage: models.filter((m) => (m.usage_month ?? 0) === 0).length,
      models_with_no_active_workers: models.filter((m) => (m.worker_count ?? 0) === 0).length,
      average_risk_score: models.reduce((sum, m) => sum + m.risk_score, 0) / (modelCount || 1),
      category_total_month_usage: totalMonthUsage,
    })
    .build();
}
