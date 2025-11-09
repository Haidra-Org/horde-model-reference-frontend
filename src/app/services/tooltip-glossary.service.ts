import { Injectable } from '@angular/core';

/**
 * Definition structure for technical terms in the glossary
 */
export interface GlossaryTerm {
  /** The technical term */
  term: string;
  /** Short, one-sentence definition */
  shortDef: string;
  /** Longer, detailed explanation with context */
  longDef: string;
  /** Practical examples showing usage or values */
  examples: string[];
  /** Why this term matters in the AI-Horde context */
  impact: string;
  /** Optional URL to external documentation */
  learnMoreUrl?: string;
}

/**
 * Service providing comprehensive glossary definitions for all technical terms
 * used throughout the Horde Model Reference application.
 *
 * Supports contextual tooltips, help text enhancement, and a dedicated glossary page.
 */
@Injectable({
  providedIn: 'root',
})
export class TooltipGlossaryService {
  private readonly glossary = new Map<string, GlossaryTerm>();

  constructor() {
    this.initializeGlossary();
  }

  /**
   * Get the glossary entry for a specific term
   */
  getTerm(term: string): GlossaryTerm | undefined {
    return this.glossary.get(term.toLowerCase());
  }

  /**
   * Get all glossary terms sorted alphabetically
   */
  getAllTerms(): GlossaryTerm[] {
    return Array.from(this.glossary.values()).sort((a, b) => a.term.localeCompare(b.term));
  }

  /**
   * Get terms filtered by search query (searches term, definitions, and examples)
   */
  searchTerms(query: string): GlossaryTerm[] {
    const lowerQuery = query.toLowerCase();
    return this.getAllTerms().filter(
      (term) =>
        term.term.toLowerCase().includes(lowerQuery) ||
        term.shortDef.toLowerCase().includes(lowerQuery) ||
        term.longDef.toLowerCase().includes(lowerQuery) ||
        term.examples.some((ex) => ex.toLowerCase().includes(lowerQuery)),
    );
  }

  /**
   * Generate a tooltip text for a term (short definition + first example)
   */
  getTooltipText(term: string): string {
    const entry = this.getTerm(term);
    if (!entry) return '';

    const example = entry.examples.length > 0 ? `\n\nExample: ${entry.examples[0]}` : '';
    return `${entry.shortDef}${example}`;
  }

