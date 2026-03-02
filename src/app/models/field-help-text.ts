/**
 * Central registry of plain-language help text for form fields.
 * Used by FieldTooltipComponent to display contextual explanations.
 *
 * Each entry covers: what the field is, why it matters, and example values.
 */

export interface FieldHelpEntry {
  /** Short plain-language explanation */
  summary: string;
  /** Why this field matters to the ecosystem */
  impact?: string;
  /** Example values or best practices */
  examples?: string;
}

export const FIELD_HELP_TEXT: Record<string, FieldHelpEntry> = {
  // --- Identity & Core ---
  name: {
    summary: 'The unique identifier for this model in the AI-Horde system.',
    impact:
      'Workers and requesters use this name to refer to the model. It cannot be changed after creation.',
    examples: 'e.g., stable_diffusion_2.1, Deliberate, LLaMA-2-7B-chat',
  },
  baseline: {
    summary: 'The base model architecture this model was trained from or fine-tuned on.',
    impact:
      'Determines GPU memory requirements, compatible samplers, and native resolution. Workers use this to allocate resources.',
    examples:
      'Image: stable_diffusion_1, stable_diffusion_xl, flux_1. Text: llama, mistral, falcon.',
  },
  parameters: {
    summary: 'Total number of model parameters (the "size" of the model).',
    impact:
      'Directly affects GPU memory (~0.6 GB per billion params at 4-bit), generation speed, and kudos cost. This is the primary field for text model references.',
    examples: 'e.g., 7000000000 for a 7B model, 70000000000 for 70B',
  },
  inpainting: {
    summary: 'Whether this model is specifically designed for inpainting (filling masked regions).',
    impact:
      'Inpainting models are loaded separately by workers. Requesters must specify inpainting capability when needed.',
  },
  nsfw: {
    summary: 'Whether this model is designed for or commonly generates NSFW content.',
    impact:
      'Affects which workers will serve it and whether it appears in filtered searches. Some institutions block NSFW models entirely.',
  },

  // --- Text Generation Specific ---
  display_name: {
    summary: 'A human-friendly name shown in the UI instead of the technical model name.',
    examples: 'e.g., "Llama 2 7B Chat" instead of "LLaMA-2-7B-chat"',
  },
  url: {
    summary: 'Link to the model card, documentation, or download page.',
    examples: 'e.g., https://huggingface.co/meta-llama/Llama-2-7b-chat-hf',
  },
  settings: {
    summary: 'Default generation parameters and configuration for this model.',
    impact: 'Workers use these as defaults when no override is provided by the requester.',
    examples: 'e.g., max_context_length: 4096, max_length: 512',
  },
  text_model_group: {
    summary: 'Groups model variants (e.g., different quantizations) under a single base model.',
    impact: 'Used for analytics and to show related variants together in the UI.',
  },

  // --- Image Generation Specific ---
  tags: {
    summary: 'Descriptive keywords for categorizing and discovering this model.',
    impact: 'Well-tagged models are easier to find via search and filtering.',
    examples: 'e.g., anime, realistic, portrait, landscape, photorealistic',
  },
  trigger: {
    summary: 'Specific words or phrases that activate this model\'s trained style.',
    impact:
      'Requesters must include these in their prompts for the model to produce its intended output.',
    examples: 'e.g., "analog style", "sai-photographic", model-specific activation tokens',
  },
  showcases: {
    summary: 'URLs to example images generated with this model.',
    impact:
      'Good showcases dramatically increase model discovery and usage. Helps users evaluate quality before selecting.',
    examples: 'Direct links to .png/.jpg images showing diverse outputs',
  },
  homepage: {
    summary: 'URL to the model\'s main page (CivitAI, HuggingFace, etc.).',
    examples: 'e.g., https://civitai.com/models/4384/dreamshaper',
  },
  style: {
    summary: 'The visual or output style category of this model.',
    examples: 'e.g., anime, realistic, artistic, photographic',
  },
  optimization: {
    summary: 'Optimization techniques applied to the model for faster inference.',
    examples: 'e.g., xformers, sdp (scaled dot product attention)',
  },
  size_on_disk_bytes: {
    summary: 'Total file size of the model on disk, in bytes.',
    impact: 'Helps workers estimate download time and storage requirements.',
    examples: 'e.g., ~2 GB for SD1.5, ~6-7 GB for SDXL',
  },
  requirements: {
    summary: 'Hardware and generation parameter requirements or constraints.',
    impact:
      'Workers check these to determine if they can serve the model. Requesters see these as limits on their generation options.',
    examples: 'e.g., min_vram: 8, min_steps: 20, max_steps: 50, samplers: ["k_euler"]',
  },

  // --- Common Fields ---
  description: {
    summary: 'A brief description of the model and what it does.',
    impact: 'Shown to users browsing models. Helps them decide if this model fits their needs.',
  },
  version: {
    summary: 'Version identifier or variant name for this model release.',
    examples: 'e.g., 1.0, v2.1, fp16, GGUF-Q4_K_M',
  },
  features_not_supported: {
    summary: 'Features that this model does not support.',
    impact: 'Workers and requesters check this to avoid requesting unsupported operations.',
    examples: 'e.g., img2img, controlnet, lora',
  },

  // --- Technical/Legacy ---
  type: {
    summary: 'The model file format type.',
    impact: 'Determines how the model is loaded by workers.',
    examples: 'e.g., ckpt, safetensors, diffusers',
  },
  download_all: {
    summary: 'Whether to download all file variants for this model.',
  },
  available: {
    summary: 'Legacy availability flag. Usually should be left unset (auto-managed).',
  },

  // --- ControlNet / CLIP ---
  controlnet_style: {
    summary: 'The type of ControlNet conditioning this model provides.',
    impact: 'Determines what kind of control image is needed (edges, depth, poses, etc.).',
    examples: 'e.g., canny, depth, openpose, scribble, hed',
  },
  pretrained_name: {
    summary: 'The pretrained CLIP model identifier.',
    examples: 'e.g., ViT-L/14, ViT-H-14, ViT-bigG-14',
  },

  // --- Download Config ---
  file_url: {
    summary: 'Direct download URL for the model file.',
    impact: 'Workers use this to download the model. Must be a stable, direct link.',
  },
  file_name: {
    summary: 'The filename to save the downloaded model as.',
    examples: 'e.g., model.safetensors, v2-1_768-ema-pruned.ckpt',
  },
  sha256sum: {
    summary: 'SHA-256 checksum for verifying download integrity.',
    impact: 'Workers verify this after downloading to ensure the file is not corrupt or tampered.',
  },
};
