import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavigationComponent } from './components/navigation/navigation.component';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { NotificationDisplayComponent } from './components/notification-display/notification-display.component';
import { ModelReferenceApiService } from './services/model-reference-api.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NavigationComponent, SidebarComponent, NotificationDisplayComponent],
  templateUrl: './app.html',
})
export class App implements OnInit {
  private readonly api = inject(ModelReferenceApiService);

  ngOnInit(): void {
    this.api.detectBackendCapabilities().subscribe();
  }
}