  private initializeGlossary(): void {
    this.addTerm({
      term: 'baseline',
      shortDef: 'The base model architecture a fine-tuned model is built upon',
      longDef:
        'The baseline indicates which foundational model architecture was used to create this model. Different baselines have different GPU memory requirements, native resolutions, and generation speeds. This is one of the most important fields for determining whether a worker can serve a model.',
      examples: [
        'stable_diffusion_1 (SD1.5): 512x512, ~4GB VRAM, fast generation',
        'stable_diffusion_xl (SDXL): 1024x1024, ~12GB VRAM, slower but higher quality',
        'flux_1: 1024x1024, ~16-24GB VRAM, newest architecture',
      ],
      impact:
        'Workers must have enough GPU memory for the baseline. Requesters experience faster queues with SD1.5 models than SDXL due to more available workers.',
      learnMoreUrl: 'https://github.com/Haidra-Org/AI-Horde/blob/main/docs/definitions.md',
    });

    this.addTerm({
      term: 'parameters',
      shortDef:
        'Total number of model parameters (for text generation models, measured in billions)',
      longDef:
        'Parameter count indicates the size and complexity of a language model. Larger models generally produce better quality output but require more GPU memory, take longer to generate, and consume more kudos per request. Parameter count directly affects which workers can serve the model.',
      examples: [
        '3B-7B: Small models, fast generation, lower quality',
        '13B-30B: Medium models, good balance of speed and quality',
        '70B+: Large models, slow generation, highest quality',
      ],
      impact:
        'Larger parameter counts require more powerful GPUs. As a rough guide, you need about 2x the parameter count in GB of VRAM for 16-bit models (e.g., 13B model needs ~26GB VRAM).',
      learnMoreUrl: 'https://github.com/Haidra-Org/AI-Horde/blob/main/docs/definitions.md',
    });

    this.addTerm({
      term: 'NSFW',
      shortDef: 'Whether this model can generate Not Safe For Work (adult) content',
      longDef:
        'The NSFW flag indicates whether a model was trained on adult content and can generate NSFW images or text. This is about model capability, not content filtering. Some workers choose not to serve NSFW models, and some users filter NSFW models from their searches.',
      examples: [
        'true: Model can generate adult content',
        'false: Model filtered or not designed for adult content',
      ],
      impact:
        'Affects model discoverability and which workers will serve it. Some institutions (schools, libraries) filter NSFW models from their search results.',
    });

    this.addTerm({
      term: 'inpainting',
      shortDef: 'Specialized models that fill in masked regions of images',
      longDef:
        'Inpainting models are specifically trained to edit parts of images while maintaining context with the surrounding areas. They are more precise than using img2img with a mask. Inpainting requires special model architecture and separate model files.',
      examples: [
        'Fill in missing parts of photos',
        'Replace objects while keeping background',
        'Remove unwanted elements seamlessly',
      ],
      impact:
        'Workers need separate inpainting models loaded. Requesters must specify if they need inpainting capability for their use case.',
    });

    this.addTerm({
      term: 'worker',
      shortDef: 'A computer donating GPU resources to process AI-Horde generation requests',
      longDef:
        'Workers are volunteer-run nodes that process generation jobs from the AI-Horde. Each worker loads specific models and polls for jobs matching those models. Workers earn kudos for completed jobs and help provide free AI generation to the community.',
      examples: [
        'Dreamer: Image generation worker (Stable Diffusion)',
        'Scribe: Text generation worker (LLMs)',
        'Alchemist: Post-processing worker (upscaling, face fixing)',
      ],
      impact:
        'More workers serving a model = faster generation times. Models with zero active workers cannot fulfill requests.',
      learnMoreUrl: 'https://github.com/Haidra-Org/AI-Horde/blob/main/docs/definitions.md#workers',
    });

    this.addTerm({
      term: 'kudos',
      shortDef: 'The unit of exchange for priority on the AI-Horde',
      longDef:
        'Kudos are earned by running workers and spent to get higher priority in the generation queue. They never expire, cannot be bought or sold (against ToS), but can be gifted. Anonymous users and low-kudos accounts use the free tier with lower priority.',
      examples: [
        'Earn kudos by running a worker during your GPU idle time',
        'Spend kudos to get faster generation results',
        'Leave kudos unspent to support the community',
      ],
      impact:
        'More kudos = higher queue priority. Workers earn kudos scaled by job complexity (resolution, steps, model size).',
      learnMoreUrl: 'https://github.com/Haidra-Org/AI-Horde/blob/main/docs/kudos.md',
    });

    this.addTerm({
      term: 'megapixelsteps',
      shortDef: 'Unit measuring image generation workload (megapixels × diffusion steps)',
      longDef:
        'Megapixelsteps combine image size and quality into a single metric. One megapixelstep = 1 million pixels processed through 1 diffusion step. A typical 512x512 image at 20 steps = 5.24 megapixelsteps. Used to measure worker performance and kudos rewards.',
      examples: [
        '512x512 @ 20 steps = 5.24 megapixelsteps',
        '1024x1024 @ 30 steps = 31.46 megapixelsteps',
        'Higher resolution or more steps = more megapixelsteps',
      ],
      impact:
        'Kudos cost and worker load scale with megapixelsteps. SDXL images typically require 4-6x more megapixelsteps than SD1.5.',
    });

    this.addTerm({
      term: 'style',
      shortDef: 'The visual or artistic category of a model',
      longDef:
        'Style tags help categorize models by their output characteristics. This aids discovery and helps requesters find models matching their desired aesthetic. Common styles include anime, realistic, artistic, and generalist.',
      examples: [
        'anime: Japanese animation style',
        'realistic: Photorealistic images',
        'artistic: Painterly or stylized output',
        'generalist: All-purpose, versatile',
      ],
      impact:
        'Helps requesters discover appropriate models. Artists often specialize in specific styles.',
    });

    this.addTerm({
      term: 'tags',
      shortDef: 'Descriptive keywords for categorizing and searching models',
      longDef:
        'Free-form tags help describe what a model is good at or what content it specializes in. Tags improve discoverability through search and filtering. While not strictly controlled, common conventions have emerged.',
      examples: [
        'anime, manga, cyberpunk, retro',
        'portraits, landscapes, characters',
        'high resolution, photorealistic',
      ],
      impact:
        'Well-tagged models are easier to discover. Popular tags help requesters find suitable models quickly.',
    });

    this.addTerm({
      term: 'trigger words',
      shortDef: "Specific keywords or phrases that activate a model's style or special features",
      longDef:
        "Many fine-tuned models are trained to respond to specific words or phrases in the prompt. Using these trigger words helps activate the model's unique style or characteristics. Without them, the model may produce generic results.",
      examples: [
        'artstation, highly detailed',
        'by greg rutkowski',
        'in the style of [artist name]',
      ],
      impact:
        'Using correct trigger words dramatically improves output quality. Requesters should include these in their prompts.',
    });

    this.addTerm({
      term: 'ControlNet',
      shortDef: 'Additional models that guide image generation using reference images',
      longDef:
        'ControlNet models provide fine-grained control over image generation by using reference images as guides. Different ControlNet types extract different features (edges, depth, pose) from the reference to guide the generation.',
      examples: [
        'Canny: Edge detection for line art guidance',
        'Depth: Depth map for spatial structure',
        'OpenPose: Human pose skeleton guidance',
      ],
      impact:
        'Requires separate ControlNet models. Workers need specific ControlNet types loaded for these features.',
    });

    this.addTerm({
      term: 'LoRA',
      shortDef: 'Low-Rank Adaptation - small add-on models that modify base model behavior',
      longDef:
        'LoRA (Low-Rank Adaptation) are lightweight models that modify a base model without requiring a full fine-tune. Multiple LoRAs can be applied simultaneously to add specific styles, characters, or concepts. They are much smaller than full models (typically 10-200MB).',
      examples: [
        'Character LoRAs: Add specific character appearances',
        'Style LoRAs: Apply artistic styles',
        'Concept LoRAs: Add specific objects or themes',
      ],
      impact:
        'Workers must support LoRA loading. Requesters can combine multiple LoRAs for complex scenes.',
    });

    this.addTerm({
      term: 'quantization',
      shortDef: 'Compression technique reducing model size by using lower precision numbers',
      longDef:
        'Quantization reduces model file size and memory requirements by representing weights with fewer bits. Common types include GPTQ, AWQ, and llama.cpp quantization (Q4_K_M, Q5_K_M, etc.). Some quality loss may occur, but 4-bit and 5-bit quantization generally maintain good performance.',
      examples: [
        'Q4_K_M: 4-bit quantization, good balance',
        'Q5_K_M: 5-bit quantization, higher quality',
        'GPTQ: GPU-optimized quantization',
        'AWQ: Activation-aware weight quantization',
      ],
      impact:
        'Allows running larger models on limited VRAM. A 70B model in Q4 can run on ~40GB instead of 140GB.',
    });

    this.addTerm({
      term: 'bridge version',
      shortDef: 'Minimum version of the AI-Horde bridge software required to serve this model',
      longDef:
        'The bridge is the software that connects workers to the AI-Horde network. Newer models may require features only available in recent bridge versions. Workers must update their bridge software to serve models with higher version requirements.',
      examples: [
        'Bridge v15: Basic SD1.5 support',
        'Bridge v20: SDXL support added',
        'Bridge v25: Flux support added',
      ],
      impact:
        'Workers on old bridge versions cannot serve newer models. Requesters may experience longer queues if few workers have updated.',
    });

    this.addTerm({
      term: 'active workers',
      shortDef: 'Number of workers currently serving this model',
      longDef:
        'Active worker count shows how many volunteers are currently offering this model for generation. Higher counts mean faster queue times and better availability. Zero active workers means the model cannot currently be used for generations.',
      examples: [
        '50+ workers: Very popular, fast queue',
        '10-50 workers: Good availability',
        '1-10 workers: Limited availability',
        '0 workers: Cannot be used currently',
      ],
      impact:
        'Direct correlation to wait times. Popular models like SD1.5 base have hundreds of workers, while niche models may have zero.',
      learnMoreUrl: 'https://aihorde.net/api/',
    });

    this.addTerm({
      term: 'queued',
      shortDef: 'Number of generation requests waiting to be processed',
      longDef:
        'Queue depth shows how many requests are waiting for workers. Combined with active worker count, this indicates expected wait time. High queue with few workers = long wait. Low queue with many workers = instant generation.',
      examples: [
        'Low queue (0-10): Instant or very fast',
        'Medium queue (10-100): A few minutes',
        'High queue (100+): Significant wait time',
      ],
      impact:
        'Helps requesters decide whether to wait or choose a different model. Workers see queued work to optimize kudos earnings.',
    });

    this.addTerm({
      term: 'backend',
      shortDef: 'The inference engine used to run text generation models',
      longDef:
        'Text generation models can be run with different backend engines, each with different performance characteristics and compatibility. Common backends include llama.cpp, exllamav2, aphrodite, vllm, tabbyAPI, and koboldcpp.',
      examples: [
        'llama.cpp: CPU/GPU, very compatible',
        'exllamav2: GPU-only, very fast',
        'aphrodite: OpenAI-compatible API',
        'vllm: Production-optimized serving',
      ],
      impact:
        'Backend determines speed, memory usage, and feature support. Some backends only support specific quantization types.',
    });

    this.addTerm({
      term: 'usage statistics',
      shortDef: 'Metrics tracking how often a model has been requested',
      longDef:
        'Usage stats show generation request counts over different time periods (24 hours, 30 days, all-time). Higher usage indicates popular, in-demand models. Low usage may indicate niche models or quality issues.',
      examples: [
        '24h usage: Recent popularity trends',
        '30d usage: Monthly activity',
        'Total usage: All-time popularity',
      ],
      impact:
        'Popular models attract more workers (higher kudos potential). Low-usage models may need more workers.',
    });

    this.addTerm({
      term: 'checksum',
      shortDef: 'Cryptographic hash ensuring model file integrity and authenticity',
      longDef:
        'SHA256 checksums verify that downloaded model files match the official reference exactly. This prevents corrupted downloads, malicious tampering, and ensures reproducible results across all workers.',
      examples: [
        'SHA256: 64-character hex string',
        'Must match exactly for verification',
        'Different file = different checksum',
      ],
      impact:
        'Critical for security and reproducibility. Workers verify checksums before loading models.',
    });

    this.addTerm({
      term: 'showcases',
      shortDef: 'Example images generated with this model to demonstrate its capabilities',
      longDef:
        "Showcase images help users understand a model's style, quality, and capabilities before using it. Good showcases demonstrate the model's strengths and typical output quality.",
      examples: [
        'Character portraits showing style',
        'Landscapes demonstrating detail',
        'Various subjects showing versatility',
      ],
      impact:
        'Helps requesters choose appropriate models. Models with good showcases are more likely to be discovered and used.',
    });

    this.addTerm({
      term: 'VRAM',
      shortDef: 'Video RAM - GPU memory required to load and run models',
      longDef:
        'VRAM (Video RAM) is the memory on graphics cards used to store model weights and intermediate calculations. Different models require different amounts of VRAM based on their baseline, parameter count, and resolution.',
      examples: [
        'SD1.5: 4-6GB VRAM minimum',
        'SDXL: 10-12GB VRAM minimum',
        'Flux: 16-24GB VRAM minimum',
        'LLM 70B Q4: ~40GB VRAM minimum',
      ],
      impact:
        "Primary hardware constraint for workers. If you don't have enough VRAM, you cannot run the model.",
    });

    this.addTerm({
      term: 'PRIMARY mode',
      shortDef: 'Authoritative source mode allowing read and write operations',
      longDef:
        'PRIMARY mode indicates this instance is the authoritative source for model references. It supports creating, updating, and deleting model records. Typically used by administrators managing the central model database.',
      examples: ['Central AI-Horde model reference server', 'Admin management interface'],
      impact:
        'Only PRIMARY instances can modify model data. REPLICA instances fetch from PRIMARY for read-only access.',
    });

    this.addTerm({
      term: 'REPLICA mode',
      shortDef: 'Read-only mode fetching model references from external sources',
      longDef:
        'REPLICA mode instances fetch model reference data from a PRIMARY server or GitHub. They provide read-only access for workers and clients. This is the typical mode for worker nodes and API consumers.',
      examples: ['Worker nodes downloading model lists', 'Client applications browsing models'],
      impact:
        'REPLICA instances cannot modify models. All write operations (POST/PUT/DELETE) return 503 Service Unavailable.',
    });
  }

  private addTerm(term: GlossaryTerm): void {
    this.glossary.set(term.term.toLowerCase(), term);
  }
}
