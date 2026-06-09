import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ModelReferenceApiService } from '../../services/model-reference-api.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-write-gating',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="write-gating">
      <div class="glass-inflow write-gating-card">
        <!-- Shield icon -->
        <div class="write-gating-icon">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width:26px;height:26px">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
            />
          </svg>
        </div>
        <h2 class="write-gating-title">Writes aren't available here</h2>
        <p class="write-gating-reason">{{ reasonMessage() }}</p>
        <a routerLink="/deployment" class="btn btn-ghost">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width:15px;height:15px">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"
            />
          </svg>
          View deployment status
        </a>
      </div>
    </div>
  `,
})
export class WriteGatingComponent {
  private readonly api = inject(ModelReferenceApiService);
  private readonly auth = inject(AuthService);

  readonly reasonMessage = computed(() => {
    const caps = this.api.backendCapabilities();
    if (!caps.writable) {
      return `This backend is ${caps.mode} / read-only. Proposing changes requires a PRIMARY deployment.`;
    }
    return `You're viewing as Public. Proposing a change requires a requestor API key.`;
  });
}
