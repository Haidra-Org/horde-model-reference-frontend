import {
  HTTP_INTERCEPTORS,
  HttpClient,
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { vi } from 'vitest';
import { ApiKeyHttpInterceptor } from './api-key.interceptor';
import { AuthService } from '../services/auth.service';
import { NotificationService } from '../services/notification.service';

class MockAuthService {
  apiKey: string | null = 'abc-key';
  logout = vi.fn();

  getApiKey(): string | null {
    return this.apiKey;
  }

  isAuthenticated(): boolean {
    return this.apiKey !== null;
  }
}

describe('ApiKeyHttpInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let auth: MockAuthService;
  let notifications: NotificationService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        NotificationService,
        { provide: AuthService, useClass: MockAuthService },
        { provide: HTTP_INTERCEPTORS, useClass: ApiKeyHttpInterceptor, multi: true },
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService) as unknown as MockAuthService;
    notifications = TestBed.inject(NotificationService);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('attaches the API key to backend requests', () => {
    http.get('http://localhost:19800/api/pending_queue/audit/current').subscribe();

    const request = httpMock.expectOne('http://localhost:19800/api/pending_queue/audit/current');
    expect(request.request.headers.get('apikey')).toBe('abc-key');
    request.flush({});
  });

  it('skips attaching headers for external hosts', () => {
    http.get('https://aihorde.net/api/v2/find_user').subscribe();

    const request = httpMock.expectOne('https://aihorde.net/api/v2/find_user');
    expect(request.request.headers.has('apikey')).toBe(false);
    request.flush({});
  });

  it('logs out and notifies on unauthorized backend responses', () => {
    const errorSpy = vi.spyOn(notifications, 'error');

    http.get('http://localhost:19800/api/pending_queue/audit/current').subscribe({
      next: () => {
        throw new Error('Expected request to fail');
      },
      error: () => {
        expect(auth.logout).toHaveBeenCalled();
        expect(errorSpy).toHaveBeenCalled();
      },
    });

    const request = httpMock.expectOne('http://localhost:19800/api/pending_queue/audit/current');
    request.flush({ detail: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });
  });

  it('keeps the session on forbidden responses (role failures are not auth failures)', () => {
    const errorSpy = vi.spyOn(notifications, 'error');

    http.post('http://localhost:19800/api/pending_queue/batches', {}).subscribe({
      next: () => {
        throw new Error('Expected request to fail');
      },
      error: () => {
        expect(auth.logout).not.toHaveBeenCalled();
        expect(errorSpy).not.toHaveBeenCalled();
      },
    });

    const request = httpMock.expectOne('http://localhost:19800/api/pending_queue/batches');
    request.flush(
      { detail: 'You are not on the pending queue approver list.' },
      { status: 403, statusText: 'Forbidden' },
    );
  });
});
