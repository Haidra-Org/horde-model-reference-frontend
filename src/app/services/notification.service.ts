import { Injectable, signal } from '@angular/core';

export interface Notification {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  /** If true, the notification will not auto-dismiss after 5 seconds */
  persistent?: boolean;
}

export interface NotificationOptions {
  /** If true, the notification will not auto-dismiss after 5 seconds */
  persistent?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private nextId = 0;
  readonly notifications = signal<Notification[]>([]);

  success(message: string, options?: NotificationOptions): void {
    this.addNotification(message, 'success', options?.persistent ?? false);
  }

  error(message: string, options?: NotificationOptions): void {
    this.addNotification(message, 'error', options?.persistent ?? false);
  }

  warning(message: string, options?: NotificationOptions): void {
    this.addNotification(message, 'warning', options?.persistent ?? false);
  }

  info(message: string, options?: NotificationOptions): void {
    this.addNotification(message, 'info', options?.persistent ?? false);
  }

  remove(id: number): void {
    this.notifications.update((notifications) => notifications.filter((n) => n.id !== id));
  }

  private addNotification(message: string, type: Notification['type'], persistent: boolean): void {
    const id = this.nextId++;
    const notification: Notification = { id, message, type, persistent };

    this.notifications.update((notifications) => [...notifications, notification]);

    if (!persistent) {
      setTimeout(() => {
        this.remove(id);
      }, 5000);
    }
  }
}
