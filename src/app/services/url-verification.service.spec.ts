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
      sha256Source: 'x-sha256',
      contentLength: 2048,
      contentType: 'application/octet-stream',
    });
  });

  it('should extract sha256 from etag when x-sha headers are missing for non-Hugging Face URLs', async () => {
    const etagSha = 'FA6C8CFD28EE20A137F53615A7F5C53481438CC69A6F732E635284C7B52BB097';
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: {
        get: (key: string) => {
          switch (key.toLowerCase()) {
            case 'etag':
              return `"${etagSha}"`;
            default:
              return null;
          }
        },
      },
    } as unknown as Response);

    (globalThis as { fetch: typeof fetch }).fetch = fetchSpy as unknown as typeof fetch;

    const result = await firstValueFrom(service.verifyUrl('https://example.com/file'));

    expect(result.success).toBe(true);
    expect(result.sha256sum).toBe(etagSha.toLowerCase());
    expect(result.sha256Source).toBe('etag');
  });

  it('should prefer x-linked-etag over etag for Hugging Face URLs', async () => {
    const linkedSha = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    const etagSha = 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: {
        get: (key: string) => {
          switch (key.toLowerCase()) {
            case 'x-linked-etag':
              return `"${linkedSha}"`;
            case 'etag':
              return `"${etagSha}"`;
            default:
              return null;
          }
        },
      },
    } as unknown as Response);

    (globalThis as { fetch: typeof fetch }).fetch = fetchSpy as unknown as typeof fetch;

    const result = await firstValueFrom(service.verifyUrl('https://huggingface.co/example/file'));

    expect(result.success).toBe(true);
    expect(result.sha256sum).toBe(linkedSha.toLowerCase());
    expect(result.sha256Source).toBe('redirect-x-linked-etag');
  });

  it('should capture x-linked-etag from a manual redirect probe for Hugging Face URLs', async () => {
    const linkedSha = 'DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD';

    const fetchSpy = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      if (init?.redirect === 'manual') {
        return Promise.resolve({
          ok: false,
          status: 302,
          statusText: 'Found',
          headers: {
            get: (key: string) => {
              switch (key.toLowerCase()) {
                case 'x-linked-etag':
                  return `"${linkedSha}"`;
                case 'location':
                  return 'https://cdn-lfs.hf.co/example/file';
                default:
                  return null;
              }
            },
          },
        } as unknown as Response);
      }

      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          get: (key: string) => {
            switch (key.toLowerCase()) {
              case 'content-length':
                return '2048';
              default:
                return null;
            }
          },
        },
      } as unknown as Response);
    });

    (globalThis as { fetch: typeof fetch }).fetch = fetchSpy as unknown as typeof fetch;

    const result = await firstValueFrom(service.verifyUrl('https://huggingface.co/example/file'));

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy).toHaveBeenNthCalledWith(1, 'https://huggingface.co/example/file', {
      method: 'HEAD',
      mode: 'cors',
      redirect: 'manual',
      signal: expect.any(AbortSignal) as unknown,
    });
    expect(fetchSpy).toHaveBeenNthCalledWith(2, 'https://huggingface.co/example/file', {
      method: 'HEAD',
      signal: expect.any(AbortSignal) as unknown,
      mode: 'cors',
    });

    expect(result.success).toBe(true);
    expect(result.sha256sum).toBe(linkedSha.toLowerCase());
    expect(result.sha256Source).toBe('redirect-x-linked-etag');
    expect(result.contentLength).toBe(2048);
  });

  it('should fall back to Hugging Face tree API LFS oid when redirect and final headers expose no hash', async () => {
    const lfsOid = '5383e5b15240c36a6a57934f00efac62578f3b6556e23cad0a8c83e1661575aa';
    const fetchSpy = vi.fn().mockImplementation((requestUrl: string, init?: RequestInit) => {
      if (init?.redirect === 'manual') {
        return Promise.resolve({
          ok: false,
          status: 0,
          statusText: '',
          type: 'opaqueredirect',
          headers: {
            get: () => null,
          },
        } as unknown as Response);
      }

      if (requestUrl.includes('/api/models/mirroring/horde_models/tree/main')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: {
            get: () => null,
          },
          json: () =>
            Promise.resolve([
              {
                path: '2dn_latentlensV1.safetensors',
                lfs: { oid: lfsOid },
              },
            ]),
        } as unknown as Response);
      }

      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        type: 'cors',
        url: requestUrl,
        headers: {
          get: () => null,
        },
      } as unknown as Response);
    });

    (globalThis as { fetch: typeof fetch }).fetch = fetchSpy as unknown as typeof fetch;

    const result = await firstValueFrom(
      service.verifyUrl(
        'https://huggingface.co/mirroring/horde_models/resolve/main/2dn_latentlensV1.safetensors',
      ),
    );

    expect(result.success).toBe(true);
    expect(result.sha256sum).toBe(lfsOid);
    expect(result.sha256Source).toBe('hf-tree-lfs-oid');
  });

  it('should keep x-linked-etag checksum when followed HEAD returns non-OK', async () => {
    const linkedSha = 'EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE';

    const fetchSpy = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      if (init?.redirect === 'manual') {
        return Promise.resolve({
          ok: false,
          status: 302,
          statusText: 'Found',
          headers: {
            get: (key: string) => {
              switch (key.toLowerCase()) {
                case 'x-linked-etag':
                  return `"${linkedSha}"`;
                default:
                  return null;
              }
            },
          },
        } as unknown as Response);
      }

      return Promise.resolve({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        headers: {
          get: () => null,
        },
      } as unknown as Response);
    });

    (globalThis as { fetch: typeof fetch }).fetch = fetchSpy as unknown as typeof fetch;

    const result = await firstValueFrom(service.verifyUrl('https://huggingface.co/example/file'));

    expect(result.success).toBe(true);
    expect(result.sha256sum).toBe(linkedSha.toLowerCase());
    expect(result.sha256Source).toBe('redirect-x-linked-etag');
  });

  it('should keep x-linked-etag checksum when followed HEAD fails with network error', async () => {
    const linkedSha = 'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF';

    const fetchSpy = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      if (init?.redirect === 'manual') {
        return Promise.resolve({
          ok: false,
          status: 302,
          statusText: 'Found',
          headers: {
            get: (key: string) => {
              switch (key.toLowerCase()) {
                case 'x-linked-etag':
                  return `"${linkedSha}"`;
                default:
                  return null;
              }
            },
          },
        } as unknown as Response);
      }

      return Promise.reject(new Error('Network failure after redirect'));
    });

    (globalThis as { fetch: typeof fetch }).fetch = fetchSpy as unknown as typeof fetch;

    const result = await firstValueFrom(service.verifyUrl('https://huggingface.co/example/file'));

    expect(result.success).toBe(true);
    expect(result.sha256sum).toBe(linkedSha.toLowerCase());
    expect(result.sha256Source).toBe('redirect-x-linked-etag');
  });

  it('should ignore plain etag fallback for Hugging Face URLs when x-linked-etag is absent', async () => {
    const etagSha = 'CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC';
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: {
        get: (key: string) => {
          switch (key.toLowerCase()) {
            case 'etag':
              return `"${etagSha}"`;
            default:
              return null;
          }
        },
      },
    } as unknown as Response);

    (globalThis as { fetch: typeof fetch }).fetch = fetchSpy as unknown as typeof fetch;

    const result = await firstValueFrom(service.verifyUrl('https://huggingface.co/example/file'));

    expect(result.success).toBe(true);
    expect(result.sha256sum).toBeUndefined();
    expect(result.sha256Source).toBe('none');
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

  it('should detect CORS-blocked URLs via no-cors probe', async () => {
    let callCount = 0;
    const fetchSpy = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      callCount++;
      if (init.mode === 'cors') {
        return Promise.reject(new TypeError('Failed to fetch'));
      }
      // no-cors probe returns an opaque response
      return Promise.resolve({ type: 'opaque', ok: false, status: 0 } as Response);
    });

    (globalThis as { fetch: typeof fetch }).fetch = fetchSpy as unknown as typeof fetch;

    const result = await firstValueFrom(service.verifyUrl('https://example.com/cors-blocked'));

    expect(callCount).toBe(2);
    expect(result.success).toBe(false);
    expect(result.corsBlocked).toBe(true);
    expect(result.error).toContain('CORS');
  });
});
