import { Injectable } from '@angular/core';
import { Observable, catchError, of, timeout } from 'rxjs';

export type UrlVerificationShaSource =
  | 'none'
  | 'x-sha256'
  | 'x-checksum-sha256'
  | 'x-linked-etag'
  | 'digest'
  | 'etag'
  | 'redirect-x-linked-etag'
  | 'hf-tree-lfs-oid';

interface Sha256ExtractionResult {
  sha256sum?: string;
  source: UrlVerificationShaSource;
}

interface HuggingFaceResolveInfo {
  owner: string;
  repo: string;
  revision: string;
  filePath: string;
}

interface HuggingFaceTreeEntry {
  path?: string;
  rfilename?: string;
  name?: string;
  lfs?: {
    oid?: string;
  };
}

/**
 * Result of a URL verification attempt
 */
export interface UrlVerificationResult {
  success: boolean;
  sha256sum?: string;
  sha256Source?: UrlVerificationShaSource;
  contentLength?: number;
  contentType?: string;
  error?: string;
  /** True when verification failed due to CORS but the URL may still be valid */
  corsBlocked?: boolean;
}

/**
 * Service for verifying download URLs
 *
 * Performs HEAD requests to verify URLs are accessible and optionally
 * extracts SHA256 checksum from response headers.
 */
@Injectable({
  providedIn: 'root',
})
export class UrlVerificationService {
  private readonly DEBUG_LOCAL_STORAGE_KEY = 'hmr.urlVerification.debug';

  /**
   * Verify a download URL by performing a HEAD request
   *
   * @param url The URL to verify
   * @param timeoutMs Timeout in milliseconds (default: 30000)
   * @returns Observable with verification result
   */
  verifyUrl(url: string, timeoutMs = 30000): Observable<UrlVerificationResult> {
    if (!url || !url.trim()) {
      return of({
        success: false,
        error: 'URL is required',
      });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return of({
        success: false,
        error: 'Invalid URL format',
      });
    }

    // Perform HEAD request using fetch API
    return new Observable<UrlVerificationResult>((observer) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      let settled = false;

      const finalizeRequest = () => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timeoutId);
      };

      const isHuggingFaceUrl = this.isHuggingFaceUrl(url);
      const traceId = this.createTraceId();
      const debugEnabled = this.isDebugEnabled();
      const sourceUrlSummary = this.getUrlLogSummary(url);
      const log = (step: string, details?: Record<string, unknown>) => {
        this.logVerificationStep(traceId, step, details, debugEnabled);
      };

      log('verify:start', {
        urlHost: sourceUrlSummary.host,
        urlPath: sourceUrlSummary.pathname,
        timeoutMs,
        isHuggingFaceUrl,
      });

      let redirectLinkedEtagSha: string | undefined;

