import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { WriteFormState } from '../../utils/write-record';
import type { DiffEntry } from '../../utils/compute-diff';

@Component({
  selector: 'app-wizard-step-review',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="write-review">
      <p class="write-review-summary-text">
        Review the proposed record. Submitting enqueues it as a
        <strong>pending</strong> change — it won't go live until an approver applies it.
      </p>

      <div class="write-review-rows">
        <div class="write-review-row">
          <span class="write-review-key">Operation</span>
          <span class="write-review-value">{{ isEdit() ? 'Update' : 'Create' }}</span>
        </div>
        <div class="write-review-row">
          <span class="write-review-key">Name</span>
          <span class="write-review-value">{{ form().name || '—' }}</span>
        </div>
        @if (isImage()) {
          <div class="write-review-row">
            <span class="write-review-key">Baseline</span>
            <span class="write-review-value">{{ form().baseline }}</span>
          </div>
        }
        @if (isText()) {
          <div class="write-review-row">
            <span class="write-review-key">Parameters</span>
            <span class="write-review-value">{{ form().parameters || '—' }}</span>
          </div>
        }
        <div class="write-review-row">
          <span class="write-review-key">Files</span>
          <span class="write-review-value">{{ fileCount() }} configured</span>
        </div>
        <div class="write-review-row write-review-row--critical">
          <span class="write-review-key">License</span>
          <span class="write-review-value mono">{{ form().license_expression }}</span>
        </div>
        <div class="write-review-row write-review-row--critical">
          <span class="write-review-key">Commercial use</span>
          <span class="write-review-value">{{ permissionLabel(form().commercial_use) }}</span>
        </div>
        <div class="write-review-row write-review-row--critical">
          <span class="write-review-key">Redistribution</span>
          <span class="write-review-value">{{ permissionLabel(form().redistribution) }}</span>
        </div>
        <div class="write-review-row">
          <span class="write-review-key">Endpoint</span>
          <span class="write-review-value mono">{{ endpoint() }}</span>
        </div>
      </div>

      @if (isEdit() && diffEntries().length > 0) {
        <div class="write-review-diff">
          <h4 class="write-review-diff-title">Changes ({{ diffEntries().length }} fields)</h4>
          <div class="write-review-diff-list">
            @for (entry of diffEntries(); track entry.field) {
              <div class="write-review-diff-entry">
                <span class="write-review-diff-field">{{ entry.field }}</span>
                <span class="write-review-diff-kind" [attr.data-kind]="entry.kind">{{
                  entry.kind
                }}</span>
                @if (entry.before !== null && entry.after !== null) {
                  <span class="write-review-diff-values">
                    <code>{{ entry.before }}</code> → <code>{{ entry.after }}</code>
                  </span>
                } @else if (entry.after !== null) {
                  <span class="write-review-diff-values"
                    ><code>{{ entry.after }}</code></span
                  >
                }
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class WizardStepReviewComponent {
  readonly form = input.required<WriteFormState>();
  readonly category = input.required<string>();
  readonly isEdit = input(false);
  readonly endpoint = input('');
  readonly diffEntries = input<DiffEntry[]>([]);
  readonly isImage = input(false);
  readonly isText = input(false);

  readonly fileCount = computed(
    () => this.form().download.filter((d) => d.file_name || d.file_url).length,
  );

  permissionLabel(permission: string): string {
    return permission.replaceAll('_', ' ').replace(/^./, (first) => first.toUpperCase());
  }
}
