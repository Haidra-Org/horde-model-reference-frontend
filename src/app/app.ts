import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavigationComponent } from './components/navigation/navigation.component';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { NotificationDisplayComponent } from './components/notification-display/notification-display.component';
import { ModelReferenceApiService } from './services/model-reference-api.service';
import { SidebarService } from './services/sidebar.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NavigationComponent, SidebarComponent, NotificationDisplayComponent],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly api = inject(ModelReferenceApiService);
  private readonly sidebarService = inject(SidebarService);

  readonly sidebarCollapsed = this.sidebarService.isCollapsed;

  constructor() {
    this.api.detectBackendCapabilities().pipe(takeUntilDestroyed()).subscribe();
  }

  toggleSidebar(): void {
    this.sidebarService.toggle();
  }
}
