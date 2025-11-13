import { Component, input, output, ChangeDetectionStrategy, computed } from '@angular/core';

export interface StatColumn {
  header: string;
  align?: 'left' | 'right' | 'center';
  class?: string;
}

export interface StatRow {
  cells: StatCell[];
}

export interface StatCell {
  value: string | number;
  /** CSS class(es) to wrap the value in a <span>. Use 'badge badge-info' for semantic badges, or custom classes like 'pc-badge pc-1' */
  wrapperClass?: string;
  /** CSS class(es) applied directly to the <td> element */
  class?: string;
  colspan?: number;
  /** The original unformatted value to use when clicking (e.g., actual baseline ID vs display name) */
  originalValue?: string | number;
}

// Builder types for simpler API
export interface CountValuePair {
  count: number;
  value: string | number;
  /** CSS class(es) to wrap the value. Use 'badge badge-info' for badges or custom classes */
  wrapperClass?: string;
}

export interface CountValueDescriptionTriple {
  count: number;
  value: string | number;
  /** CSS class(es) to wrap the value. Use 'badge badge-info' for badges or custom classes */
  wrapperClass?: string;
  description?: string;
  /** The original unformatted value to use when clicking (e.g., actual baseline ID vs display name) */
  originalValue?: string | number;
}

/** Three-column builder for: Count | Styled Value (with custom wrapper) | Detail (right-aligned) */
export interface CountValueDetailTriple {
  count: number;
  value: string | number;
  /** CSS class(es) to wrap the value - computed per row! */
  wrapperClass?: string;
  detail: string | number;
  /** Optional: Include a final row with colspan (e.g., "Other" summary row) */
  isOtherRow?: boolean;
}

