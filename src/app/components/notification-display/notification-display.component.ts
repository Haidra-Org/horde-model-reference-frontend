import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-notification-display',
  imports: [],
  templateUrl: './notification-display.component.html',
  styleUrl: './notification-display.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationDisplayComponent {
  readonly notificationService = inject(NotificationService);

  close(id: number): void {
    this.notificationService.remove(id);
  }
}
