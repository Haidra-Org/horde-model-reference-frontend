import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TagInputComponent } from '../../form-fields/tag-input/tag-input.component';
import { KeyValueEditorComponent } from '../../form-fields/key-value-editor/key-value-editor.component';

type RequirementsValue = number | string | boolean | number[] | string[];

export interface StableDiffusionFieldsData {
  inpainting: boolean;
  baseline: string;
  tags?: string[] | null;
  showcases?: string[] | null;
  min_bridge_version?: number | null;
  trigger?: string[] | null;
  homepage?: string | null;
  size_on_disk_bytes?: number | null;
  optimization?: string | null;
  requirements?: Record<string, RequirementsValue> | null;
}

@Component({
  selector: 'app-stable-diffusion-fields',
  imports: [FormsModule, TagInputComponent, KeyValueEditorComponent],
  templateUrl: './stable-diffusion-fields.component.html',
  styleUrl: './stable-diffusion-fields.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StableDiffusionFieldsComponent {
  readonly data = input.required<StableDiffusionFieldsData>();
  readonly dataChange = output<StableDiffusionFieldsData>();

  readonly baselineOptions = [
    { value: 'stable_diffusion_1', label: 'Stable Diffusion 1' },
    { value: 'stable_diffusion_2_768', label: 'Stable Diffusion 2 (768)' },
    { value: 'stable_diffusion_2_512', label: 'Stable Diffusion 2 (512)' },
    { value: 'stable_diffusion_xl', label: 'Stable Diffusion XL' },
    { value: 'stable_cascade', label: 'Stable Cascade' },
  ];

  updateField<K extends keyof StableDiffusionFieldsData>(
    field: K,
    value: StableDiffusionFieldsData[K],
  ): void {
    this.dataChange.emit({
      ...this.data(),
      [field]: value,
    });
  }

  onInpaintingChange(value: boolean): void {
    this.updateField('inpainting', value);
  }

  onBaselineChange(value: string): void {
    this.updateField('baseline', value);
  }

  onTagsChange(values: string[]): void {
    this.updateField('tags', values.length > 0 ? values : null);
  }

  onShowcasesChange(values: string[]): void {
    this.updateField('showcases', values.length > 0 ? values : null);
  }

  onTriggerChange(values: string[]): void {
    this.updateField('trigger', values.length > 0 ? values : null);
  }

  onMinBridgeVersionChange(value: string): void {
    const numValue = parseFloat(value);
    this.updateField('min_bridge_version', isNaN(numValue) ? null : numValue);
  }

  onHomepageChange(value: string): void {
    this.updateField('homepage', value || null);
  }

  onSizeOnDiskBytesChange(value: string): void {
    const numValue = parseInt(value, 10);
    this.updateField('size_on_disk_bytes', isNaN(numValue) ? null : numValue);
  }

  onOptimizationChange(value: string): void {
    this.updateField('optimization', value || null);
  }

  onRequirementsChange(value: Record<string, RequirementsValue>): void {
    this.updateField('requirements', Object.keys(value).length > 0 ? value : null);
  }
}