@Component({
  selector: 'app-stat-modal',
  imports: [],
  template: `
    @if (isOpen()) {
      <div
        class="modal-overlay"
        tabindex="0"
        (click)="closeModal.emit()"
        (keydown)="($event.key === 'Enter' || $event.key === ' ') && closeModal.emit()"
        aria-label="Close modal"
      >
        <div
          class="modal-dialog modal-dialog--lg"
          tabindex="0"
          (click)="$event.stopPropagation()"
          (keydown)="($event.key === 'Enter' || $event.key === ' ') && $event.stopPropagation()"
          aria-modal="true"
          role="dialog"
        >
          <h2 class="modal-title">{{ title() }}</h2>
          <div class="modal-content">
            <div class="stat-table-container">
              <table class="stat-table">
                <thead>
                  <tr>
                    @for (column of computedColumns(); track $index) {
                      <th [class]="'text-' + (column.align || 'left')">
                        {{ column.header }}
                      </th>
                    }
                  </tr>
                </thead>
                <tbody>
                  @for (row of computedRows(); track $index) {
                    <tr
                      class="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      tabindex="0"
                      (click)="onRowClick(row)"
                      (keydown)="($event.key === 'Enter' || $event.key === ' ') && onRowClick(row)"
                    >
                      @for (cell of row.cells; track $index) {
                        <td [attr.colspan]="cell.colspan || null" [class]="cell.class || ''">
                          @if (cell.wrapperClass) {
                            <span [class]="cell.wrapperClass">
                              {{ cell.value }}
                            </span>
                          } @else {
                            {{ cell.value }}
                          }
                        </td>
                      }
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
          <div class="modal-actions">
            <button class="btn btn-primary" (click)="closeModal.emit()">Close</button>
          </div>
        </div>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatModalComponent {
  readonly isOpen = input.required<boolean>();
  readonly title = input.required<string>();

  // Low-level API - for full control
  readonly columns = input<StatColumn[]>();
  readonly rows = input<StatRow[]>();

  // High-level builder API - for common patterns
  /** Simple two-column layout: Count | Value */
  readonly countValueData = input<CountValuePair[]>();
  /** Custom headers for two-column layout. Defaults to ['Count', 'Value'] */
  readonly countValueHeaders = input<[string, string]>();

  /** Three-column layout: Count | Value | Description */
  readonly countValueDescriptionData = input<CountValueDescriptionTriple[]>();
  /** Custom headers for three-column layout. Defaults to ['Count', 'Short Name', 'Full Name'] */
  readonly countValueDescriptionHeaders = input<[string, string, string]>();

  /** Three-column layout for styled values with details: Count | Styled Value | Detail (right-aligned) */
  readonly countValueDetailData = input<CountValueDetailTriple[]>();
  /** Custom headers for detail layout. Defaults to ['Count', 'Value', 'Detail'] */
  readonly countValueDetailHeaders = input<[string, string, string]>();

  readonly closeModal = output<void>();
  readonly rowClick = output<string | number>();

  onRowClick(row: StatRow): void {
    // Extract the actual value from the second cell (the value cell)
    // For CountValuePair, it's at index 1
    // For CountValueDescriptionTriple, it's also at index 1
    // For CountValueDetailTriple, it's also at index 1
    const valueCell = row.cells[1];
    if (valueCell) {
      // Use originalValue if available (e.g., for baseline IDs), otherwise use display value
      const valueToEmit = valueCell.originalValue ?? valueCell.value;
      if (typeof valueToEmit === 'string' || typeof valueToEmit === 'number') {
        this.rowClick.emit(valueToEmit);
      }
    }
  }

  readonly computedColumns = computed(() => {
    // If explicit columns provided, use them
    if (this.columns()) {
      return this.columns()!;
    }

    // Auto-generate columns based on builder data
    if (this.countValueDetailData()) {
      const headers = this.countValueDetailHeaders() || ['Count', 'Value', 'Detail'];
      return [
        { header: headers[0], align: 'left' as const },
        { header: headers[1], align: 'left' as const },
        { header: headers[2], align: 'right' as const },
      ];
    }

    if (this.countValueDescriptionData()) {
      const headers = this.countValueDescriptionHeaders() || ['Count', 'Short Name', 'Full Name'];
      return [
        { header: headers[0], align: 'left' as const },
        { header: headers[1], align: 'left' as const },
        { header: headers[2], align: 'left' as const },
      ];
    }

    if (this.countValueData()) {
      const headers = this.countValueHeaders() || ['Count', 'Value'];
      return [
        { header: headers[0], align: 'left' as const },
        { header: headers[1], align: 'left' as const },
      ];
    }

    return [];
  });

  readonly computedRows = computed(() => {
    // If explicit rows provided, use them
    if (this.rows()) {
      return this.rows()!;
    }

    // Auto-generate rows from builder data
    if (this.countValueDetailData()) {
      return this.countValueDetailData()!.map((item) => ({
        cells: item.isOtherRow
          ? [
              { value: item.count, class: 'font-medium' } as StatCell,
              { value: item.value, class: 'text-muted italic', colspan: 2 } as StatCell,
            ]
          : [
              { value: item.count, class: 'font-medium' } as StatCell,
              { value: item.value, wrapperClass: item.wrapperClass } as StatCell,
              { value: item.detail, class: 'text-right text-muted font-mono text-xs' } as StatCell,
            ],
      }));
    }

    if (this.countValueDescriptionData()) {
      return this.countValueDescriptionData()!.map((item) => ({
        cells: [
          { value: item.count, class: 'font-medium' } as StatCell,
          {
            value: item.value,
            wrapperClass: item.wrapperClass,
            originalValue: item.originalValue,
          } as StatCell,
          { value: item.description || '', class: 'text-muted' } as StatCell,
        ],
      }));
    }

    if (this.countValueData()) {
      return this.countValueData()!.map((item) => ({
        cells: [
          { value: item.count, class: 'font-medium' } as StatCell,
          { value: item.value, wrapperClass: item.wrapperClass } as StatCell,
        ],
      }));
    }

    return [];
  });
}
