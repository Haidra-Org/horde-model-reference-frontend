import { describe, expect, it } from 'vitest';
import { inspectJsonModel, validateJsonModel, changedJsonPaths } from './json-model-validation';
import { blankForm, formToRecord } from './write-record';
import { prepareWriteRequest } from './write-request';
import { MODEL_REFERENCE_CATEGORY } from '../api-client';

const category = MODEL_REFERENCE_CATEGORY.ImageGeneration;
const model = (): Record<string, unknown> =>
  JSON.parse(JSON.stringify(formToRecord({ ...blankForm(category), name: 'test' }, category)));
describe('JSON model compatibility', () => {
  for (const format of ['legacy', 'v2']) {
    it(`accepts the actual ${format} form request`, () => {
      const request = prepareWriteRequest(model(), category, format);
      expect(validateJsonModel(request, category, format)).toEqual([]);
      expect(inspectJsonModel(request, category, format)).toEqual([]);
    });
    it(`identifies unknown top-level keys in ${format}`, () => {
      const request = {
        ...prepareWriteRequest(model(), category, format),
        future_schema: { enabled: true },
      };
      expect(validateJsonModel(request, category, format)).toContainEqual(
        expect.objectContaining({ code: 'JSON_UNKNOWN_FIELD', path: '$.future_schema' }),
      );
    });
  }
  it('identifies an unknown download field rather than throwing it away', () => {
    const request = {
      ...model(),
      config: { download: [{ file_name: 'model', file_url: 'https://example.com', future: 123 }] },
    };
    expect(inspectJsonModel(request, category, 'v2')).toContainEqual(
      expect.objectContaining({ code: 'JSON_UNKNOWN_FIELD', path: '$.config.download[0].future' }),
    );
  });
  it('reports wrong collection/object shapes at their actual paths', () => {
    const request = { ...model(), config: { download: { file_name: 'bad-shape' } } };
    expect(inspectJsonModel(request, category, 'v2')).toContainEqual(
      expect.objectContaining({ code: 'JSON_SCHEMA_MISMATCH', path: '$.config.download' }),
    );
  });
  it('allows arbitrary requirement names but validates their values', () => {
    expect(
      validateJsonModel(
        { ...model(), requirements: { future_sampler_flag: true, schedules: ['simple'] } },
        category,
        'v2',
      ),
    ).toEqual([]);
    expect(
      validateJsonModel(
        { ...model(), requirements: { invalid: { nested: true } } },
        category,
        'v2',
      ),
    ).toContainEqual(
      expect.objectContaining({ path: '$.requirements.invalid', code: 'JSON_SCHEMA_MISMATCH' }),
    );
  });
  it('validates typed dictionary values and unknown licensing evidence fields', () => {
    const record = model();
    const licensing = record['licensing'] as Record<string, unknown>;
    expect(
      validateJsonModel(
        {
          ...record,
          licensing: { ...licensing, files: { 'vae.safetensors': { future_permission: 'yes' } } },
        },
        category,
        'v2',
      ),
    ).toContainEqual(
      expect.objectContaining({
        code: 'JSON_UNKNOWN_FIELD',
        path: '$.licensing.files["vae.safetensors"].future_permission',
      }),
    );
    expect(
      validateJsonModel(
        {
          ...record,
          licensing: { ...licensing, evidence: [{ source: 'https://example.com', custom: 'a' }] },
        },
        category,
        'v2',
      ),
    ).toContainEqual(expect.objectContaining({ path: '$.licensing.evidence[0].custom' }));
  });
  it('detects known legacy metadata the form would drop', () => {
    const request = {
      ...prepareWriteRequest(model(), category, 'legacy'),
      config: {
        files: [{ path: 'model.ckpt', sha256sum: 'sha', md5sum: 'md5' }],
        download: [{ file_name: 'model.ckpt', file_url: 'https://example.com', file_path: '' }],
      },
    };
    expect(inspectJsonModel(request, category, 'legacy')).toContainEqual(
      expect.objectContaining({ code: 'JSON_FORM_CONVERSION', path: '$.config.files[0].md5sum' }),
    );
  });
  it('reports an unavailable category schema without trying a generic coercion', () => {
    expect(validateJsonModel({}, 'future_category', 'v2')[0].code).toBe('JSON_UNSUPPORTED_SCHEMA');
  });
  it('finds server-side changes, including dropped nested values', () => {
    expect(
      changedJsonPaths(
        { config: { download: [{ name: 'model', custom: true }] } },
        { config: { download: [{ name: 'model' }] } },
      ),
    ).toEqual(['$.config.download[0].custom']);
    expect(changedJsonPaths({ a: 1 }, { a: 1, server_default: true })).toEqual([]);
  });
});
