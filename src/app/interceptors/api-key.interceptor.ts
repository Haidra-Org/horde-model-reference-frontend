import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
} from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { NotificationService } from '../services/notification.service';
import { environment } from '../../environments/environment';

@Injectable()
export class ApiKeyHttpInterceptor implements HttpInterceptor {
  private readonly authService = inject(AuthService);
  private readonly notifications = inject(NotificationService);
  private readonly backendBaseUrl = environment.apiBaseUrl;

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const shouldAttach = this.shouldAttach(req.url);
    const apiKey = this.authService.getApiKey();

    const requestToSend =
      shouldAttach && apiKey ? req.clone({ setHeaders: { apikey: apiKey } }) : req;

    return next.handle(requestToSend).pipe(
      catchError((error: HttpErrorResponse) => {
        // 401 means the key itself was rejected — end the session once.
        // 403 means a valid key lacks a role; the calling surface owns that
        // messaging, so a background call must not log the user out.
        if (shouldAttach && error.status === 401 && apiKey && this.authService.isAuthenticated()) {
          this.authService.logout();
          this.notifications.error('Your API key was rejected. Please sign in again.');
        }
        return throwError(() => error);
      }),
    );
  }

  private shouldAttach(url: string): boolean {
    if (!this.backendBaseUrl) {
      return false;
    }

    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url.startsWith(this.backendBaseUrl);
    }

    return true;
  }
}
