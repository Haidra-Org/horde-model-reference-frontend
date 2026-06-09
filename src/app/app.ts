import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { TopbarComponent } from './components/topbar/topbar.component';
import { NotificationDisplayComponent } from './components/notification-display/notification-display.component';
import { ModelReferenceApiService } from './services/model-reference-api.service';
import { AuthService } from './services/auth.service';
import { PendingQueueSummaryService } from './services/pending-queue-summary.service';
import { IconRegistryService } from './services/icon-registry.service';
import { ICON_PATHS } from './shared/icon-paths';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, SidebarComponent, TopbarComponent, NotificationDisplayComponent],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly api = inject(ModelReferenceApiService);
  private readonly auth = inject(AuthService);
  private readonly pendingSummary = inject(PendingQueueSummaryService);

  constructor() {
    // Register all icons for the IconComponent (Phase 2+)
    inject(IconRegistryService).registerAll(ICON_PATHS);

    this.api.detectBackendCapabilities().pipe(takeUntilDestroyed()).subscribe();

    // Start/stop pending queue polling based on auth state
    effect(() => {
      if (this.auth.isAuthenticated()) {
        this.pendingSummary.startPolling();
      } else {
        this.pendingSummary.clear();
      }
    });
  }
}
