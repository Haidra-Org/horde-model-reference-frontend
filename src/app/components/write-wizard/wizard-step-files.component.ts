import { ClearableFieldComponent } from '../form-fields/clearable-field/clearable-field.component';
import { WizardFieldGroupComponent } from './wizard-field-group.component';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { AutocompleteInputComponent } from '../form-fields/autocomplete-input/autocomplete-input.component';
import { KeyValueEditorComponent } from '../form-fields/key-value-editor/key-value-editor.component';
import type { WriteFormDownload } from '../../utils/write-record';

@Component({
  selector: 'app-wizard-step-files',
  imports: [
    ClearableFieldComponent,
    WizardFieldGroupComponent,
    KeyValueEditorComponent,
    AutocompleteInputComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="write-step-fields">
      <header class="write-step-intro">
        <h2>Model files</h2>
        <p>Add each downloadable file, then identify any shared components.</p>
      </header>
      @for (d of downloads(); track i; let i = $index) {
        <div class="download-card">
          <div class="download-card-header">
            <span class="download-card-title">File {{ i + 1 }}</span>
            <button
              type="button"
              class="write-section-clear"
              (click)="clearDownload(i)"
              [attr.aria-label]="'Clear file ' + (i + 1)"
            >
              Clear file
            </button>
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
            <app-clearable-field
              label="File name"
              [filled]="!!d.file_name"
              width="standard"
              (cleared)="clearDownloadFields(i, ['file_name'])"
              ><label class="form-label"
                >File name <span class="write-required-mark" aria-hidden="true">Required</span
                ><input
                  aria-required="true"
                  type="text"
                  class="form-input"
                  placeholder="file_name.safetensors"
                  [value]="d.file_name"
                  (input)="onDlChange(i, 'file_name', $event)" /></label
            ></app-clearable-field>
            <app-clearable-field
              label="File URL"
              [filled]="!!d.file_url"
              width="url"
              (cleared)="clearDownloadFields(i, ['file_url'])"
              ><label class="form-label"
                >File URL <span class="write-required-mark" aria-hidden="true">Required</span
                ><input
                  aria-required="true"
                  type="url"
                  class="form-input write-input-url"
                  placeholder="https://huggingface.co/…"
                  [value]="d.file_url"
                  (input)="onDlChange(i, 'file_url', $event)" /></label
            ></app-clearable-field>
            <app-clearable-field
              label="SHA256"
              [filled]="!!d.sha256sum"
              width="wide"
              (cleared)="clearDownloadFields(i, ['sha256sum'])"
              ><label class="form-label"
                >SHA256 <span class="write-label-note">Whole-file checksum</span
                ><input
                  type="text"
                  class="form-input mono write-input-hash"
                  placeholder="sha256sum"
                  [value]="d.sha256sum"
                  (input)="onDlChange(i, 'sha256sum', $event)" /></label
            ></app-clearable-field>
            <div class="write-field-role">
              <app-clearable-field
                label="File type / purpose"
                [filled]="!!d.file_purpose"
                width="short"
                (cleared)="updatePurpose(i, null)"
                ><app-autocomplete-input
                  label="File type / purpose"
                  [value]="d.file_purpose || ''"
                  [suggestions]="filePurposes"
                  placeholder="Primary file (default)"
                  (valueChange)="updatePurpose(i, $event)"
              /></app-clearable-field>
              <span class="form-hint"
                >Leave empty for the primary file. Component roles determine placement.</span
              >
            </div>
            <app-wizard-field-group
              title="Additional file metadata"
              [clearable]="true"
              (cleared)="
                clearDownloadFields(i, ['content_hash', 'size_bytes', 'known_slow_download'])
              "
              icon="doc"
              [optional]="true"
            >
              <app-clearable-field
                label="Component content hash"
                [filled]="!!d.content_hash"
                width="wide"
                (cleared)="clearDownloadFields(i, ['content_hash'])"
                ><label class="form-label">
                  Component content hash
                  <input
                    class="form-input mono write-input-hash"
                    type="text"
                    [value]="d.content_hash || ''"
                    (input)="onDlChange(i, 'content_hash', $event)"
                  />
                  <span class="form-hint"
                    >Tensor content hash, distinct from the whole-file SHA256. Leave empty if
                    unknown.</span
                  >
                </label></app-clearable-field
              >
              <app-clearable-field
                label="File size (bytes)"
                [filled]="!!d.size_bytes"
                width="short"
                (cleared)="clearDownloadFields(i, ['size_bytes'])"
                ><label class="form-label">
                  File size (bytes)
                  <input
                    class="form-input"
                    type="number"
                    min="0"
                    step="1"
                    [value]="d.size_bytes || ''"
                    (input)="onDlChange(i, 'size_bytes', $event)"
                  /> </label
              ></app-clearable-field>
              <label class="write-toggle">
                <input
                  type="checkbox"
                  class="form-checkbox"
                  [checked]="d.known_slow_download"
                  (change)="onDlCheckChange(i, 'known_slow_download', $event)"
                />
                <span class="checkbox-label">Known slow download host</span>
              </label>
            </app-wizard-field-group>
          </div>
        </div>
      }

      <app-wizard-field-group
        title="Embedded components"
        [clearable]="true"
        (cleared)="embeddedHashesEditor.clearAll()"
        icon="layers"
        description="For monolithic checkpoints that contain shareable VAE or text-encoder weights."
        [optional]="true"
      >
        <app-key-value-editor
          #embeddedHashesEditor
          label="Embedded component hashes (monolithic checkpoints only)"
          addLabel="Add component hash"
          keyPlaceholder="vae or text_encoders"
          [values]="embeddedHashes()"
          (valuesChange)="updateEmbeddedHashes($event)"
      /></app-wizard-field-group>

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
  readonly filePurposes = ['unet', 'vae', 'text_encoders'];
  updatePurpose(index: number, value: string | null): void {
    this.downloadsChange.emit(
      this.downloads().map((download, i) =>
        i === index ? { ...download, file_purpose: value ?? '' } : download,
      ),
    );
  }
  clearDownloadFields(index: number, fields: readonly (keyof WriteFormDownload)[]): void {
    const cleared = Object.fromEntries(
      fields.map((field) => [field, field === 'known_slow_download' ? false : '']),
    );
    this.downloadsChange.emit(
      this.downloads().map((download, i) => (i === index ? { ...download, ...cleared } : download)),
    );
  }
  clearDownload(index: number): void {
    this.clearDownloadFields(index, [
      'file_name',
      'file_url',
      'sha256sum',
      'file_purpose',
      'content_hash',
      'size_bytes',
      'known_slow_download',
    ]);
  }
  readonly downloads = input.required<WriteFormDownload[]>();
  readonly embeddedHashes = input<Record<string, string>>({});
  readonly embeddedHashesChange = output<Record<string, string>>();
  updateEmbeddedHashes(values: Record<string, unknown>): void {
    this.embeddedHashesChange.emit(
      Object.fromEntries(Object.entries(values).map(([key, value]) => [key, String(value)])),
    );
  }
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
