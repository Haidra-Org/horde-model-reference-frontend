import { describe, expect, it } from 'vitest';
import { formatRequestError } from './request-error';

describe('structured request errors', () => {
  it('keeps field paths and messages from server validation', () => {
    expect(
      formatRequestError([
        { loc: ['body', 'config', 'download', 0, 'future'], msg: 'Extra inputs are not permitted' },
      ]),
    ).toBe('config.download[0].future: Extra inputs are not permitted');
  });
  it('renders nested nonstandard error objects without object coercion', () => {
    expect(
      formatRequestError({
        detail: { errors: [{ path: 'future_schema', message: 'Unsupported schema' }] },
      }),
    ).toBe('future_schema: Unsupported schema');
    expect(formatRequestError({ unknown: { reason: 'not supported' } })).toContain('not supported');
  });
});
