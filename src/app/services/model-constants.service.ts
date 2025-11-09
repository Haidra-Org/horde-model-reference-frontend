import { Injectable } from '@angular/core';
import {
  LegacyRecordUnion,
  LegacyStableDiffusionRecord,
  LegacyTextGenerationRecord,
} from '../models/api.models';

/**
 * Service providing backend constants for model forms.
 * These constants match the backend definitions for consistency.
 */
@Injectable({
  providedIn: 'root',
})
export class ModelConstantsService {
  /**
   * Known tags for model categorization.
   * Source: KNOWN_TAGS from backend meta_consts.py
   */
  readonly KNOWN_TAGS = [
    'anime',
    'manga',
    'cyberpunk',
    'tv show',
    'booru',
    'retro',
    'character',
    'hentai',
    'scenes',
    'low poly',
    'cg',
    'sketch',
    'high resolution',
    'landscapes',
    'comic',
    'cartoon',
    'painting',
    'game',
  ] as const;

  /**
   * Model style enum values.
   * Source: MODEL_STYLE from backend meta_consts.py
   */
  readonly MODEL_STYLES = [
    { value: 'generalist', label: 'Generalist' },
    { value: 'anime', label: 'Anime' },
    { value: 'furry', label: 'Furry' },
    { value: 'artistic', label: 'Artistic' },
    { value: 'realistic', label: 'Realistic' },
    { value: 'other', label: 'Other' },
  ] as const;

  /**
   * Common features that models may not support.
   * These are common limitations found across model implementations.
   */
  readonly COMMON_UNSUPPORTED_FEATURES = [
    'img2img',
    'inpainting',
    'controlnet',
    'lora',
    'ti',
    'high_res_fix',
    'clip_skip',
    'karras',
    'batch',
    'nsfw',
    'upscaling',
    'face_fixer',
    'post_processing',
  ] as const;

  /**
   * Known samplers for stable diffusion models.
   * These are the most commonly used sampling methods.
   */
  readonly KNOWN_SAMPLERS = [
    'k_dpm_2',
    'k_lms',
    'lcm',
    'k_euler_a',
    'k_dpmpp_2m',
    'DDIM',
    'k_dpm_2_a',
    'k_dpmpp_sde',
    'k_dpm_fast',
    'k_dpm_adaptive',
    'k_euler',
    'k_heun',
    'dpmsolver',
    'k_dpmpp_2s_a',
  ] as const;

  /**
   * Known schedulers for stable diffusion models.
   */
  readonly KNOWN_SCHEDULERS = ['karras'] as const;

  /**
   * Get all known tags as a readonly array.
   */
  getKnownTags(): readonly string[] {
    return this.KNOWN_TAGS;
  }

  /**
   * Get all model styles as select options.
   */
  getModelStyles(): readonly { value: string; label: string }[] {
    return this.MODEL_STYLES;
  }

  /**
   * Get common unsupported features for autocomplete.
   */
  getCommonUnsupportedFeatures(): readonly string[] {
    return this.COMMON_UNSUPPORTED_FEATURES;
  }

  /**
   * Get all known samplers as a readonly array.
   */
  getKnownSamplers(): readonly string[] {
    return this.KNOWN_SAMPLERS;
  }

  /**
   * Get all known schedulers as a readonly array.
   */
  getKnownSchedulers(): readonly string[] {
    return this.KNOWN_SCHEDULERS;
  }

  /**
   * Get style suggestions for autocomplete from actual model data.
   * Deduplicates case-insensitively while preserving original casing from first occurrence.
   * @param models - Array of models to extract styles from
   * @returns Sorted array of unique style suggestions
   */
  getStyleSuggestions(models: LegacyRecordUnion[]): string[] {
    const styleSet = new Map<string, string>();

    // Collect styles from models
    models.forEach((model) => {
      if (model.style && typeof model.style === 'string') {
        const lowerStyle = model.style.toLowerCase();
        // Only add if not already present (preserves first occurrence casing)
        if (!styleSet.has(lowerStyle)) {
          styleSet.set(lowerStyle, model.style);
        }
      }
    });

    // Return sorted array
    return Array.from(styleSet.values()).sort((a, b) => a.localeCompare(b));
  }

  /**
   * Get tag suggestions from actual model data.
   * Deduplicates case-insensitively while preserving original casing from first occurrence.
   * @param models - Array of models to extract tags from
   * @returns Sorted array of unique tag suggestions
   */
  getTagSuggestions(models: LegacyRecordUnion[]): string[] {
    const tagSet = new Map<string, string>();

    // Filter to only models that have tags property and add their tags
    const modelsWithTags = models.filter(
      (model): model is LegacyStableDiffusionRecord | LegacyTextGenerationRecord => {
        return 'tags' in model && Array.isArray(model.tags);
      },
    );

    modelsWithTags.forEach((model) => {
      if (model.tags) {
        model.tags.forEach((tag) => {
          if (tag && typeof tag === 'string') {
            const lowerTag = tag.toLowerCase();
            // Only add if not already present (preserves first occurrence casing)
            if (!tagSet.has(lowerTag)) {
              tagSet.set(lowerTag, tag);
            }
          }
        });
      }
    });

    // Return sorted array
    return Array.from(tagSet.values()).sort((a, b) => a.localeCompare(b));
  }
}
