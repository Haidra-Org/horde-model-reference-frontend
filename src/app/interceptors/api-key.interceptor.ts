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
        if (shouldAttach && (error.status === 401 || error.status === 403)) {
          this.authService.logout();
          const message =
            error.status === 401
              ? 'Authentication required. Please log in with an approver API key.'
              : 'You are not on the pending queue approver list.';
          this.notifications.error(message);
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
