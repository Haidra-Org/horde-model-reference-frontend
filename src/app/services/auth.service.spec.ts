import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { firstValueFrom } from 'rxjs';
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

  it('should login successfully with valid API key', async () => {
    const apikey = 'test-api-key-123';
    const username = 'testuser';
    const loginPromise = firstValueFrom(service.login(apikey));

    const req = httpMock.expectOne('https://aihorde.net/api/v2/find_user');
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('apikey')).toBe(apikey);

    req.flush({ username });

    const returnedUsername = await loginPromise;
    expect(returnedUsername).toBe(username);
    expect(service.isAuthenticated()).toBe(true);
    expect(service.getApiKey()).toBe(apikey);
    expect(service.getUsername()).toBe(username);
  });

  it('should reject login with empty API key', async () => {
    await expect(firstValueFrom(service.login(''))).rejects.toThrow('API key cannot be empty');
    expect(service.isAuthenticated()).toBe(false);

    httpMock.expectNone('https://aihorde.net/api/v2/find_user');
  });

  it('should reject login with whitespace-only API key', async () => {
    await expect(firstValueFrom(service.login('   '))).rejects.toThrow('API key cannot be empty');
    expect(service.isAuthenticated()).toBe(false);

    httpMock.expectNone('https://aihorde.net/api/v2/find_user');
  });

  it('should handle 401 error during login', async () => {
    const loginPromise = firstValueFrom(service.login('invalid-key'));

    const req = httpMock.expectOne('https://aihorde.net/api/v2/find_user');
    req.flush(null, { status: 401, statusText: 'Unauthorized' });

    await expect(loginPromise).rejects.toThrow('Invalid API key');
    expect(service.isAuthenticated()).toBe(false);
    expect(service.getApiKey()).toBe(null);
    expect(service.getUsername()).toBe(null);
  });

  it('should handle 403 error during login', async () => {
    const loginPromise = firstValueFrom(service.login('forbidden-key'));

    const req = httpMock.expectOne('https://aihorde.net/api/v2/find_user');
    req.flush(null, { status: 403, statusText: 'Forbidden' });

    await expect(loginPromise).rejects.toThrow('Invalid API key');
    expect(service.isAuthenticated()).toBe(false);
  });

  it('should handle network error during login', async () => {
    const loginPromise = firstValueFrom(service.login('test-key'));

    const req = httpMock.expectOne('https://aihorde.net/api/v2/find_user');
    req.flush(null, { status: 500, statusText: 'Internal Server Error' });

    await expect(loginPromise).rejects.toThrow('Failed to verify API key. Please try again.');
    expect(service.isAuthenticated()).toBe(false);
  });

  it('should logout and clear credentials', async () => {
    const apikey = 'test-api-key';
    const username = 'testuser';

    const loginPromise = firstValueFrom(service.login(apikey));

    const req = httpMock.expectOne('https://aihorde.net/api/v2/find_user');
    req.flush({ username });

    await loginPromise;
    expect(service.isAuthenticated()).toBe(true);

    service.logout();

    expect(service.isAuthenticated()).toBe(false);
    expect(service.getApiKey()).toBe(null);
    expect(service.getUsername()).toBe(null);
  });

  it('should trim whitespace from API key', async () => {
    const apikey = '  test-api-key  ';
    const trimmedKey = 'test-api-key';
    const username = 'testuser';
    const loginPromise = firstValueFrom(service.login(apikey));

    const req = httpMock.expectOne('https://aihorde.net/api/v2/find_user');
    expect(req.request.headers.get('apikey')).toBe(trimmedKey);
    req.flush({ username });

    await loginPromise;
    expect(service.getApiKey()).toBe(trimmedKey);
  });
});
