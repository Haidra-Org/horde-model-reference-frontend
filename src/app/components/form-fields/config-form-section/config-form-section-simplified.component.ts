import { Component, input, output, signal, computed, effect, ChangeDetectionStrategy, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DownloadRecord } from '../../../api-client';
import { createEmptyDownloadRecord } from '../../../utils/config-converter';
import {
  UrlVerificationService,
  UrlVerificationResult,
} from '../../../services/url-verification.service';

/**
 * Verification state for a single download entry
 */
interface DownloadVerificationState {
  verified: boolean;
  verifying: boolean;
  error?: string;
  originalSha256sum?: string; // SHA256 from model data on load
  verifiedSha256sum?: string; // SHA256 from URL verification
  hasMismatch?: boolean; // True if original and verified don't match
  verifiedUrl?: string; // The URL that was successfully verified
}

/**
 * Simplified configuration form section for legacy models
 *
 * This component provides a simplified editing interface for model downloads,
 * hiding legacy-specific fields like files array and file_path.
 * The parent component handles conversion between simplified and legacy formats.
 */
@Component({
  selector: 'app-config-form-section-simplified',
  imports: [FormsModule],
  templateUrl: './config-form-section-simplified.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfigFormSectionSimplifiedComponent {
  private readonly urlVerificationService = inject(UrlVerificationService);

  readonly downloads = input<DownloadRecord[]>([]);
  readonly downloadsChange = output<DownloadRecord[]>();
  readonly validationErrors = output<string[]>();

  readonly isExpanded = signal(true);
  // Track verification state for each download by index
  private readonly verificationStates = signal<Map<number, DownloadVerificationState>>(new Map());

  constructor() {
    // Automatically emit validation errors whenever they change
    effect(() => {
      const errors = this.computedValidationErrors();
      this.validationErrors.emit(errors);
    });

    // Initialize and synchronize verification states with downloads
    effect(() => {
      const currentDownloads = this.downloads();
      const states = this.verificationStates();
      const newStates = new Map<number, DownloadVerificationState>();

      currentDownloads.forEach((download, index) => {
        const existingState = states.get(index);

        if (existingState) {
          // Check if URL has changed - if so, invalidate verification
          if (existingState.verifiedUrl && existingState.verifiedUrl !== download.file_url) {
            newStates.set(index, {
              verified: false,
              verifying: false,
              originalSha256sum: download.sha256sum,
            });
          } else {
            // Keep existing state but update original SHA256 if it changed
            newStates.set(index, {
              ...existingState,
              originalSha256sum: download.sha256sum || existingState.originalSha256sum,
            });
          }
        } else if (download.sha256sum) {
          // Initialize new state with original SHA256
          newStates.set(index, {
            verified: false,
            verifying: false,
            originalSha256sum: download.sha256sum,
          });
        }
      });

      // Only update if states changed
      if (newStates.size !== states.size ||
        Array.from(newStates.entries()).some(([key, val]) => {
          const oldVal = states.get(key);
          return !oldVal || JSON.stringify(oldVal) !== JSON.stringify(val);
        })) {
        this.verificationStates.set(newStates);
      }
    });
  }

  /**
   * Compute validation errors for all downloads
   */
  readonly computedValidationErrors = computed(() => {
    const errors: string[] = [];
    const currentDownloads = this.downloads();
    const states = this.verificationStates();

    currentDownloads.forEach((download, index) => {
      if (!download.file_url || !download.file_url.trim()) {
        return; // Skip validation for empty URLs
      }

      const state = states.get(index);
      if (!state || !state.verified) {
        errors.push(
          `Download #${index + 1}: URL "${download.file_name || 'unnamed'}" must be verified before submission`,
        );
      }
    });

    return errors;
  });

  toggleExpanded(): void {
    this.isExpanded.set(!this.isExpanded());
  }

  addDownload(): void {
    const currentDownloads = this.downloads() || [];
    this.downloadsChange.emit([...currentDownloads, createEmptyDownloadRecord()]);
  }

  updateDownload(index: number, field: keyof DownloadRecord, value: string | null): void {
    const currentDownloads = this.downloads();
    if (!currentDownloads) return;

    const updatedDownloads = [...currentDownloads];
    updatedDownloads[index] = {
      ...updatedDownloads[index],
      [field]: value || '',
    };

    this.downloadsChange.emit(updatedDownloads);
    // Note: URL verification invalidation is handled by the effect that watches downloads
  }

  removeDownload(index: number): void {
    const currentDownloads = this.downloads();
    if (!currentDownloads) return;

    // Remove verification state for this index
    const states = new Map(this.verificationStates());
    states.delete(index);
    // Reindex remaining states
    const reindexed = new Map<number, DownloadVerificationState>();
    states.forEach((state, oldIndex) => {
      if (oldIndex > index) {
        reindexed.set(oldIndex - 1, state);
      } else {
        reindexed.set(oldIndex, state);
      }
    });
    this.verificationStates.set(reindexed);

    this.downloadsChange.emit(currentDownloads.filter((_, i) => i !== index));
    // Note: validation errors are emitted automatically via effect
  }

  /**
   * Verify a download URL
   */
  verifyUrl(index: number): void {
    const currentDownloads = this.downloads();
    if (!currentDownloads || !currentDownloads[index]) return;

    const download = currentDownloads[index];
    const url = download.file_url;

    if (!url || !url.trim()) {
      this.updateVerificationState(index, {
        verified: false,
        verifying: false,
        error: 'URL is required',
      });
      return;
    }

    // Set verifying state
    this.updateVerificationState(index, {
      verified: false,
      verifying: true,
      error: undefined,
    });

    // Perform verification
    this.urlVerificationService.verifyUrl(url).subscribe({
      next: (result: UrlVerificationResult) => {
        if (result.success) {
          const currentState = this.getVerificationState(index);
          const originalSha256 = currentState.originalSha256sum;
          const verifiedSha256 = result.sha256sum;

          // Check for mismatch between original and verified SHA256
          let hasMismatch = false;
          if (originalSha256 && verifiedSha256 && originalSha256 !== verifiedSha256) {
            hasMismatch = true;
          }

          // Update download with SHA256 if available
          if (verifiedSha256) {
            const updatedDownloads = [...currentDownloads];
            updatedDownloads[index] = {
              ...updatedDownloads[index],
              sha256sum: verifiedSha256,
            };
            this.downloadsChange.emit(updatedDownloads);
          }

          this.updateVerificationState(index, {
            verified: true,
            verifying: false,
            error: undefined,
            originalSha256sum: originalSha256,
            verifiedSha256sum: verifiedSha256,
            hasMismatch,
            verifiedUrl: url,
          });
        } else {
          this.updateVerificationState(index, {
            verified: false,
            verifying: false,
            error: result.error || 'Verification failed',
          });
        }
        // Note: validation errors are emitted automatically via effect
      },
      error: () => {
        this.updateVerificationState(index, {
          verified: false,
          verifying: false,
          error: 'Verification failed due to network error',
        });
        // Note: validation errors are emitted automatically via effect
      },
    });
  }

  /**
   * Get verification state for a download
   */
  getVerificationState(index: number): DownloadVerificationState {
    return (
      this.verificationStates().get(index) || {
        verified: false,
        verifying: false,
      }
    );
  }

  /**
   * Check if a download is verified
   */
  isVerified(index: number): boolean {
    return this.getVerificationState(index).verified;
  }

  /**
   * Check if a download is currently being verified
   */
  isVerifying(index: number): boolean {
    return this.getVerificationState(index).verifying;
  }

  /**
   * Get verification error for a download
   */
  getVerificationError(index: number): string | undefined {
    return this.getVerificationState(index).error;
  }

  /**
   * Check if there's a SHA256 mismatch between original and verified values
   */
  hasSha256Mismatch(index: number): boolean {
    return this.getVerificationState(index).hasMismatch || false;
  }

  /**
   * Get the mismatch warning message
   */
  getSha256MismatchWarning(index: number): string | undefined {
    const state = this.getVerificationState(index);
    if (state.hasMismatch && state.originalSha256sum && state.verifiedSha256sum) {
      return `SHA256 mismatch detected! Original: ${state.originalSha256sum.substring(0, 16)}... | Verified: ${state.verifiedSha256sum.substring(0, 16)}...`;
    }
    return undefined;
  }

  /**
   * Update verification state for a download
   */
  private updateVerificationState(index: number, state: DownloadVerificationState): void {
    const states = new Map(this.verificationStates());
    states.set(index, state);
    this.verificationStates.set(states);
    // Note: validation errors are emitted automatically via effect when verificationStates changes
  }
}
