import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { JsonBlockComponent } from './json-block.component';
import type { BrowseModel } from '../../services/browse-models.service';

@Component({
  selector: 'app-raw-json-tab',
  imports: [JsonBlockComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ` <app-json-block [json]="canonicalJson()" [title]="'Canonical record'" /> `,
})
export class RawJsonTabComponent {
  readonly model = input.required<BrowseModel>();

  protected readonly canonicalJson = computed(() => {
    const raw = this.model()._raw;
    if (!raw) return '{}';
    try {
      return JSON.stringify(raw, null, 2);
    } catch {
      return '{}';
    }
  });
}
