import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DownloadCardComponent, ModelDownloadEntry } from './download-card.component';
import type { BrowseModel } from '../../services/browse-models.service';

@Component({
  selector: 'app-files-tab',
  imports: [DownloadCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div style="display:flex;flex-direction:column;gap:12px">
      @if (downloads().length) {
        @for (d of downloads(); track d.file_name ?? $index) {
          <app-download-card [d]="d" />
        }
      } @else {
        <div class="glass-inflow" style="padding:40px;text-align:center">
          <p style="font-size:15px;font-weight:600;color:var(--color-content-secondary)">
            No downloads configured
          </p>
        </div>
      }
    </div>
  `,
})
export class FilesTabComponent {
  readonly model = input.required<BrowseModel>();

  protected readonly downloads = computed<ModelDownloadEntry[]>(() => {
    const raw = this.model()._raw as Record<string, unknown> | undefined;
    const config = raw?.['config'] as { download?: ModelDownloadEntry[] } | undefined;
    return config?.download ?? [];
  });
}
