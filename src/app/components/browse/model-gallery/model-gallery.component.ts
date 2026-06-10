import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IconComponent } from '../../common/icon.component';
import { BASELINE_SHORTHAND_MAP } from '../../../models/maps';
import type { BrowseModel } from '../../../services/browse-models.service';
import type { PendingChangeOverlay } from '../../../models/pending-change-overlay';

@Component({
  selector: 'app-model-gallery',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="browse-gallery-grid">
      @for (m of models(); track m.name) {
        <div
          class="browse-gallery-tile"
          (click)="modelOpen.emit(m)"
          (keydown.enter)="modelOpen.emit(m)"
          tabindex="0"
          role="link"
        >
          <!-- Showcase placeholder -->
          <div class="browse-gallery-showcase">
            <span>{{ initials(m.display_name ?? m.name) }}</span>
            @if (m.nsfw) {
              <span class="browse-gallery-nsfw">NSFW</span>
            }
          </div>

          @if (m._pending) {
            <div style="position:absolute;top:10px;left:10px;z-index:2">
              <button
                type="button"
                class="badge badge-warning badge-sm"
                style="cursor:pointer;border:1px solid var(--color-pending-border)"
                (click)="pendingOpen.emit(m._pending); $event.stopPropagation()"
              >
                <app-icon name="clock" />{{ pendingLabel(m._pending) }}
              </button>
            </div>
          }

          <!-- Gradient overlay -->
          <div class="browse-gallery-overlay">
            <div class="browse-gallery-name">{{ m.display_name ?? m.name }}</div>
            <div class="browse-gallery-meta">
              <span>{{ baselineLabel(m.baseline ?? '') || m.style || '—' }}</span>
              <span class="browse-gallery-workers">
                <app-icon name="server" />{{ m._ghost ? '—' : (m._stats?.worker_count ?? '…') }}
              </span>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class ModelGalleryComponent {
  readonly models = input.required<BrowseModel[]>();
  readonly modelOpen = output<BrowseModel>();
  readonly pendingOpen = output<PendingChangeOverlay>();

  protected initials(name: string): string {
    return (
      (name ?? '??')
        .replace(/[^A-Za-z0-9]/g, '')
        .slice(0, 2)
        .toUpperCase() || '??'
    );
  }

  protected baselineLabel(baseline: string): string {
    return BASELINE_SHORTHAND_MAP[baseline] ?? baseline;
  }

  protected pendingLabel(pending: PendingChangeOverlay): string {
    switch (pending.pendingOperation) {
      case 'create':
        return 'Pending add';
      case 'delete':
        return 'Pending removal';
      default:
        return 'Pending edit';
    }
  }
}
