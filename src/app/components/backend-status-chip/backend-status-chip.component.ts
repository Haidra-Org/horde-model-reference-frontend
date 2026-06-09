import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ModelReferenceApiService } from '../../services/model-reference-api.service';

@Component({
  selector: 'app-backend-status-chip',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="backend-chip glass-inflow" routerLink="/deployment" [attr.aria-label]="ariaLabel()">
      <!-- Status dot -->
      <span
        class="backend-chip-dot"
        [class.backend-chip-dot--writable]="caps().writable"
        [class.backend-chip-dot--readonly]="!caps().writable"
      ></span>

      <!-- Mode · Format -->
      <span class="backend-chip-info">
        <span class="backend-chip-mode">{{ caps().mode }}</span>
        <span class="backend-chip-sep">·</span>
        <span
          class="backend-chip-format"
          [class.backend-chip-format--v2]="caps().canonicalFormat === 'v2'"
          [class.backend-chip-format--legacy]="caps().canonicalFormat === 'legacy'"
        >
          {{ caps().canonicalFormat }}
        </span>
      </span>

      <!-- Writable / Read-only pill -->
      <span
        class="backend-chip-pill"
        [class.backend-chip-pill--writable]="caps().writable"
        [class.backend-chip-pill--readonly]="!caps().writable"
      >
        {{ caps().writable ? 'WRITABLE' : 'READ-ONLY' }}
      </span>
    </a>
  `,
  styles: ``,
})
export class BackendStatusChipComponent {
  private readonly api = inject(ModelReferenceApiService);

  readonly caps = this.api.backendCapabilities;

  readonly ariaLabel = computed(() => {
    const c = this.caps();
    const status = c.writable ? 'writable' : 'read-only';
    return `Backend ${c.mode}, ${c.canonicalFormat} format, ${status}. Open deployment details.`;
  });
}
