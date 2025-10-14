/**
 * Builder pattern utilities for creating test model data
 */

import {
  ImageGenerationModelRecordOutput,
  TextGenerationModelRecordOutput,
} from '../../api-client';
import { TEST_MODEL_NAMES, TEST_PARAMETERS } from './test-constants';

/**
 * Builder pattern for creating ImageGenerationModelRecordOutput test data
 */
export class ImageModelBuilder {
  private model: Partial<ImageGenerationModelRecordOutput> = {
    name: TEST_MODEL_NAMES.DEFAULT,
    baseline: 'stable_diffusion_1',
    nsfw: false,
  };

  withName(name: string): this {
    this.model.name = name;
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

  withNsfw(nsfw: boolean): this {
    this.model.nsfw = nsfw;
    return this;
  }

  withDescription(description: string): this {
    this.model.description = description;
    return this;
  }

  build(): ImageGenerationModelRecordOutput {
    return this.model as ImageGenerationModelRecordOutput;
  }
}

/**
 * Builder pattern for creating TextGenerationModelRecordOutput test data
 */
export class TextModelBuilder {
  private model: Partial<TextGenerationModelRecordOutput> = {
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

  build(): TextGenerationModelRecordOutput {
    return this.model as TextGenerationModelRecordOutput;
  }
}