      this.tryExtractLinkedEtagFromRedirect(url, controller.signal, isHuggingFaceUrl, log)
        .then((linkedEtagSha) => {
          redirectLinkedEtagSha = linkedEtagSha;
          log('redirect-probe:resolved', {
            foundLinkedHash: Boolean(linkedEtagSha),
            hashPrefix: linkedEtagSha?.slice(0, 12),
          });

          log('head:followed:start', {
            urlHost: sourceUrlSummary.host,
            urlPath: sourceUrlSummary.pathname,
          });
          return fetch(url, {
            method: 'HEAD',
            signal: controller.signal,
            // Allow CORS for cross-origin requests
            mode: 'cors',
          });
        })
        .then(async (response) => {
          finalizeRequest();

          const responseUrlSummary = this.getUrlLogSummary(response.url);
          log('head:followed:response', {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok,
            type: response.type,
            responseHost: responseUrlSummary.host,
            responsePath: responseUrlSummary.pathname,
          });

          const extraction = this.extractSha256FromHeaders(response.headers, isHuggingFaceUrl);

          let sha256sum = redirectLinkedEtagSha ?? extraction.sha256sum;
          let sha256Source: UrlVerificationShaSource = redirectLinkedEtagSha
            ? 'redirect-x-linked-etag'
            : extraction.source;

          if (!sha256sum && isHuggingFaceUrl) {
            log('hf-tree-fallback:start');
            const treeFallback = await this.tryResolveHfSha256ViaTreeApi(
              url,
              controller.signal,
              log,
            );
            if (treeFallback?.sha256sum) {
              sha256sum = treeFallback.sha256sum;
              sha256Source = treeFallback.source;
              log('hf-tree-fallback:resolved', {
                source: sha256Source,
                hashPrefix: sha256sum.slice(0, 12),
              });
            } else {
              log('hf-tree-fallback:miss');
            }
          }

          log('sha256:resolved', {
            found: Boolean(sha256sum),
            source: sha256Source,
            hashPrefix: sha256sum?.slice(0, 12),
          });

          if (!response.ok) {
            if (sha256sum) {
              log('head:followed:non-ok:using-linked-hash', {
                status: response.status,
                source: sha256Source,
              });

              observer.next({
                success: true,
                sha256sum,
                sha256Source,
                contentLength: undefined,
                contentType: undefined,
              });
              observer.complete();
              return;
            }

            observer.next({
              success: false,
              error: `HTTP ${response.status}: ${response.statusText}`,
            });
            log('verify:failed:http-non-ok', {
              status: response.status,
              statusText: response.statusText,
            });
            observer.complete();
            return;
          }

          // Extract metadata from headers
          const contentLength = response.headers.get('content-length');
          const contentType = response.headers.get('content-type');

          observer.next({
            success: true,
            sha256sum,
            sha256Source,
            contentLength: contentLength ? parseInt(contentLength, 10) : undefined,
            contentType: contentType || undefined,
          });
          log('verify:success', {
            sha256Found: Boolean(sha256sum),
            sha256Source,
            contentLength,
            contentType,
          });
          observer.complete();
        })
        .catch((error: Error) => {
          finalizeRequest();
          log('verify:catch', {
            errorName: error.name,
            errorMessage: error.message,
          });

          if (error.name === 'AbortError') {
            observer.next({
              success: false,
              error: 'Request timed out',
            });
            log('verify:failed:timeout');
            observer.complete();
            return;
          }

          if (redirectLinkedEtagSha) {
            log('verify:recover-with-redirect-hash', {
              source: 'redirect-x-linked-etag',
              hashPrefix: redirectLinkedEtagSha.slice(0, 12),
            });

            observer.next({
              success: true,
              sha256sum: redirectLinkedEtagSha,
              sha256Source: 'redirect-x-linked-etag',
              contentLength: undefined,
              contentType: undefined,
            });
            observer.complete();
            return;
          }

          // CORS or network errors — retry with no-cors to distinguish
          // a CORS-blocked server from a truly unreachable URL
          this.retryCorsProbe(url, timeoutMs, log).then((probeReachable) => {
            if (probeReachable) {
              observer.next({
                success: false,
                corsBlocked: true,
                error:
                  'CORS policy prevented verification — the URL may still be valid. Please double-check it manually.',
              });
              log('verify:failed:cors-blocked');
            } else {
              observer.next({
                success: false,
                error: error.message || 'Failed to verify URL',
              });
              log('verify:failed:network', {
                errorMessage: error.message,
              });
            }
            observer.complete();
          });
        });

