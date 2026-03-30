import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DatePipe, JsonPipe } from '@angular/common';
import type { PendingQueueAuditEvent } from '../../models/pending-queue-audit';

@Component({
  selector: 'app-pending-queue-audit-timeline',
  imports: [DatePipe, JsonPipe],
  template: `
    <div class="timeline-container">
      @if (!normalizedEvents().length) {
        <p class="text-sm text-slate-400">No timeline events recorded for this change.</p>
      } @else {
        <ol class="timeline-list">
          @for (event of normalizedEvents(); track trackEvent($index, event)) {
            <li class="timeline-row">
              <div class="timeline-marker">
                <span class="timeline-dot"></span>
                <span class="timeline-line"></span>
              </div>
              <div class="timeline-content">
                <div class="timeline-meta">
                  <span class="timeline-action">{{ formatAction(event.action) }}</span>
                  <span class="timeline-timestamp">
                    {{ toDate(event.timestamp) | date: 'medium' }}
                  </span>
                </div>
                @if (event.event_id) {
                  <p class="text-xs text-slate-400">Event #{{ event.event_id }}</p>
                }
                @if (hasPayload(event.payload)) {
                  <details class="mt-2 text-xs text-slate-200">
                    <summary class="cursor-pointer text-slate-300">Payload</summary>
                    <pre class="mt-1 max-h-48 overflow-auto rounded bg-slate-900/70 p-2">{{
                      event.payload | json
                    }}</pre>
                  </details>
                }
              </div>
            </li>
          }
        </ol>
      }
    </div>
  `,

  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PendingQueueAuditTimelineComponent {
  readonly events = input<PendingQueueAuditEvent[] | null | undefined>([]);

  readonly normalizedEvents = computed(() => {
    const events = this.events() ?? [];
    return [...events].sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
  });

  trackEvent(index: number, event: PendingQueueAuditEvent): number {
    return event.event_id ?? index;
  }

  formatAction(action?: string | null): string {
    if (!action) {
      return 'Unknown action';
    }
    return action.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  }

  toDate(timestamp?: number | null): number {
    return (timestamp ?? 0) * 1000;
  }

  hasPayload(payload: unknown): boolean {
    if (!payload) {
      return false;
    }

    if (typeof payload !== 'object') {
      return true;
    }

    return Object.keys(payload as Record<string, unknown>).length > 0;
  }
}
