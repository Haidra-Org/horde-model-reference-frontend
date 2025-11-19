import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { UrlVerificationService } from './url-verification.service';

describe('UrlVerificationService', () => {
  let service: UrlVerificationService;
  let originalFetch: typeof fetch | undefined;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
    });
    service = TestBed.inject(UrlVerificationService);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch as typeof fetch;
  });

  it('should report an error when URL is missing', async () => {
    const result = await firstValueFrom(service.verifyUrl(''));
    expect(result.success).toBe(false);
    expect(result.error).toBe('URL is required');
  });

  it('should report an error when URL format is invalid', async () => {
    const result = await firstValueFrom(service.verifyUrl('not-a-url'));
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid URL format');
  });

  it('should verify URL metadata successfully', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: {
        get: (key: string) => {
          switch (key.toLowerCase()) {
            case 'x-sha256':
              return 'ABC123';
            case 'content-length':
              return '2048';
            case 'content-type':
              return 'application/octet-stream';
            default:
              return null;
          }
        },
      },
    } as unknown as Response);

    (globalThis as { fetch: typeof fetch }).fetch = fetchSpy as unknown as typeof fetch;

    const result = await firstValueFrom(service.verifyUrl('https://example.com/file'));

    expect(fetchSpy).toHaveBeenCalledWith('https://example.com/file', {
      method: 'HEAD',
      signal: expect.any(AbortSignal) as unknown,
      mode: 'cors',
    });
    expect(result).toEqual({
      success: true,
      sha256sum: 'abc123',
      contentLength: 2048,
      contentType: 'application/octet-stream',
    });
  });

  it('should surface HTTP errors from HEAD requests', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      headers: {
        get: () => null,
      },
    } as unknown as Response);

    (globalThis as { fetch: typeof fetch }).fetch = fetchSpy as unknown as typeof fetch;

    const result = await firstValueFrom(service.verifyUrl('https://example.com/missing'));

    expect(result).toEqual({
      success: false,
      error: 'HTTP 404: Not Found',
    });
  });

  it('should handle network failures gracefully', async () => {
    const fetchSpy = vi.fn().mockRejectedValue(new Error('Network failure'));

    (globalThis as { fetch: typeof fetch }).fetch = fetchSpy as unknown as typeof fetch;

    const result = await firstValueFrom(service.verifyUrl('https://example.com/file'));

    expect(result).toEqual({
      success: false,
      error: 'Network failure',
    });
  });
});
