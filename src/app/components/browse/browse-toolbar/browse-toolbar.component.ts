import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../../common/icon.component';
import {
  SegmentedControlComponent,
  SegmentedOption,
} from '../../../../shared/design-system/components/segmented-control/segmented-control.component';
import type { SortKey, ViewMode } from '../../../services/browse-models.service';

@Component({
  selector: 'app-browse-toolbar',
  imports: [FormsModule, IconComponent, SegmentedControlComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="glass-inflow"
      style="padding:14px;margin-bottom:16px;display:flex;flex-direction:column;gap:12px"
    >
      <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
        <!-- Search -->
        <div style="position:relative;flex:1;min-width:240px">
          <app-icon
            name="search"
            style="position:absolute;left:12px;top:10px;color:var(--color-content-muted)"
          />
          <input
            class="form-input"
            style="padding-left:34px;width:100%"
            [placeholder]="'Search ' + placeholderCategory() + '…'"
            [ngModel]="searchQuery()"
            (ngModelChange)="onSearch($event)"
          />
        </div>

        <!-- Sort -->
        <app-segmented-control
          size="sm"
          [options]="sortOptions()"
          [value]="sortKey()"
          (valueChange)="sortKeyChange.emit($any($event))"
          ariaLabel="Sort models"
        />

        <!-- Layout -->
        <app-segmented-control
          size="sm"
          [options]="layoutOptions()"
          [value]="viewMode()"
          (valueChange)="viewModeChange.emit($any($event))"
          ariaLabel="View layout"
        />
      </div>
    </div>
  `,
})
export class BrowseToolbarComponent {
  readonly searchQuery = input.required<string>();
  readonly searchQueryChange = output<string>();
  readonly sortKey = input.required<SortKey>();
  readonly sortKeyChange = output<SortKey>();
  readonly viewMode = input.required<ViewMode>();
  readonly viewModeChange = output<ViewMode>();
  readonly isImageDomain = input(false);
  readonly resultCount = input(0);
  readonly placeholderCategory = input('models');

  readonly sortOptions = input.required<SegmentedOption[]>();
  readonly layoutOptions = input.required<SegmentedOption[]>();

  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  protected onSearch(value: string): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.searchQueryChange.emit(value);
    }, 150);
  }
}
