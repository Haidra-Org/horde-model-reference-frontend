import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideZonelessChangeDetection, PLATFORM_ID } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';
import { BASE_PATH } from '../api-client';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  const mockLocalStorage: Record<string, string> = {};

  beforeEach(() => {
    // Clear mock localStorage
    Object.keys(mockLocalStorage).forEach((key) => delete mockLocalStorage[key]);

    // Mock localStorage
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(
      (key: string) => mockLocalStorage[key] ?? null,
    );
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key: string, value: string) => {
      mockLocalStorage[key] = value;
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation((key: string) => {
      delete mockLocalStorage[key];
    });

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: BASE_PATH, useValue: 'http://localhost:19800/api' },
        AuthService,
      ],
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    // Flush any pending requests before verifying
    httpMock.match(() => true).forEach((req) => req.flush(null));
    httpMock.verify();
    vi.restoreAllMocks();
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
    const username = 'testuser#1234';
    const loginPromise = firstValueFrom(service.login(apikey));

    // First: AI Horde validation
    const hordeReq = httpMock.expectOne('https://aihorde.net/api/v2/find_user');
    expect(hordeReq.request.method).toBe('GET');
    expect(hordeReq.request.headers.get('apikey')).toBe(apikey);
    hordeReq.flush({ username });

    const returnedUsername = await loginPromise;
    expect(returnedUsername).toBe(username);
    expect(service.getApiKey()).toBe(apikey);

    // Second: Roles endpoint call (non-blocking, so may or may not be pending)
    const rolesReqs = httpMock.match((req) => req.url.includes('/model_references/v2/me/roles'));
    rolesReqs.forEach((req) =>
      req.flush({
        user_id: '1234',
        username,
        roles: ['approver', 'requestor'],
        is_approver: true,
        is_requestor: true,
      }),
    );

    // After roles are fetched, should be fully authenticated
    expect(service.isAuthenticated()).toBe(true);
    expect(service.isApprover()).toBe(true);
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
    const username = 'testuser#5678';

    const loginPromise = firstValueFrom(service.login(apikey));

    const hordeReq = httpMock.expectOne('https://aihorde.net/api/v2/find_user');
    hordeReq.flush({ username });

    await loginPromise;

    // Flush roles request
    const rolesReqs = httpMock.match((req) => req.url.includes('/model_references/v2/me/roles'));
    rolesReqs.forEach((req) =>
      req.flush({
        user_id: '5678',
        username,
        roles: ['approver'],
        is_approver: true,
        is_requestor: true,
      }),
    );

    expect(service.isAuthenticated()).toBe(true);

    service.logout();

    expect(service.isAuthenticated()).toBe(false);
    expect(service.getApiKey()).toBe(null);
    expect(service.getUsername()).toBe(null);
  });

  it('should trim whitespace from API key', async () => {
    const apikey = '  test-api-key  ';
    const trimmedKey = 'test-api-key';
    const username = 'testuser#9999';
    const loginPromise = firstValueFrom(service.login(apikey));

    const req = httpMock.expectOne('https://aihorde.net/api/v2/find_user');
    expect(req.request.headers.get('apikey')).toBe(trimmedKey);
    req.flush({ username });

    await loginPromise;

    // Flush roles request
    const rolesReqs = httpMock.match((req) => req.url.includes('/model_references/v2/me/roles'));
    rolesReqs.forEach((req) =>
      req.flush({
        user_id: '9999',
        username,
        roles: [],
        is_approver: false,
        is_requestor: false,
      }),
    );

    expect(service.getApiKey()).toBe(trimmedKey);
  });

  it('should persist API key to localStorage', async () => {
    const apikey = 'persist-test-key';
    const username = 'testuser#1111';
    const loginPromise = firstValueFrom(service.login(apikey));

    const hordeReq = httpMock.expectOne('https://aihorde.net/api/v2/find_user');
    hordeReq.flush({ username });

    await loginPromise;

    // Flush roles request
    const rolesReqs = httpMock.match((req) => req.url.includes('/model_references/v2/me/roles'));
    rolesReqs.forEach((req) =>
      req.flush({
        user_id: '1111',
        username,
        roles: ['requestor'],
        is_approver: false,
        is_requestor: true,
      }),
    );

    // Allow the effect to run (effects are scheduled asynchronously)
    await TestBed.flushEffects();

    expect(mockLocalStorage['hordeAuthApiKey']).toBe(apikey);
  });

  it('should remove API key from localStorage on logout', async () => {
    const apikey = 'logout-test-key';
    const username = 'testuser#2222';
    const loginPromise = firstValueFrom(service.login(apikey));

    const hordeReq = httpMock.expectOne('https://aihorde.net/api/v2/find_user');
    hordeReq.flush({ username });

    await loginPromise;

    // Flush roles request
    const rolesReqs = httpMock.match((req) => req.url.includes('/model_references/v2/me/roles'));
    rolesReqs.forEach((req) =>
      req.flush({
        user_id: '2222',
        username,
        roles: [],
        is_approver: false,
        is_requestor: false,
      }),
    );

    // Allow the effect to run
    await TestBed.flushEffects();

    expect(mockLocalStorage['hordeAuthApiKey']).toBe(apikey);

    service.logout();

    // Allow the effect to run after logout
    await TestBed.flushEffects();

    expect(mockLocalStorage['hordeAuthApiKey']).toBeUndefined();
  });
});