      return () => {
        if (!settled) {
          controller.abort();
        }
        finalizeRequest();
      };
    }).pipe(
      timeout(timeoutMs + 1000), // Add buffer to RxJS timeout
      catchError((error: Error) => {
        return of({
          success: false,
          error: error.message || 'Verification failed',
        });
      }),
    );
  }

  /**
   * Retry a failed request with `no-cors` mode.
   * An opaque response (type === 'opaque', status === 0) means the server is
   * reachable but blocking cross-origin reads — i.e. a CORS issue, not a dead link.
   */
  private async retryCorsProbe(
    url: string,
    timeoutMs: number,
    log?: (step: string, details?: Record<string, unknown>) => void,
  ): Promise<boolean> {
    log?.('cors-probe:start', { url });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        mode: 'no-cors',
        signal: controller.signal,
      });
      // Opaque responses have type 'opaque' and status 0
      const reachable = response.type === 'opaque' || response.ok;
      log?.('cors-probe:response', {
        responseType: response.type,
        status: response.status,
        ok: response.ok,
        reachable,
      });
      return reachable;
    } catch {
      log?.('cors-probe:error');
      return false;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Extract SHA256 checksum from response headers
   *
   * Looks for common header names that might contain SHA256:
   * - x-sha256
   * - x-checksum-sha256
   * - x-linked-etag (Hugging Face redirect response)
   * - digest (with SHA-256= prefix)
   * - etag (common CDN/final response header, skipped for Hugging Face URLs)
   *
   * @param headers Response headers
   * @param preferLinkedEtag Whether to avoid plain ETag fallback and prefer linked hashes only
   * @returns SHA256 checksum if found, undefined otherwise
   */
  private extractSha256FromHeaders(
    headers: Headers,
    preferLinkedEtag = false,
  ): Sha256ExtractionResult {
    const xSha256 = headers.get('x-sha256');
    if (xSha256) {
      return {
        sha256sum: this.normalizeSha256(xSha256),
        source: 'x-sha256',
      };
    }

    const xChecksumSha256 = headers.get('x-checksum-sha256');
    if (xChecksumSha256) {
      return {
        sha256sum: this.normalizeSha256(xChecksumSha256),
        source: 'x-checksum-sha256',
      };
    }

    // Hugging Face often emits SHA256 in x-linked-etag on redirect responses.
    // This is preferred over plain ETag because ETag may be an XET pointer.
    const linkedEtagSha = this.extractSha256FromEtag(headers.get('x-linked-etag'));
    if (linkedEtagSha) {
      return {
        sha256sum: linkedEtagSha,
        source: 'x-linked-etag',
      };
    }

    // Check Digest header (RFC 3230)
    const digest = headers.get('digest');
    if (digest) {
      const sha256Match = digest.match(/SHA-256=([a-fA-F0-9]{64})/i);
      if (sha256Match) {
        return {
          sha256sum: this.normalizeSha256(sha256Match[1]),
          source: 'digest',
        };
      }
    }

    // For Hugging Face links, avoid plain ETag fallback because it may be an XET pointer.
    if (preferLinkedEtag) {
      return { source: 'none' };
    }

    const etagSha = this.extractSha256FromEtag(headers.get('etag'));
    if (etagSha) {
      return {
        sha256sum: etagSha,
        source: 'etag',
      };
    }

    return { source: 'none' };
  }

  private isHuggingFaceUrl(url: string): boolean {
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      return (
        hostname === 'huggingface.co' ||
        hostname.endsWith('.huggingface.co') ||
        hostname === 'hf.co' ||
        hostname.endsWith('.hf.co')
      );
    } catch {
      return false;
    }
  }

  /**
   * Try to read X-Linked-ETag from the first redirect hop for Hugging Face URLs.
   * Browsers normally expose only the final response when redirects are followed.
   */
  private async tryExtractLinkedEtagFromRedirect(
    url: string,
    signal: AbortSignal,
    shouldProbe: boolean,
    log: (step: string, details?: Record<string, unknown>) => void,
  ): Promise<string | undefined> {
    if (!shouldProbe) {
      log('redirect-probe:skip', { reason: 'not-huggingface-url' });
      return undefined;
    }

    const sourceUrlSummary = this.getUrlLogSummary(url);
    log('redirect-probe:start', {
      urlHost: sourceUrlSummary.host,
      urlPath: sourceUrlSummary.pathname,
    });

    try {
      const response = await fetch(url, {
        method: 'HEAD',
        mode: 'cors',
        redirect: 'manual',
        signal,
      });

      const linkedEtag = response.headers.get('x-linked-etag');
      const extracted = this.extractSha256FromEtag(linkedEtag);

      log('redirect-probe:response', {
        status: response.status,
        statusText: response.statusText,
        responseType: response.type,
        accessControlExposeHeaders: response.headers.get('access-control-expose-headers'),
        xLinkedEtag: linkedEtag,
        xXetHash: response.headers.get('x-xet-hash'),
        etag: response.headers.get('etag'),
        location: response.headers.get('location'),
        extractedSha256Prefix: extracted?.slice(0, 12),
      });

      return extracted;
    } catch {
      log('redirect-probe:error');
      // If manual redirect probing fails (CORS/opaque redirect/browser limitations),
      // fall back to the standard followed HEAD request path.
      return undefined;
    }
  }

  private parseHuggingFaceResolveUrl(url: string): HuggingFaceResolveInfo | undefined {
    try {
      const parsed = new URL(url);
      const match = parsed.pathname.match(/^\/([^/]+)\/([^/]+)\/resolve\/([^/]+)\/(.+)$/);

      if (!match) {
        return undefined;
      }

      return {
        owner: decodeURIComponent(match[1]),
        repo: decodeURIComponent(match[2]),
        revision: decodeURIComponent(match[3]),
        filePath: decodeURIComponent(match[4]),
      };
    } catch {
      return undefined;
    }
  }

  private extractNextLink(linkHeader: string | null): string | undefined {
    if (!linkHeader) {
      return undefined;
    }

    const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/i);
    return nextMatch?.[1];
  }

  private async tryResolveHfSha256ViaTreeApi(
    sourceUrl: string,
    signal: AbortSignal,
    log: (step: string, details?: Record<string, unknown>) => void,
  ): Promise<Sha256ExtractionResult | undefined> {
    const resolveInfo = this.parseHuggingFaceResolveUrl(sourceUrl);
    if (!resolveInfo) {
      log('hf-tree-fallback:skip', { reason: 'unparseable-resolve-url' });
      return undefined;
    }

    const repoId = `${resolveInfo.owner}/${resolveInfo.repo}`;
    let nextUrl =
      `https://huggingface.co/api/models/${encodeURIComponent(resolveInfo.owner)}/` +
      `${encodeURIComponent(resolveInfo.repo)}/tree/${encodeURIComponent(resolveInfo.revision)}`;

    let page = 0;
    while (nextUrl && page < 12) {
      page += 1;
      log('hf-tree-fallback:request', {
        page,
        repoId,
        revision: resolveInfo.revision,
        nextUrlPath: this.getUrlLogSummary(nextUrl).pathname,
      });

      let response: Response;
      try {
        response = await fetch(nextUrl, {
          method: 'GET',
          mode: 'cors',
          signal,
        });
      } catch (error) {
        log('hf-tree-fallback:error', {
          page,
          errorMessage: error instanceof Error ? error.message : String(error),
        });
        return undefined;
      }

      log('hf-tree-fallback:response', {
        page,
        status: response.status,
        ok: response.ok,
        link: response.headers.get('link'),
      });

      if (!response.ok) {
        return undefined;
      }

      let entries: unknown;
      try {
        entries = await response.json();
      } catch {
        log('hf-tree-fallback:invalid-json', { page });
        return undefined;
      }

      if (Array.isArray(entries)) {
        const normalizedTargetPath = resolveInfo.filePath.replace(/^\/+/, '');
        const targetFileName = normalizedTargetPath.split('/').at(-1) ?? normalizedTargetPath;
        const target = (entries as HuggingFaceTreeEntry[]).find((entry) => {
          const candidates = [entry.path, entry.rfilename, entry.name]
            .filter((value): value is string => typeof value === 'string')
            .map((value) => value.replace(/^\/+/, ''));

          return candidates.some(
            (candidate) => candidate === normalizedTargetPath || candidate === targetFileName,
          );
        });

        if (target?.lfs?.oid) {
          const normalized = this.normalizeSha256(target.lfs.oid);
          if (/^[a-f0-9]{64}$/.test(normalized)) {
            return {
              sha256sum: normalized,
              source: 'hf-tree-lfs-oid',
            };
          }
        }

        log('hf-tree-fallback:page-scan', {
          page,
          entries: entries.length,
          foundTarget: Boolean(target),
          targetPath: target?.path,
          targetRfilename: target?.rfilename,
          targetName: target?.name,
          hasLfsOid: Boolean(target?.lfs?.oid),
        });
      } else {
        log('hf-tree-fallback:unexpected-shape', { page, dataType: typeof entries });
        return undefined;
      }

      const nextLink = this.extractNextLink(response.headers.get('link'));
      if (!nextLink || nextLink === nextUrl) {
        break;
      }

      nextUrl = nextLink;
    }

    return undefined;
  }

  private createTraceId(): string {
    return Math.random().toString(36).slice(2, 10);
  }

  private getUrlLogSummary(rawUrl: string): { host?: string; pathname?: string } {
    try {
      const parsed = new URL(rawUrl);
      return {
        host: parsed.host,
        pathname: parsed.pathname,
      };
    } catch {
      return {};
    }
  }

  private isDebugEnabled(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }

    const queryEnabled = new URLSearchParams(window.location.search).get('debugUrlVerification');
    if (queryEnabled === '1') {
      return true;
    }

    return window.localStorage.getItem(this.DEBUG_LOCAL_STORAGE_KEY) === '1';
  }

  private logVerificationStep(
    traceId: string,
    step: string,
    details: Record<string, unknown> | undefined,
    enabled: boolean,
  ): void {
    if (!enabled) {
      return;
    }

    if (details) {
      console.debug(`[UrlVerification:${traceId}] ${step}`, details);
      return;
    }

    console.debug(`[UrlVerification:${traceId}] ${step}`);
  }

  /**
   * Extract SHA256 from ETag-like values.
   * Supports quoted values, weak ETags (`W/`), and `sha256:` prefixed tokens.
   */
  private extractSha256FromEtag(value: string | null): string | undefined {
    if (!value) {
      return undefined;
    }

    const trimmed = value.trim();
    const withoutWeakPrefix = trimmed.replace(/^w\//i, '');
    const unquoted = withoutWeakPrefix.replace(/^["']|["']$/g, '');
    const normalized = unquoted.toLowerCase().startsWith('sha256:')
      ? unquoted.slice('sha256:'.length)
      : unquoted;

    if (!/^[a-fA-F0-9]{64}$/.test(normalized)) {
      return undefined;
    }

    return this.normalizeSha256(normalized);
  }

  /**
   * Normalize SHA256 checksum to lowercase hex string
   *
   * @param sha256 SHA256 string (may include whitespace or mixed case)
   * @returns Normalized SHA256 string
   */
  private normalizeSha256(sha256: string): string {
    return sha256
      .trim()
      .toLowerCase()
      .replace(/[^a-f0-9]/g, '');
  }
}
