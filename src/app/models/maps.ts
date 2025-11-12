export const BASELINE_DISPLAY_MAP: Record<string, string> = {
  stable_diffusion_1: 'Stable Diffusion 1',
  stable_diffusion_2_768: 'Stable Diffusion 2',
  stable_diffusion_2_512: 'Stable Diffusion 2 512',
  stable_diffusion_xl: 'Stable Diffusion XL',
  stable_cascade: 'Stable Cascade',
};

export const BASELINE_SHORTHAND_MAP: Record<string, string> = {
  // Underscore format (canonical)
  infer: 'Auto',
  stable_diffusion_1: 'SD1',
  stable_diffusion_2_768: 'SD2',
  stable_diffusion_2_512: 'SD2-512',
  stable_diffusion_xl: 'SDXL',
  stable_cascade: 'Cascade',
  flux_1: 'f.schnell',
  flux_dev: 'f.dev',
  'stable diffusion 1': 'SD1',
  'stable diffusion 2': 'SD2',
  'stable diffusion 2 512': 'SD2-512',
  'stable diffusion xl': 'SDXL',
  'stable cascade': 'Cascade',
  'flux 1': 'f.1',
  'flux dev': 'f.dev',
};

export const BASELINE_NORMALIZATION_MAP: Record<string, string> = {
  'stable diffusion 1': 'stable_diffusion_1',
  'stable diffusion 2': 'stable_diffusion_2_768',
  'stable diffusion 2 512': 'stable_diffusion_2_512',
  stable_diffusion_xl: 'stable_diffusion_xl',
  stable_cascade: 'stable_cascade',
};

export const RECORD_DISPLAY_MAP: Record<string, string> = {
  blip: 'BLIP',
  clip: 'CLIP',
  codeformer: 'CodeFormer',
  controlnet: 'ControlNet',
  esrgan: 'ESRGAN',
  gfpgan: 'GFPGAN',
  safety_checker: 'Safety Checker',
  image_generation: 'Image Generation',
  text_generation: 'Text Generation',
  video_generation: 'Video Generation',
  audio_generation: 'Audio Generation',
  miscellaneous: 'Miscellaneous',
};

export type CategoryStatType =
  | 'baseline'
  | 'tags'
  | 'nsfw'
  | 'size'
  | 'parameters'
  | 'requirements'
  | 'style';

export const CATEGORY_STATS_CONFIG: Record<string, CategoryStatType[]> = {
  image_generation: ['baseline', 'tags', 'nsfw', 'size'],
  text_generation: ['baseline', 'tags', 'parameters'],
  blip: ['nsfw'],
  clip: ['nsfw'],
  codeformer: ['nsfw'],
  controlnet: ['nsfw'],
  esrgan: ['nsfw'],
  gfpgan: ['nsfw'],
  safety_checker: ['nsfw'],
  video_generation: ['nsfw'],
  audio_generation: ['nsfw'],
  miscellaneous: ['nsfw'],
};
