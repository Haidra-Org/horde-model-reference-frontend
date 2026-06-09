import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CopyButtonComponent } from '../common/copy-button/copy-button.component';

@Component({
  selector: 'app-json-block',
  imports: [CopyButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="glass-inflow json-block" style="overflow:hidden;padding:0">
      <div class="json-block-header">
        <span class="json-block-title">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
            />
          </svg>
          {{ title() || 'Canonical record' }}
        </span>
        <app-copy-button [text]="json()" label="Copy JSON" [ariaLabel]="'Copy JSON'" />
      </div>
      <pre class="json-block-body mono"><code>{{ json() }}</code></pre>
    </div>
  `,
})
export class JsonBlockComponent {
  readonly json = input.required<string>();
  readonly title = input<string>();
}
