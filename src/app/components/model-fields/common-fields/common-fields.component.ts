import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TagInputComponent } from '../../form-fields/tag-input/tag-input.component';

export interface CommonFieldsData {
  description?: string | null;
  type?: string | null;
  version?: string | null;
  style?: string | null;
  nsfw?: boolean | null;
  download_all?: boolean | null;
  available?: boolean | null;
  features_not_supported?: string[] | null;
}

@Component({
  selector: 'app-common-fields',
  imports: [FormsModule, TagInputComponent],
  templateUrl: './common-fields.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommonFieldsComponent {
  readonly data = input.required<CommonFieldsData>();
  readonly dataChange = output<CommonFieldsData>();

  updateField<K extends keyof CommonFieldsData>(field: K, value: CommonFieldsData[K]): void {
    this.dataChange.emit({
      ...this.data(),
      [field]: value,
    });
  }

  onDescriptionChange(value: string): void {
    this.updateField('description', value || null);
  }

  onTypeChange(value: string): void {
    this.updateField('type', value || null);
  }

  onVersionChange(value: string): void {
    this.updateField('version', value || null);
  }

  onStyleChange(value: string): void {
    this.updateField('style', value || null);
  }

  onNsfwChange(value: string): void {
    if (value === 'null') {
      this.updateField('nsfw', null);
    } else {
      this.updateField('nsfw', value === 'true');
    }
  }

  onDownloadAllChange(value: string): void {
    if (value === 'null') {
      this.updateField('download_all', null);
    } else {
      this.updateField('download_all', value === 'true');
    }
  }

  onAvailableChange(value: string): void {
    if (value === 'null') {
      this.updateField('available', null);
    } else {
      this.updateField('available', value === 'true');
    }
  }

  onFeaturesNotSupportedChange(values: string[]): void {
    this.updateField('features_not_supported', values.length > 0 ? values : null);
  }

  getNsfwValue(): string {
    const nsfw = this.data().nsfw;
    if (nsfw === null || nsfw === undefined) return 'null';
    return nsfw ? 'true' : 'false';
  }

  getDownloadAllValue(): string {
    const downloadAll = this.data().download_all;
    if (downloadAll === null || downloadAll === undefined) return 'null';
    return downloadAll ? 'true' : 'false';
  }

  getAvailableValue(): string {
    const available = this.data().available;
    if (available === null || available === undefined) return 'null';
    return available ? 'true' : 'false';
  }
}
