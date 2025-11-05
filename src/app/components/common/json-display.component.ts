import { Component, Input, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-json-display',
  templateUrl: './json-display.component.html',
  styleUrls: ['./json-display.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
})
export class JsonDisplayComponent {
  @Input() data: unknown;
  @Input() indent = 2;

  /**
   * Converts the input data to a syntax-highlighted HTML string
   */
  getSyntaxHighlightedJson(): string {
    if (this.data === null || this.data === undefined) {
      return '';
    }

    const jsonString = JSON.stringify(this.data, null, this.indent);
    return this.highlightJson(jsonString);
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
