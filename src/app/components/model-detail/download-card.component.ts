import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CopyButtonComponent } from '../common/copy-button/copy-button.component';
import { IconComponent } from '../common/icon.component';

/**
 * A single download entry card.
 * Shows file name, host, SHA-256 checksum with copy button, and slow/unknown-host badges.
 */
@Component({
  selector: 'app-download-card',
  imports: [CopyButtonComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="glass-inflow download-card" style="background:var(--color-glass-surface-nested)">
      <div class="download-card-top">
        <div class="download-card-file">
          <span class="download-card-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
          </span>
          <div class="download-card-fileinfo">
            <span class="download-card-filename mono">{{ d().file_name }}</span>
            <span class="download-card-host">{{ host() }}</span>
          </div>
        </div>
        @if (d().known_slow_download) {
          <span class="badge badge-warning badge-sm" title="Known slow download host">
            <app-icon name="clock" />Slow host
          </span>
        }
        @if (unknownHost()) {
          <span class="badge badge-warning badge-sm" title="Unknown or unparseable host">
            Unknown host
          </span>
        }
        @if (nonPreferredHost()) {
          <span class="badge badge-gray badge-sm" title="Non-preferred file host">
            Non-preferred
          </span>
        }
      </div>

      @if (d().sha256sum) {
        <div class="download-card-checksum">
          <span class="download-card-checksum-label kbd">sha256</span>
          <span class="download-card-checksum-hash mono">{{ d().sha256sum }}</span>
          <app-copy-button [text]="d().sha256sum ?? ''" [ariaLabel]="'Copy SHA-256 checksum'" />
        </div>
      }
    </div>
  `,
})
export class DownloadCardComponent {
  /** A download entry from the model's config.download[] */
  readonly d = input.required<ModelDownloadEntry>();

  protected readonly host = () => {
    const url = this.d().file_url;
    if (!url) return 'Unknown host';
    try {
      return new URL(url).hostname;
    } catch {
      return 'Unknown host';
    }
  };

  protected readonly unknownHost = () => {
    const url = this.d().file_url;
    if (!url) return true;
    try {
      new URL(url);
      return false;
    } catch {
      return true;
    }
  };

  protected readonly nonPreferredHost = () => {
    const h = this.host();
    return h !== 'Unknown host' && !h.includes('huggingface.co');
  };
}

/** Loose shape for a download entry. Matches the config.download[] items. */
export interface ModelDownloadEntry {
  file_name?: string | null;
  file_url?: string | null;
  file_path?: string | null;
  sha256sum?: string | null;
  known_slow_download?: boolean | null;
  [key: string]: unknown;
}
