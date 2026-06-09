import { describe, it, expect } from 'vitest';
import { domainOf, domainMeta, ALL_DOMAINS } from './domain';
import type { DomainMeta } from './domain';
import { MODEL_REFERENCE_CATEGORY } from '../api-client';

describe('domainOf', () => {
  it('maps image_generation to image', () => {
    expect(domainOf(MODEL_REFERENCE_CATEGORY.ImageGeneration)).toBe('image');
  });

  it('maps video_generation to image', () => {
    expect(domainOf(MODEL_REFERENCE_CATEGORY.VideoGeneration)).toBe('image');
  });

  it('maps text_generation to text', () => {
    expect(domainOf(MODEL_REFERENCE_CATEGORY.TextGeneration)).toBe('text');
  });

  it('maps audio_generation to text', () => {
    expect(domainOf(MODEL_REFERENCE_CATEGORY.AudioGeneration)).toBe('text');
  });

  it('maps clip to utility', () => {
    expect(domainOf(MODEL_REFERENCE_CATEGORY.Clip)).toBe('utility');
  });

  it('maps controlnet to utility', () => {
    expect(domainOf(MODEL_REFERENCE_CATEGORY.Controlnet)).toBe('utility');
  });

  it('maps esrgan to utility', () => {
    expect(domainOf(MODEL_REFERENCE_CATEGORY.Esrgan)).toBe('utility');
  });

  it('maps gfpgan to utility', () => {
    expect(domainOf(MODEL_REFERENCE_CATEGORY.Gfpgan)).toBe('utility');
  });

  it('maps codeformer to utility', () => {
    expect(domainOf(MODEL_REFERENCE_CATEGORY.Codeformer)).toBe('utility');
  });

  it('maps blip to utility', () => {
    expect(domainOf(MODEL_REFERENCE_CATEGORY.Blip)).toBe('utility');
  });

  it('maps safety_checker to utility', () => {
    expect(domainOf(MODEL_REFERENCE_CATEGORY.SafetyChecker)).toBe('utility');
  });

  it('maps lora to utility', () => {
    expect(domainOf(MODEL_REFERENCE_CATEGORY.Lora)).toBe('utility');
  });

  it('maps ti to utility', () => {
    expect(domainOf(MODEL_REFERENCE_CATEGORY.Ti)).toBe('utility');
  });

  it('maps miscellaneous to utility', () => {
    expect(domainOf(MODEL_REFERENCE_CATEGORY.Miscellaneous)).toBe('utility');
  });

  it('falls back to utility for unknown categories', () => {
    expect(domainOf('nonexistent_category')).toBe('utility');
  });
});

describe('domainMeta', () => {
  it('returns correct meta for image domain categories', () => {
    const meta = domainMeta(MODEL_REFERENCE_CATEGORY.ImageGeneration);
    expect(meta.domain).toBe('image');
    expect(meta.label).toBe('Image');
    expect(meta.accentClass).toBe('accent-image');
    expect(meta.icon).toBe('image');
  });

  it('returns correct meta for text domain categories', () => {
    const meta = domainMeta(MODEL_REFERENCE_CATEGORY.TextGeneration);
    expect(meta.domain).toBe('text');
    expect(meta.label).toBe('Text');
    expect(meta.accentClass).toBe('accent-text');
    expect(meta.icon).toBe('text');
  });

  it('returns correct meta for utility domain categories', () => {
    const meta = domainMeta(MODEL_REFERENCE_CATEGORY.Clip);
    expect(meta.domain).toBe('utility');
    expect(meta.label).toBe('Utility');
    expect(meta.accentClass).toBe('accent-utility');
    expect(meta.icon).toBe('utility');
  });

  it('returns consistent domain between domainOf and domainMeta', () => {
    for (const category of Object.values(MODEL_REFERENCE_CATEGORY)) {
      expect(domainMeta(category).domain).toBe(domainOf(category));
    }
  });

  it('returns utility meta for unknown categories', () => {
    const meta = domainMeta('unknown_category');
    expect(meta.domain).toBe('utility');
    expect(meta.label).toBe('Utility');
  });
});

describe('ALL_DOMAINS', () => {
  it('contains exactly three domains', () => {
    expect(ALL_DOMAINS).toHaveLength(3);
  });

  it('contains unique domains', () => {
    const domains = ALL_DOMAINS.map((d: DomainMeta) => d.domain);
    expect(new Set(domains).size).toBe(3);
  });

  it('contains image, text, and utility', () => {
    const domains = ALL_DOMAINS.map((d: DomainMeta) => d.domain);
    expect(domains).toContain('image');
    expect(domains).toContain('text');
    expect(domains).toContain('utility');
  });
});
