import { Component, input, output, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';

type ValueType = number | string | boolean | number[] | string[];

interface KeyValuePair {
  key: string;
  value: ValueType;
  valueType: 'string' | 'number' | 'boolean' | 'array';
}

@Component({
  selector: 'app-key-value-editor',
  imports: [FormsModule],
  templateUrl: './key-value-editor.component.html',
  styleUrl: './key-value-editor.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KeyValueEditorComponent {
  readonly label = input<string>('');
  readonly values = input<Record<string, ValueType>>({});
  readonly valuesChange = output<Record<string, ValueType>>();

  readonly pairs = signal<KeyValuePair[]>([]);
  readonly newKey = signal('');
  readonly newValue = signal('');
  readonly newValueType = signal<'string' | 'number' | 'boolean' | 'array'>('string');

  ngOnInit(): void {
    this.updatePairsFromValues();
  }

  ngOnChanges(): void {
    this.updatePairsFromValues();
  }

  private updatePairsFromValues(): void {
    const record = this.values();
    const pairs: KeyValuePair[] = Object.entries(record).map(([key, value]) => ({
      key,
      value,
      valueType: this.detectValueType(value),
    }));
    this.pairs.set(pairs);
  }

  private detectValueType(value: ValueType): 'string' | 'number' | 'boolean' | 'array' {
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'number') return 'number';
    return 'string';
  }

  addPair(): void {
    const key = this.newKey().trim();
    const valueStr = this.newValue().trim();

    if (!key || !valueStr) return;

    let value: ValueType;
    const valueType = this.newValueType();

    try {
      switch (valueType) {
        case 'number':
          value = parseFloat(valueStr);
          if (isNaN(value)) return;
          break;
        case 'boolean':
          value = valueStr.toLowerCase() === 'true';
          break;
        case 'array':
          value = JSON.parse(valueStr);
          if (!Array.isArray(value)) return;
          break;
        default:
          value = valueStr;
      }

      const updated = { ...this.values(), [key]: value };
      this.valuesChange.emit(updated);
      this.newKey.set('');
      this.newValue.set('');
    } catch (error) {
      return;
    }
  }

  removePair(key: string): void {
    const updated = { ...this.values() };
    delete updated[key];
    this.valuesChange.emit(updated);
  }

  updatePair(
    oldKey: string,
    newKey: string,
    newValue: string,
    valueType: 'string' | 'number' | 'boolean' | 'array',
  ): void {
    let value: ValueType;

    try {
      switch (valueType) {
        case 'number':
          value = parseFloat(newValue);
          if (isNaN(value)) return;
          break;
        case 'boolean':
          value = newValue.toLowerCase() === 'true';
          break;
        case 'array':
          value = JSON.parse(newValue);
          if (!Array.isArray(value)) return;
          break;
        default:
          value = newValue;
      }

      const updated = { ...this.values() };
      if (oldKey !== newKey) {
        delete updated[oldKey];
      }
      updated[newKey] = value;
      this.valuesChange.emit(updated);
    } catch (error) {
      return;
    }
  }

  getValueAsString(value: ValueType): string {
    if (Array.isArray(value)) {
      return JSON.stringify(value);
    }
    return String(value);
  }
}
