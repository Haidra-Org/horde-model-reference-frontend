import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        AuthService,
      ],
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should start with no authentication', () => {
    expect(service.isAuthenticated()).toBe(false);
    expect(service.getApiKey()).toBe(null);
    expect(service.getUsername()).toBe(null);
  });

  it('should login successfully with valid API key', (done) => {
    const apikey = 'test-api-key-123';
    const username = 'testuser';

    service.login(apikey).subscribe({
      next: (returnedUsername) => {
        expect(returnedUsername).toBe(username);
        expect(service.isAuthenticated()).toBe(true);
        expect(service.getApiKey()).toBe(apikey);
        expect(service.getUsername()).toBe(username);
        done();
      },
    });

    const req = httpMock.expectOne('https://aihorde.net/api/v2/find_user');
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('apikey')).toBe(apikey);

    req.flush({ username });
  });

  it('should reject login with empty API key', (done) => {
    service.login('').subscribe({
      error: (error) => {
        expect(error.message).toBe('API key cannot be empty');
        expect(service.isAuthenticated()).toBe(false);
        done();
      },
    });

    httpMock.expectNone('https://aihorde.net/api/v2/find_user');
  });

  it('should reject login with whitespace-only API key', (done) => {
    service.login('   ').subscribe({
      error: (error) => {
        expect(error.message).toBe('API key cannot be empty');
        expect(service.isAuthenticated()).toBe(false);
        done();
      },
    });

    httpMock.expectNone('https://aihorde.net/api/v2/find_user');
  });

  it('should handle 401 error during login', (done) => {
    service.login('invalid-key').subscribe({
      error: (error) => {
        expect(error.message).toBe('Invalid API key');
        expect(service.isAuthenticated()).toBe(false);
        expect(service.getApiKey()).toBe(null);
        expect(service.getUsername()).toBe(null);
        done();
      },
    });

    const req = httpMock.expectOne('https://aihorde.net/api/v2/find_user');
    req.flush(null, { status: 401, statusText: 'Unauthorized' });
  });

  it('should handle 403 error during login', (done) => {
    service.login('forbidden-key').subscribe({
      error: (error) => {
        expect(error.message).toBe('Invalid API key');
        expect(service.isAuthenticated()).toBe(false);
        done();
      },
    });

    const req = httpMock.expectOne('https://aihorde.net/api/v2/find_user');
    req.flush(null, { status: 403, statusText: 'Forbidden' });
  });

  it('should handle network error during login', (done) => {
    service.login('test-key').subscribe({
      error: (error) => {
        expect(error.message).toBe('Failed to verify API key. Please try again.');
        expect(service.isAuthenticated()).toBe(false);
        done();
      },
    });

    const req = httpMock.expectOne('https://aihorde.net/api/v2/find_user');
    req.flush(null, { status: 500, statusText: 'Internal Server Error' });
  });

  it('should logout and clear credentials', () => {
    const apikey = 'test-api-key';
    const username = 'testuser';

    service.login(apikey).subscribe();

    const req = httpMock.expectOne('https://aihorde.net/api/v2/find_user');
    req.flush({ username });

    expect(service.isAuthenticated()).toBe(true);

    service.logout();

    expect(service.isAuthenticated()).toBe(false);
    expect(service.getApiKey()).toBe(null);
    expect(service.getUsername()).toBe(null);
  });

  it('should trim whitespace from API key', (done) => {
    const apikey = '  test-api-key  ';
    const trimmedKey = 'test-api-key';
    const username = 'testuser';

    service.login(apikey).subscribe({
      next: () => {
        expect(service.getApiKey()).toBe(trimmedKey);
        done();
      },
    });

    const req = httpMock.expectOne('https://aihorde.net/api/v2/find_user');
    expect(req.request.headers.get('apikey')).toBe(trimmedKey);
    req.flush({ username });
  });
});
