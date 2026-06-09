import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { WriteFormDownload } from '../../utils/write-record';

@Component({
  selector: 'app-wizard-step-files',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="write-step-fields">
      @for (d of downloads(); track i; let i = $index) {
        <div class="download-card">
          <div class="download-card-header">
            <span class="download-card-title">File {{ i + 1 }}</span>
            @if (downloads().length > 1) {
              <button
                type="button"
                class="btn btn-ghost btn-sm"
                (click)="removeFile(i)"
                aria-label="Remove file {{ i + 1 }}"
              >
                <svg
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  style="width:13px;height:13px"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            }
          </div>
          <div class="download-card-fields">
            <input
              type="text"
              class="form-input"
              placeholder="file_name.safetensors"
              [value]="d.file_name"
              (input)="onDlChange(i, 'file_name', $event)"
            />
            <input
              type="text"
              class="form-input"
              placeholder="https://huggingface.co/…"
              [value]="d.file_url"
              (input)="onDlChange(i, 'file_url', $event)"
            />
            <input
              type="text"
              class="form-input mono"
              placeholder="sha256sum"
              [value]="d.sha256sum"
              (input)="onDlChange(i, 'sha256sum', $event)"
            />
            <label class="write-toggle">
              <input
                type="checkbox"
                class="form-checkbox"
                [checked]="d.known_slow_download"
                (change)="onDlCheckChange(i, 'known_slow_download', $event)"
              />
              <span class="checkbox-label">Known slow download host</span>
            </label>
          </div>
        </div>
      }

      <button type="button" class="btn btn-ghost" (click)="addFile()">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width:15px;height:15px">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 4v16m8-8H4"
          />
        </svg>
        Add file
      </button>
    </div>
  `,
})
export class WizardStepFilesComponent {
  readonly downloads = input.required<WriteFormDownload[]>();
  readonly downloadsChange = output<WriteFormDownload[]>();

  onDlChange(index: number, field: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const updated = this.downloads().map((d, j) =>
      j === index ? { ...d, [field]: input.value } : d,
    );
    this.downloadsChange.emit(updated);
  }

  onDlCheckChange(index: number, field: string, event: Event): void {
    const checkbox = event.target as HTMLInputElement;
    const updated = this.downloads().map((d, j) =>
      j === index ? { ...d, [field]: checkbox.checked } : d,
    );
    this.downloadsChange.emit(updated);
  }

  addFile(): void {
    this.downloadsChange.emit([
      ...this.downloads(),
      { file_name: '', file_url: '', sha256sum: '', known_slow_download: false },
    ]);
  }

  removeFile(index: number): void {
    if (this.downloads().length <= 1) return;
    this.downloadsChange.emit(this.downloads().filter((_, j) => j !== index));
  }
}
