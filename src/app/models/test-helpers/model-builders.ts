/**
 * Builder pattern utilities for creating test model data
 */

import { KNOWN_IMAGE_GENERATION_BASELINE, ModelClassification } from '../../api-client';
import { ImageGenerationModelRecord, TextGenerationModelRecord } from '../api.models';
import { TEST_MODEL_NAMES, TEST_PARAMETERS } from './test-constants';

/**
 * Builder pattern for creating ImageGenerationModelRecord test data
 */
export class ImageModelBuilder {
  private model: ImageGenerationModelRecord = {
    name: TEST_MODEL_NAMES.DEFAULT,
    baseline: 'stable_diffusion_1' as KNOWN_IMAGE_GENERATION_BASELINE,
    nsfw: false,
  };

  withName(name: string): this {
    this.model.name = name;
    return this;
  }

  withBaseline(baseline: KNOWN_IMAGE_GENERATION_BASELINE): this {
    this.model.baseline = baseline;
    return this;
  }

  withTags(tags: string[]): this {
    this.model.tags = tags;
    return this;
  }

  withNsfw(nsfw: boolean): this {
    this.model.nsfw = nsfw;
    return this;
  }

  withDescription(description: string): this {
    this.model.description = description;
    return this;
  }

  withModelClassification(classification: ModelClassification): this {
    this.model.model_classification = classification;
    return this;
  }

  build(): ImageGenerationModelRecord {
    return this.model;
  }
}

/**
 * Builder pattern for creating TextGenerationModelRecord test data
 */
export class TextModelBuilder {
  private model: TextGenerationModelRecord = {
    name: TEST_MODEL_NAMES.DEFAULT,
    parameters: TEST_PARAMETERS.LLAMA_7B,
  };

  withName(name: string): this {
    this.model.name = name;
    return this;
  }

  withParameters(parameters: number): this {
    this.model.parameters = parameters;
    return this;
  }

  withBaseline(baseline: string): this {
    this.model.baseline = baseline;
    return this;
  }

  withTags(tags: string[]): this {
    this.model.tags = tags;
    return this;
  }

  withModelClassification(classification: ModelClassification): this {
    this.model.model_classification = classification;
    return this;
  }

  build(): TextGenerationModelRecord {
    return this.model;
  }
}
