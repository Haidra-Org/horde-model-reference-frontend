import { Component, inject, input, output, signal, ChangeDetectionStrategy, OnInit, OnChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NotificationService } from '../../../services/notification.service';

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
export class KeyValueEditorComponent implements OnInit, OnChanges {
  readonly label = input<string>('');
  readonly values = input<Record<string, ValueType>>({});
  readonly valuesChange = output<Record<string, ValueType>>();

  private readonly notification = inject(NotificationService);

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

  private parseValue(
    valueStr: string,
    valueType: 'string' | 'number' | 'boolean' | 'array',
  ): { success: true; value: ValueType } | { success: false; error: string } {
    switch (valueType) {
      case 'number': {
        const num = parseFloat(valueStr);
        if (isNaN(num)) {
          return { success: false, error: `Invalid number: "${valueStr}"` };
        }
        return { success: true, value: num };
      }
      case 'boolean':
        // preserve existing behaviour: any non-"true" value becomes false
        return { success: true, value: valueStr.toLowerCase() === 'true' };
      case 'array':
        try {
          const parsed = JSON.parse(valueStr);
          if (!Array.isArray(parsed)) {
            return { success: false, error: 'Parsed value is not an array' };
          }
          return { success: true, value: parsed as ValueType };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return { success: false, error: `Invalid JSON: ${message}` };
        }
      default:
        return { success: true, value: valueStr };
    }
  }

  addPair(): void {
    const key = this.newKey().trim();
    const valueStr = this.newValue().trim();

    if (!key || !valueStr) {
      this.notification.error('Key and value are required.');
      return;
    }

    const valueType = this.newValueType();
    const parsed = this.parseValue(valueStr, valueType);
    if (!parsed.success) {
      this.notification.error(parsed.error);
      console.error(parsed.error);
      return;
    }

    const value = parsed.value;
    const updated = { ...this.values(), [key]: value };
    this.valuesChange.emit(updated);
    this.newKey.set('');
    this.newValue.set('');
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
    const parsed = this.parseValue(newValue, valueType);
    if (!parsed.success) {
      this.notification.error(parsed.error);
      console.error(parsed.error);
      return;
    }

    const value = parsed.value;

    const updated = { ...this.values() };
    if (oldKey !== newKey) {
      delete updated[oldKey];
    }
    updated[newKey] = value;
    this.valuesChange.emit(updated);
  }

  getValueAsString(value: ValueType): string {
    if (Array.isArray(value)) {
      return JSON.stringify(value);
    }
    return String(value);
  }
}
