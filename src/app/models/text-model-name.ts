/**
 * Text model naming utilities
 * 
 * Text models have a dynamic naming structure:
 * [backend/][author/]model-name
 * 
 * Examples:
 * - "L3-Super-Nova-RP-8B" (just model name)
 * - "Casual-Autopsy/L3-Super-Nova-RP-8B" (author + model name)
 * - "aphrodite/Casual-Autopsy/L3-Super-Nova-RP-8B" (backend + author + model name)
 * - "koboldcpp/L3-Super-Nova-RP-8B" (backend + model name, no author)
 */

/**
 * Valid text generation backends
 */
export enum TextBackend {
  Aphrodite = 'aphrodite',
  KoboldCpp = 'koboldcpp',
}

/**
 * Parsed components of a text model name
 */
export interface ParsedTextModelName {
  /**
   * Optional backend prefix (e.g., 'aphrodite', 'koboldcpp')
   */
  backend?: TextBackend;

  /**
   * Optional author/organization (e.g., 'Casual-Autopsy')
   */
  author?: string;

  /**
   * The base model name (required, e.g., 'L3-Super-Nova-RP-8B')
   */
  modelName: string;

  /**
   * The full original name as provided
   */
  fullName: string;
}

/**
 * Parse a text model name into its components
 * 
 * @param fullName The complete model name string
 * @returns Parsed components of the model name
 */
export function parseTextModelName(fullName: string): ParsedTextModelName {
  if (!fullName) {
    return {
      modelName: '',
      fullName: '',
    };
  }

  const parts = fullName.split('/');

  // Check if first part is a valid backend
  const firstPartLower = parts[0]?.toLowerCase();
  const isBackend = Object.values(TextBackend).includes(firstPartLower as TextBackend);

  if (parts.length === 1) {
    // Just model name: "L3-Super-Nova-RP-8B"
    return {
      modelName: parts[0],
      fullName,
    };
  } else if (parts.length === 2) {
    if (isBackend) {
      // Backend + model name: "aphrodite/L3-Super-Nova-RP-8B"
      return {
        backend: firstPartLower as TextBackend,
        modelName: parts[1],
        fullName,
      };
    } else {
      // Author + model name: "Casual-Autopsy/L3-Super-Nova-RP-8B"
      return {
        author: parts[0],
        modelName: parts[1],
        fullName,
      };
    }
  } else if (parts.length === 3) {
    if (isBackend) {
      // Backend + author + model name: "aphrodite/Casual-Autopsy/L3-Super-Nova-RP-8B"
      return {
        backend: firstPartLower as TextBackend,
        author: parts[1],
        modelName: parts[2],
        fullName,
      };
    } else {
      // No backend, treat first as author and rest as model name
      // e.g., "org/repo/model-v1" -> author: org, modelName: repo/model-v1
      return {
        author: parts[0],
        modelName: parts.slice(1).join('/'),
        fullName,
      };
    }
  } else {
    // More than 3 parts - treat everything after potential backend as model name
    if (isBackend) {
      return {
        backend: firstPartLower as TextBackend,
        modelName: parts.slice(1).join('/'),
        fullName,
      };
    } else {
      // No backend, treat first part as author and rest as model name
      return {
        author: parts[0],
        modelName: parts.slice(1).join('/'),
        fullName,
      };
    }
  }
}

/**
 * Build a full model name from parsed components
 * 
 * @param parsed Parsed model name components
 * @returns The full model name string
 */
export function buildTextModelName(parsed: Partial<ParsedTextModelName>): string {
  if (!parsed.modelName) {
    return '';
  }

  const parts: string[] = [];

  if (parsed.backend) {
    parts.push(parsed.backend);
  }

  if (parsed.author) {
    parts.push(parsed.author);
  }

  parts.push(parsed.modelName);

  return parts.join('/');
}

/**
 * Get the base model name without backend or author prefix
 * 
 * @param fullName The complete model name string
 * @returns Just the model name component
 */
export function getBaseModelName(fullName: string): string {
  return parseTextModelName(fullName).modelName;
}

/**
 * Get the model name without backend prefix but with author (if present)
 * 
 * @param fullName The complete model name string
 * @returns Model name with author but without backend
 */
export function getNameWithoutBackend(fullName: string): string {
  const parsed = parseTextModelName(fullName);
  return buildTextModelName({
    author: parsed.author,
    modelName: parsed.modelName,
  });
}

/**
 * Check if a model name has a backend prefix
 * 
 * @param fullName The complete model name string
 * @returns True if the name includes a backend prefix
 */
export function hasBackendPrefix(fullName: string): boolean {
  return parseTextModelName(fullName).backend !== undefined;
}

/**
 * Get all variations of a model name (with different backend prefixes)
 * 
 * @param fullName The complete model name string
 * @returns Array of model name variations with all backends
 */
export function getModelNameVariations(fullName: string): string[] {
  const parsed = parseTextModelName(fullName);
  const variations: string[] = [];

  // Add the base name (no backend)
  const baseName = buildTextModelName({
    author: parsed.author,
    modelName: parsed.modelName,
  });
  variations.push(baseName);

  // Add variations with each backend
  for (const backend of Object.values(TextBackend)) {
    const backendVariation = buildTextModelName({
      backend,
      author: parsed.author,
      modelName: parsed.modelName,
    });
    if (backendVariation !== baseName) {
      variations.push(backendVariation);
    }
  }

  return variations;
}

/**
 * Group models by their base name (without backend prefix)
 * 
 * @param modelNames Array of full model names
 * @returns Map of base names to their variations
 */
export function groupModelsByBaseName(modelNames: string[]): Map<string, string[]> {
  const groups = new Map<string, string[]>();

  for (const fullName of modelNames) {
    const parsed = parseTextModelName(fullName);
    const baseKey = buildTextModelName({
      author: parsed.author,
      modelName: parsed.modelName,
    });

    if (!groups.has(baseKey)) {
      groups.set(baseKey, []);
    }
    groups.get(baseKey)!.push(fullName);
  }

  return groups;
}

/**
 * Extract all unique backends from a list of model names
 * 
 * @param modelNames Array of full model names
 * @returns Array of unique backends found
 */
export function extractBackends(modelNames: string[]): TextBackend[] {
  const backends = new Set<TextBackend>();

  for (const fullName of modelNames) {
    const parsed = parseTextModelName(fullName);
    if (parsed.backend) {
      backends.add(parsed.backend);
    }
  }

  return Array.from(backends);
}
