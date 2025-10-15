import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TagInputComponent } from '../../form-fields/tag-input/tag-input.component';
import { KeyValueEditorComponent } from '../../form-fields/key-value-editor/key-value-editor.component';

type SettingsValue = number | string | boolean | number[] | string[];

export interface TextGenerationFieldsData {
  parameters?: number | null;
  model_name?: string | null;
  baseline?: string | null;
  display_name?: string | null;
  url?: string | null;
  tags?: string[] | null;
  settings?: Record<string, SettingsValue> | null;
}

@Component({
  selector: 'app-text-generation-fields',
  imports: [FormsModule, TagInputComponent, KeyValueEditorComponent],
  templateUrl: './text-generation-fields.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TextGenerationFieldsComponent {
  readonly data = input.required<TextGenerationFieldsData>();
  readonly dataChange = output<TextGenerationFieldsData>();

  updateField<K extends keyof TextGenerationFieldsData>(
    field: K,
    value: TextGenerationFieldsData[K],
  ): void {
    this.dataChange.emit({
      ...this.data(),
      [field]: value,
    });
  }

  onParametersChange(value: string): void {
    const numValue = parseInt(value, 10);
    this.updateField('parameters', isNaN(numValue) ? null : numValue);
  }

  onModelNameChange(value: string): void {
    this.updateField('model_name', value || null);
  }

  onBaselineChange(value: string): void {
    this.updateField('baseline', value || null);
  }

  onDisplayNameChange(value: string): void {
    this.updateField('display_name', value || null);
  }

  onUrlChange(value: string): void {
    this.updateField('url', value || null);
  }

  onTagsChange(values: string[]): void {
    this.updateField('tags', values.length > 0 ? values : null);
  }

  onSettingsChange(value: Record<string, SettingsValue>): void {
    this.updateField('settings', Object.keys(value).length > 0 ? value : null);
  }
}
