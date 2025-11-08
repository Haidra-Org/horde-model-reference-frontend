/**
 * GPU requirements and performance characteristics for different model baselines
 */

export interface GpuRequirement {
  /** Minimum VRAM in GB */
  minVramGb: number;
  /** Recommended VRAM in GB for optimal performance */
  recommendedVramGb: number;
  /** Native resolution for this baseline */
  nativeResolution: string;
  /** Speed tier: fast, medium, or slow */
  speedTier: 'fast' | 'medium' | 'slow';
  /** Human-readable speed description */
  speedDescription: string;
  /** Typical generation time estimate */
  generationTimeEstimate: string;
}

/**
 * GPU requirements map for image generation baselines
 */
export const IMAGE_BASELINE_GPU_REQUIREMENTS: Record<string, GpuRequirement> = {
  stable_diffusion_1: {
    minVramGb: 4,
    recommendedVramGb: 6,
    nativeResolution: '512x512',
    speedTier: 'fast',
    speedDescription: 'Fast generation, widely supported',
    generationTimeEstimate: '~5-15 seconds',
  },
  stable_diffusion_2_512: {
    minVramGb: 4,
    recommendedVramGb: 6,
    nativeResolution: '512x512',
    speedTier: 'fast',
    speedDescription: 'Fast generation, similar to SD1.5',
    generationTimeEstimate: '~5-15 seconds',
  },
  stable_diffusion_2_768: {
    minVramGb: 6,
    recommendedVramGb: 8,
    nativeResolution: '768x768',
    speedTier: 'medium',
    speedDescription: 'Medium speed, higher resolution',
    generationTimeEstimate: '~10-25 seconds',
  },
  stable_diffusion_2: {
    minVramGb: 6,
    recommendedVramGb: 8,
    nativeResolution: '768x768',
    speedTier: 'medium',
    speedDescription: 'Medium speed, higher resolution',
    generationTimeEstimate: '~10-25 seconds',
  },
  stable_diffusion_xl: {
    minVramGb: 10,
    recommendedVramGb: 12,
    nativeResolution: '1024x1024',
    speedTier: 'medium',
    speedDescription: 'Higher quality, slower than SD1.5',
    generationTimeEstimate: '~20-45 seconds',
  },
  stable_cascade: {
    minVramGb: 12,
    recommendedVramGb: 16,
    nativeResolution: '1024x1024',
    speedTier: 'slow',
    speedDescription: 'High quality, slower generation',
    generationTimeEstimate: '~30-60 seconds',
  },
  flux_1: {
    minVramGb: 16,
    recommendedVramGb: 24,
    nativeResolution: '1024x1024',
    speedTier: 'slow',
    speedDescription: 'Latest architecture, requires high-end GPU',
    generationTimeEstimate: '~45-90 seconds',
  },
  'flux.1-schnell': {
    minVramGb: 16,
    recommendedVramGb: 24,
    nativeResolution: '1024x1024',
    speedTier: 'medium',
    speedDescription: 'Faster Flux variant, still resource-intensive',
    generationTimeEstimate: '~25-50 seconds',
  },
};

/**
 * GPU requirements for text generation models based on parameter count
 * Rough estimate: 2x parameters in GB for 16-bit, 1x for 8-bit, 0.5x for 4-bit
 */
export function getTextModelGpuRequirements(parametersInBillions: number): GpuRequirement {
  // 4-bit quantization is most common, so use that as baseline
  const minVramGb = Math.ceil(parametersInBillions * 0.6); // Slightly more than pure 4-bit
  const recommendedVramGb = Math.ceil(parametersInBillions * 0.75); // Room for context

  let speedTier: 'fast' | 'medium' | 'slow';
  let speedDescription: string;
  let generationTimeEstimate: string;

  if (parametersInBillions < 7) {
    speedTier = 'fast';
    speedDescription = 'Fast generation, lower quality';
    generationTimeEstimate = '~1-3 seconds per token';
  } else if (parametersInBillions < 30) {
    speedTier = 'medium';
    speedDescription = 'Balanced speed and quality';
    generationTimeEstimate = '~2-5 seconds per token';
  } else {
    speedTier = 'slow';
    speedDescription = 'High quality, slower generation';
    generationTimeEstimate = '~5-15 seconds per token';
  }

  return {
    minVramGb,
    recommendedVramGb,
    nativeResolution: 'N/A',
    speedTier,
    speedDescription,
    generationTimeEstimate,
  };
}

