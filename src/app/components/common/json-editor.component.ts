import {
  Component,
  input,
  ChangeDetectionStrategy,
  signal,
  effect,
  forwardRef,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-json-editor',
  templateUrl: './json-editor.component.html',
  styleUrls: ['./json-editor.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => JsonEditorComponent),
      multi: true,
    },
  ],
})
export class JsonEditorComponent implements ControlValueAccessor {
  readonly placeholder = input<string>('');
  readonly rows = input<number>(20);
  readonly readonly = input<boolean>(false);

  private onChange: (value: string) => void = (value) => {
    void value;
  };
  private onTouched: () => void = () => {
    return;
  };

  readonly editorValue = signal('');
  readonly componentDisabled = signal(false);
  readonly highlightedHtml = signal<string>('');

  constructor() {
    effect(() => {
      const currentValue = this.editorValue();
      this.updateHighlighting(currentValue);
    });
  }

  onInput(event: Event): void {
    if (this.componentDisabled()) {
      return;
    }
    const target = event.target as HTMLTextAreaElement;
    const text = target.value;
    this.editorValue.set(text);
    this.onChange(text);
  }

  onBlur(): void {
    this.onTouched();
  }

  writeValue(value: string | null): void {
    this.editorValue.set(value ?? '');
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.componentDisabled.set(isDisabled);
  }

  private updateHighlighting(jsonString: string): void {
    if (!jsonString || jsonString.trim() === '') {
      this.highlightedHtml.set('');
      return;
    }

    // Highlight as-is without reformatting to preserve user input
    this.highlightedHtml.set(this.highlightJson(jsonString));
  }

  /**
   * Applies syntax highlighting to JSON string
   */
  private highlightJson(json: string): string {
    // Replace special characters with HTML entities
    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Highlight different JSON elements
    return json
      .replace(
        /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?)/g,
        (match: string, p1: string, p2: string, p3: string) => {
          let cls = 'json-string';
          if (p3) {
            cls = 'json-key';
          }
          return `<span class="${cls}">${match}</span>`;
        },
      )
      .replace(/\b(true|false)\b/g, '<span class="json-boolean">$1</span>')
      .replace(/\b(null)\b/g, '<span class="json-null">$1</span>')
      .replace(/\b(-?\d+\.?\d*)\b/g, '<span class="json-number">$1</span>');
  }
}
