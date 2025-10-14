import { Injectable, signal } from '@angular/core';

export interface Notification {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private nextId = 0;
  readonly notifications = signal<Notification[]>([]);

  success(message: string): void {
    this.addNotification(message, 'success');
  }

  error(message: string): void {
    this.addNotification(message, 'error');
  }

  info(message: string): void {
    this.addNotification(message, 'info');
  }

  remove(id: number): void {
    this.notifications.update((notifications) =>
      notifications.filter((n) => n.id !== id)
    );
  }

  private addNotification(message: string, type: Notification['type']): void {
    const id = this.nextId++;
    const notification: Notification = { id, message, type };

    this.notifications.update((notifications) => [...notifications, notification]);

    setTimeout(() => {
      this.remove(id);
    }, 5000);
  }
}