/**
 * Get GPU requirements for an image model baseline
 */
export function getImageModelGpuRequirements(baseline: string): GpuRequirement | null {
  return IMAGE_BASELINE_GPU_REQUIREMENTS[baseline] || null;
}

/**
 * Get speed tier badge class name
 */
export function getSpeedTierBadgeClass(speedTier: 'fast' | 'medium' | 'slow'): string {
  switch (speedTier) {
    case 'fast':
      return 'badge-speed-fast';
    case 'medium':
      return 'badge-speed-medium';
    case 'slow':
      return 'badge-speed-slow';
  }
}

/**
 * Get human-readable VRAM requirement string
 */
export function formatVramRequirement(vramGb: number): string {
  return `${vramGb}GB VRAM`;
}

/**
 * Get full GPU requirement display string
 */
export function formatGpuRequirementFull(requirement: GpuRequirement): string {
  return `${requirement.minVramGb}GB+ VRAM (${requirement.recommendedVramGb}GB recommended)`;
}

/**
 * Check if user's VRAM meets minimum requirements
 */
export function meetsVramRequirement(userVramGb: number, requiredVramGb: number): boolean {
  return userVramGb >= requiredVramGb;
}

/**
 * Get all available VRAM tiers for filtering
 */
export function getVramTierOptions(): { label: string; value: number }[] {
  return [
    { label: 'Any GPU', value: 0 },
    { label: '4GB or less', value: 4 },
    { label: '8GB or less', value: 8 },
    { label: '12GB or less', value: 12 },
    { label: '16GB or less', value: 16 },
    { label: '24GB or less', value: 24 },
    { label: '24GB+', value: 999 },
  ];
}

/**
 * Get baseline shorthand display name
 */
export const BASELINE_DISPLAY_NAMES: Record<string, string> = {
  stable_diffusion_1: 'SD1.5',
  stable_diffusion_2_512: 'SD2-512',
  stable_diffusion_2_768: 'SD2-768',
  stable_diffusion_2: 'SD2',
  stable_diffusion_xl: 'SDXL',
  stable_cascade: 'Cascade',
  flux_1: 'Flux',
  'flux.1-schnell': 'Flux Schnell',
};

/**
 * Get display name for baseline
 */
export function getBaselineDisplayName(baseline: string): string {
  return BASELINE_DISPLAY_NAMES[baseline] || baseline;
}

/**
 * Format parameter count for display (e.g., 7000000000 -> "7B")
 */
export function formatParameterCount(parameters: number): string {
  if (parameters >= 1_000_000_000) {
    const billions = parameters / 1_000_000_000;
    return `${billions.toFixed(billions < 10 ? 1 : 0)}B`;
  } else if (parameters >= 1_000_000) {
    const millions = parameters / 1_000_000;
    return `${millions.toFixed(0)}M`;
  } else if (parameters >= 1_000) {
    const thousands = parameters / 1_000;
    return `${thousands.toFixed(0)}K`;
  }
  return parameters.toString();
}

/**
 * Parse parameter count from formatted string (e.g., "7B" -> 7000000000)
 */
export function parseParameterCount(formatted: string): number | null {
  const match = formatted.match(/^([\d.]+)([BMK]?)$/i);
  if (!match) return null;

  const value = parseFloat(match[1]);
  const unit = match[2].toUpperCase();

  switch (unit) {
    case 'B':
      return value * 1_000_000_000;
    case 'M':
      return value * 1_000_000;
    case 'K':
      return value * 1_000;
    default:
      return value;
  }
}
