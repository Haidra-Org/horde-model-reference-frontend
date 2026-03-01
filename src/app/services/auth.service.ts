import { HttpBackend, HttpClient, HttpErrorResponse } from '@angular/common/http';
import { computed, effect, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { catchError, map, Observable, of, tap, throwError } from 'rxjs';
import { BASE_PATH } from '../api-client';
import { environment } from '../../environments/environment';
import {
  AUTH_STORAGE_KEY,
  AuthenticatedUser,
  createAuthenticatedUser,
  meetsMinimumRole,
  UserRole,
  UserRolesResponse,
} from '../models/auth.models';

interface FindUserResponse {
  username?: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly httpBackend = inject(HttpBackend);
  private readonly http = new HttpClient(this.httpBackend);
  private readonly platformId = inject(PLATFORM_ID);
  // Note: We inject BASE_PATH but fall back to environment to avoid circular dependency
  // (AuthService <- Configuration <- UserService <- AuthService)
  private readonly basePath = inject(BASE_PATH, { optional: true }) ?? environment.apiBaseUrl;
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  private readonly apiKey = signal<string | null>(null);
  private readonly user = signal<AuthenticatedUser | null>(null);
  private readonly isRestoring = signal<boolean>(false);

  /** Whether the user is currently authenticated. */
  readonly isAuthenticated = computed(() => this.apiKey() !== null && this.user() !== null);

  /** Whether a session restoration is in progress. */
  readonly isRestoringSession = computed(() => this.isRestoring());

  /** The current authenticated user, or null if not logged in. */
  readonly currentUser = computed(() => this.user());

  /** The username of the current user, or null if not logged in. */
  readonly username = computed(() => this.user()?.username ?? null);

  /** Whether the current user has approver privileges. */
  readonly isApprover = computed(() => this.user()?.isApprover ?? false);

  /** Whether the current user has requestor privileges. */
  readonly isRequestor = computed(() => this.user()?.isRequestor ?? false);

  /** The highest role the current user has. */
  readonly highestRole = computed<UserRole>(() => this.user()?.highestRole ?? 'anonymous');

  constructor() {
    // Persist API key to localStorage when it changes
    effect(() => {
      if (!this.isBrowser) {
        return;
      }

      const key = this.apiKey();
      if (key) {
        localStorage.setItem(AUTH_STORAGE_KEY, key);
      } else {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      }
    });

    // Restore session on service initialization
    this.restoreSession();
  }

  /**
   * Get the current API key.
   */
  getApiKey(): string | null {
    return this.apiKey();
  }

  /**
   * Get the current username (deprecated - use currentUser() instead).
   */
  getUsername(): string | null {
    return this.user()?.username ?? null;
  }

  /**
   * Check if the user has at least the specified role.
   */
  hasMinimumRole(minimumRole: UserRole): boolean {
    return meetsMinimumRole(this.highestRole(), minimumRole);
  }

  /**
   * Check if the user has a specific role.
   */
  hasRole(role: UserRole): boolean {
    const userRoles = this.user()?.roles;
    if (!userRoles) {
      return role === 'anonymous';
    }
    return userRoles.has(role);
  }

  /**
   * Login with an API key.
   * This validates the key against AI Horde, then fetches user roles from the backend.
   */
  login(apikey: string): Observable<string> {
    const trimmedKey = apikey.trim();
    if (!trimmedKey) {
      return throwError(() => new Error('API key cannot be empty'));
    }

    // First, validate the API key against AI Horde
    return this.http
      .get<FindUserResponse>('https://aihorde.net/api/v2/find_user', {
        headers: { apikey: trimmedKey },
      })
      .pipe(
        map((response) => {
          const username = response.username;
          if (!username) {
            throw new Error('Invalid response from server: missing username');
          }
          return { username, apiKey: trimmedKey };
        }),
        // After validating with AI Horde, fetch roles from our backend
        tap(({ apiKey }) => {
          this.apiKey.set(apiKey);
        }),
        map(({ username, apiKey }) => {
          // Fetch roles from our backend (non-blocking)
          this.fetchUserRoles(apiKey).subscribe();
          return username;
        }),
        catchError((error: HttpErrorResponse) => {
          this.clearAuthState();

          if (error.status === 401 || error.status === 403) {
            return throwError(() => new Error('Invalid API key'));
          }

          return throwError(() => new Error('Failed to verify API key. Please try again.'));
        }),
      );
  }

  /**
   * Logout and clear all auth state.
   */
  logout(): void {
    this.clearAuthState();
  }

  /**
   * Restore session from localStorage.
   * Called automatically on service initialization.
   */
  private restoreSession(): void {
    if (!this.isBrowser) {
      return;
    }

    const storedKey = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!storedKey) {
      return;
    }

    this.isRestoring.set(true);
    this.apiKey.set(storedKey);

    // Validate the stored key and fetch roles
    this.fetchUserRoles(storedKey).subscribe({
      next: () => {
        this.isRestoring.set(false);
      },
      error: () => {
        // Key is no longer valid, clear it
        this.clearAuthState();
        this.isRestoring.set(false);
      },
    });
  }

  /**
   * Fetch user roles from the backend.
   * Note: Uses HttpClient directly instead of UserService to avoid circular dependency
   * (AuthService <- Configuration <- UserService <- AuthService)
   */
  private fetchUserRoles(apiKey: string): Observable<AuthenticatedUser | null> {
    // Use HttpClient directly to avoid circular dependency with Configuration
    return this.http
      .get<UserRolesResponse>(`${this.basePath}/model_references/v2/me/roles`, {
        headers: { apikey: apiKey },
      })
      .pipe(
        map((response: UserRolesResponse) => {
          const user = createAuthenticatedUser(response);
          this.user.set(user);
          return user;
        }),
        catchError((error: HttpErrorResponse) => {
          // If the backend returns 401, the key is invalid
          if (error.status === 401) {
            this.clearAuthState();
            return throwError(() => new Error('Invalid API key'));
          }

          // For other errors (like 404 if endpoint doesn't exist yet),
          // create a basic user without roles
          if (error.status === 404) {
            // Fallback: validate against AI Horde directly
            return this.fallbackValidation(apiKey);
          }

          // For network errors or other issues, create a basic user
          console.warn('Failed to fetch user roles:', error);
          return this.fallbackValidation(apiKey);
        }),
      );
  }

  /**
   * Fallback validation when the roles endpoint is not available.
   */
  private fallbackValidation(apiKey: string): Observable<AuthenticatedUser | null> {
    return this.http
      .get<FindUserResponse>('https://aihorde.net/api/v2/find_user', {
        headers: { apikey: apiKey },
      })
      .pipe(
        map((response) => {
          const username = response.username;
          if (!username) {
            this.clearAuthState();
            return null;
          }

          // Create a basic user without specific roles
          // They'll be treated as 'user' level until roles endpoint is available
          const userId = username.split('#').pop() ?? '';
          const user: AuthenticatedUser = {
            userId,
            username,
            roles: new Set(),
            highestRole: 'user',
            isApprover: false,
            isRequestor: false,
          };
          this.user.set(user);
          return user;
        }),
        catchError(() => {
          this.clearAuthState();
          return of(null);
        }),
      );
  }

  /**
   * Clear all authentication state.
   */
  private clearAuthState(): void {
    this.apiKey.set(null);
    this.user.set(null);
  }
}
