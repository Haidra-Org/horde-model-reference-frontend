import { Component, input, output, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LegacyConfig, LegacyConfigFile, LegacyConfigDownload } from '../../../models/api.models';

@Component({
  selector: 'app-config-form-section',
  imports: [FormsModule],
  templateUrl: './config-form-section.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfigFormSectionComponent {
  readonly config = input<LegacyConfig | null>(null);
  readonly configChange = output<LegacyConfig | null>();

  readonly isExpanded = signal(true);

  toggleExpanded(): void {
    this.isExpanded.set(!this.isExpanded());
  }

  addFile(): void {
    const currentConfig = this.config() || { files: [], download: [] };
    const newFile: LegacyConfigFile = {
      path: '',
      md5sum: null,
      sha256sum: null,
      file_type: null,
    };

    this.configChange.emit({
      ...currentConfig,
      files: [...(currentConfig.files || []), newFile],
    });
  }

  updateFile(index: number, field: keyof LegacyConfigFile, value: string | null): void {
    const currentConfig = this.config();
    if (!currentConfig || !currentConfig.files) return;

    const updatedFiles = [...currentConfig.files];
    updatedFiles[index] = {
      ...updatedFiles[index],
      [field]: value || null,
    };

    this.configChange.emit({
      ...currentConfig,
      files: updatedFiles,
    });
  }

  removeFile(index: number): void {
    const currentConfig = this.config();
    if (!currentConfig || !currentConfig.files) return;

    this.configChange.emit({
      ...currentConfig,
      files: currentConfig.files.filter((_, i) => i !== index),
    });
  }

  addDownload(): void {
    const currentConfig = this.config() || { files: [], download: [] };
    const newDownload: LegacyConfigDownload = {
      file_name: null,
      file_path: null,
      file_url: null,
    };

    this.configChange.emit({
      ...currentConfig,
      download: [...(currentConfig.download || []), newDownload],
    });
  }

  updateDownload(index: number, field: keyof LegacyConfigDownload, value: string | null): void {
    const currentConfig = this.config();
    if (!currentConfig || !currentConfig.download) return;

    const updatedDownloads = [...currentConfig.download];
    updatedDownloads[index] = {
      ...updatedDownloads[index],
      [field]: value || null,
    };

    this.configChange.emit({
      ...currentConfig,
      download: updatedDownloads,
    });
  }

  removeDownload(index: number): void {
    const currentConfig = this.config();
    if (!currentConfig || !currentConfig.download) return;

    this.configChange.emit({
      ...currentConfig,
      download: currentConfig.download.filter((_, i) => i !== index),
    });
  }
}
