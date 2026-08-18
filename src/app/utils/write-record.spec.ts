/**
 * Tests for write-record utility — blankForm, editFormFromRecord, formToRecord.
 */
import { describe, it, expect } from 'vitest';
import { blankForm, editFormFromRecord, formToRecord } from './write-record';
import type { WriteFormState } from './write-record';
import { MODEL_REFERENCE_CATEGORY } from '../api-client';

describe('write-record', () => {
  describe('blankForm', () => {
    it('creates a blank form with image_generation defaults', () => {
      const form = blankForm(MODEL_REFERENCE_CATEGORY.ImageGeneration);
      expect(form.name).toBe('');
      expect(form.baseline).toBe('stable_diffusion_xl');
      expect(form.style).toBe('generalist');
      expect(form.nsfw).toBe(false);
      expect(form.inpainting).toBe(false);
      expect(form.download).toHaveLength(1);
      expect(form.download[0].file_name).toBe('');
      expect(form.download[0].known_slow_download).toBe(false);
    });

    it('creates a blank form with text_generation defaults', () => {
      const form = blankForm(MODEL_REFERENCE_CATEGORY.TextGeneration);
      expect(form.baseline).toBe('llama');
      expect(form.instruct_format).toBe('ChatML');
      expect(form.parameters).toBe('');
    });

    it('creates a blank form with a string category', () => {
      const form = blankForm('clip');
      expect(form.name).toBe('');
      expect(form.baseline).toBe('llama');
    });
  });

  describe('editFormFromRecord', () => {
    it('pre-fills form state from a plain record', () => {
      const record: Record<string, unknown> = {
        name: 'test-model',
        display_name: 'Test Model',
        description: 'A test model',
        version: '2.0',
        baseline: 'stable_diffusion_xl',
        nsfw: true,
        style: 'anime',
        inpainting: true,
        tags: ['tag1', 'tag2'],
        trigger: ['trigger1'],
        homepage: 'https://example.com',
        min_bridge_version: 23,
        parameters: 7000000000,
        instruct_format: 'Mistral',
        text_model_group: 'my-group',
        config: {
          download: [
            {
              file_name: 'model.safetensors',
              file_url: 'https://huggingface.co/test',
              sha256sum: 'abc123',
              known_slow_download: true,
            },
          ],
        },
      };

      const form = editFormFromRecord(MODEL_REFERENCE_CATEGORY.ImageGeneration, record);
      expect(form.name).toBe('test-model');
      expect(form.display_name).toBe('Test Model');
      expect(form.baseline).toBe('stable_diffusion_xl');
      expect(form.nsfw).toBe(true);
      expect(form.style).toBe('anime');
      expect(form.inpainting).toBe(true);
      expect(form.tags).toBe('tag1, tag2');
      expect(form.trigger).toBe('trigger1');
      expect(form.homepage).toBe('https://example.com');
      expect(form.min_bridge_version).toBe('23');
      expect(form.parameters).toBe('7000000000');
      expect(form.instruct_format).toBe('Mistral');
      expect(form.text_model_group).toBe('my-group');
      expect(form.download).toHaveLength(1);
      expect(form.download[0].file_name).toBe('model.safetensors');
    });

    it('handles missing optional fields gracefully', () => {
      const record: Record<string, unknown> = { name: 'bare-model' };
      const form = editFormFromRecord(MODEL_REFERENCE_CATEGORY.TextGeneration, record);
      expect(form.name).toBe('bare-model');
      expect(form.display_name).toBe('');
      expect(form.description).toBe('');
      expect(form.nsfw).toBe(false);
      expect(form.download).toHaveLength(1);
    });

    it('handles tags as array or empty', () => {
      const withTags: Record<string, unknown> = { name: 'x', tags: ['a', 'b', 'c'] };
      expect(editFormFromRecord('image_generation', withTags).tags).toBe('a, b, c');

      const withoutTags: Record<string, unknown> = { name: 'x' };
      expect(editFormFromRecord('image_generation', withoutTags).tags).toBe('');
    });
  });

  describe('formToRecord', () => {
    const baseForm: WriteFormState = {
      ...blankForm(MODEL_REFERENCE_CATEGORY.ImageGeneration),
      name: 'my-model',
      display_name: '',
      description: '',
      version: '',
      baseline: 'stable_diffusion_xl',
      style: 'generalist',
      nsfw: false,
      inpainting: false,
      tags: '',
      trigger: '',
      homepage: '',
      min_bridge_version: '',
      parameters: '',
      instruct_format: '',
      text_model_group: '',
      download: [{ file_name: '', file_url: '', sha256sum: '', known_slow_download: false }],
    };

    it('converts image_generation form to record', () => {
      const form: WriteFormState = {
        ...baseForm,
        name: 'test-sd',
        display_name: 'Test SD',
        baseline: 'flux_1',
        nsfw: true,
        style: 'realistic',
        inpainting: false,
        tags: 'foo, bar , baz',
        trigger: 't1, t2',
        homepage: 'https://civitai.com',
        min_bridge_version: '23',
      };

      const record = formToRecord(form, MODEL_REFERENCE_CATEGORY.ImageGeneration);
      expect(record['name']).toBe('test-sd');
      expect(record['display_name']).toBe('Test SD');
      expect(record['baseline']).toBe('flux_1');
      expect(record['nsfw']).toBe(true);
      expect(record['style']).toBe('realistic');
      expect(record['inpainting']).toBeUndefined(); // false → not set
      expect(record['tags']).toEqual(['foo', 'bar', 'baz']);
      expect(record['trigger']).toEqual(['t1', 't2']);
      expect(record['homepage']).toBe('https://civitai.com');
      expect(record['min_bridge_version']).toBe(23);
      const config = record['config'] as { download: unknown[] };
      expect(config.download).toHaveLength(0); // empty file_name → filtered out
    });

    it('converts text_generation form to record', () => {
      const form: WriteFormState = {
        ...baseForm,
        name: 'llama-3',
        baseline: 'llama',
        parameters: '8030000000',
        nsfw: false,
        instruct_format: 'ChatML',
        text_model_group: 'llama-3-group',
        tags: 'llm, chat',
      };

      const record = formToRecord(form, MODEL_REFERENCE_CATEGORY.TextGeneration);
      expect(record['name']).toBe('llama-3');
      expect(record['parameters']).toBe(8030000000);
      expect(record['instruct_format']).toBe('ChatML');
      expect(record['text_model_group']).toBe('llama-3-group');
      expect(record['nsfw']).toBe(false);
      expect(record['tags']).toEqual(['llm', 'chat']);
    });

    it('converts inpainting=true', () => {
      const form: WriteFormState = { ...baseForm, name: 'x', inpainting: true };
      const record = formToRecord(form, 'image_generation');
      expect(record['inpainting']).toBe(true);
    });

    it('converts download entries', () => {
      const form: WriteFormState = {
        ...baseForm,
        name: 'has-files',
        download: [
          {
            file_name: 'model.safetensors',
            file_url: 'https://example.com/model',
            sha256sum: 'abc',
            known_slow_download: true,
          },
          {
            file_name: '',
            file_url: '',
            sha256sum: '',
            known_slow_download: false,
          },
        ],
      };

      const record = formToRecord(form, 'image_generation');
      const config = record['config'] as {
        download: { file_name: string; sha256sum: string; known_slow_download: boolean }[];
      };
      expect(config.download).toHaveLength(1);
      expect(config.download[0].file_name).toBe('model.safetensors');
      expect(config.download[0].sha256sum).toBe('abc');
      expect(config.download[0].known_slow_download).toBe(true);
    });

    it('handles text_model_group defaulting to name', () => {
      const form: WriteFormState = {
        ...baseForm,
        name: 'no-group',
        baseline: 'llama',
        parameters: '1000',
        instruct_format: 'Vicuna',
      };
      const record = formToRecord(form, 'text_generation');
      expect(record['text_model_group']).toBe('no-group');
    });

    it('converts empty tags to undefined', () => {
      const form: WriteFormState = { ...baseForm, name: 'x', tags: '' };
      const record = formToRecord(form, 'image_generation');
      expect(record['tags']).toBeUndefined();
    });
  });
});
