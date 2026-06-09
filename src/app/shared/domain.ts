import { MODEL_REFERENCE_CATEGORY } from '../api-client';

/**
 * Coarse model-domain grouping for accent coloring.
 * Mirrors the prototype's DOMAIN_META / domainOf() mapping.
 *
 * IMPORTANT: This app follows the PROTOTYPE mapping:
 *   image = blue, text = purple, utility = cyan.
 * The sibling AiHordeFrontpage app uses the inverse (image=purple, text=blue).
 * Domain accent tokens are LOCAL (D7), so each app is independent.
 */
export type ModelDomain = 'image' | 'text' | 'utility';

export interface DomainMeta {
  domain: ModelDomain;
  /** Human-readable label */
  label: string;
  /** CSS class suffix for accent utilities, e.g. 'accent-image' → 'bg-accent-image' */
  accentClass: string;
  /** Icon identifier (resolved by the icon system in each consuming component) */
  icon: string;
}

const DOMAIN_IMAGE: DomainMeta = {
  domain: 'image',
  label: 'Image',
  accentClass: 'accent-image',
  icon: 'image',
};

const DOMAIN_TEXT: DomainMeta = {
  domain: 'text',
  label: 'Text',
  accentClass: 'accent-text',
  icon: 'text',
};

const DOMAIN_UTILITY: DomainMeta = {
  domain: 'utility',
  label: 'Utility',
  accentClass: 'accent-utility',
  icon: 'utility',
};

/**
 * Map a MODEL_REFERENCE_CATEGORY value to its coarse domain.
 *
 * Classification:
 * - image_generation, video_generation → image
 * - text_generation, audio_generation → text
 * - Everything else (clip, controlnet, esrgan, gfpgan, codeformer, blip,
 *   safety_checker, lora, ti, miscellaneous) → utility
 */
export function domainOf(category: string): ModelDomain {
  switch (category) {
    case MODEL_REFERENCE_CATEGORY.ImageGeneration:
    case MODEL_REFERENCE_CATEGORY.VideoGeneration:
      return 'image';
    case MODEL_REFERENCE_CATEGORY.TextGeneration:
    case MODEL_REFERENCE_CATEGORY.AudioGeneration:
      return 'text';
    default:
      return 'utility';
  }
}

/**
 * Return the full DomainMeta for a category string.
 * Safe to call with unknown categories — returns DOMAIN_UTILITY.
 */
export function domainMeta(category: string): DomainMeta {
  const domain = domainOf(category);
  switch (domain) {
    case 'image':
      return DOMAIN_IMAGE;
    case 'text':
      return DOMAIN_TEXT;
    default:
      return DOMAIN_UTILITY;
  }
}

/** All three domain metas in a convenient array. */
export const ALL_DOMAINS: readonly DomainMeta[] = [
  DOMAIN_IMAGE,
  DOMAIN_TEXT,
  DOMAIN_UTILITY,
] as const;
