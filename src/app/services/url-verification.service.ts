import { Injectable } from '@angular/core';
import { Observable, catchError, of, timeout } from 'rxjs';

/**
 * Result of a URL verification attempt
 */
export interface UrlVerificationResult {
  success: boolean;
  sha256sum?: string;
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

      fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        // Allow CORS for cross-origin requests
        mode: 'cors',
      })
        .then((response) => {
          finalizeRequest();

          if (!response.ok) {
            observer.next({
              success: false,
              error: `HTTP ${response.status}: ${response.statusText}`,
            });
            observer.complete();
            return;
          }

          // Extract metadata from headers
          const sha256sum = this.extractSha256FromHeaders(response.headers);
          const contentLength = response.headers.get('content-length');
          const contentType = response.headers.get('content-type');

          observer.next({
            success: true,
            sha256sum,
            contentLength: contentLength ? parseInt(contentLength, 10) : undefined,
            contentType: contentType || undefined,
          });
          observer.complete();
        })
        .catch((error: Error) => {
          finalizeRequest();

          if (error.name === 'AbortError') {
            observer.next({
              success: false,
              error: 'Request timed out',
            });
            observer.complete();
            return;
          }

          // CORS or network errors — retry with no-cors to distinguish
          // a CORS-blocked server from a truly unreachable URL
          this.retryCorsProbe(url, timeoutMs).then((probeReachable) => {
            if (probeReachable) {
              observer.next({
                success: false,
                corsBlocked: true,
                error:
                  'CORS policy prevented verification — the URL may still be valid. Please double-check it manually.',
              });
            } else {
              observer.next({
                success: false,
                error: error.message || 'Failed to verify URL',
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
  private async retryCorsProbe(url: string, timeoutMs: number): Promise<boolean> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        mode: 'no-cors',
        signal: controller.signal,
      });
      // Opaque responses have type 'opaque' and status 0
      return response.type === 'opaque' || response.ok;
    } catch {
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
   * - x-linked-etag (Huggingface - quoted string)
   * - digest (with SHA-256= prefix)
   *
   * @param headers Response headers
   * @returns SHA256 checksum if found, undefined otherwise
   */
  private extractSha256FromHeaders(headers: Headers): string | undefined {
    // Try common header names
    const sha256Header = headers.get('x-sha256') || headers.get('x-checksum-sha256');
    if (sha256Header) {
      return this.normalizeSha256(sha256Header);
    }

    // Check x-linked-etag header (Huggingface format - quoted string)
    const linkedEtag = headers.get('x-linked-etag');
    if (linkedEtag) {
      // Remove quotes and extract SHA256 if present
      const unquoted = linkedEtag.replace(/^["']|["']$/g, '');
      if (/^[a-fA-F0-9]{64}$/.test(unquoted)) {
        return this.normalizeSha256(unquoted);
      }
    }

    // Check Digest header (RFC 3230)
    const digest = headers.get('digest');
    if (digest) {
      const sha256Match = digest.match(/SHA-256=([a-fA-F0-9]{64})/i);
      if (sha256Match) {
        return this.normalizeSha256(sha256Match[1]);
      }
    }

    return undefined;
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
