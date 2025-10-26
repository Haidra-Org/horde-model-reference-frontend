import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { catchError, map, Observable, throwError } from 'rxjs';

interface FindUserResponse {
  username?: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);

  private readonly apiKey = signal<string | null>(null);
  private readonly username = signal<string | null>(null);

  readonly isAuthenticated = computed(() => this.apiKey() !== null);

  getApiKey(): string | null {
    return this.apiKey();
  }

  getUsername(): string | null {
    return this.username();
  }

  login(apikey: string): Observable<string> {
    const trimmedKey = apikey.trim();
    if (!trimmedKey) {
      return throwError(() => new Error('API key cannot be empty'));
    }

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

          this.apiKey.set(trimmedKey);
          this.username.set(username);

          return username;
        }),
        catchError((error: HttpErrorResponse) => {
          this.apiKey.set(null);
          this.username.set(null);

          if (error.status === 401 || error.status === 403) {
            return throwError(() => new Error('Invalid API key'));
          }

          return throwError(() => new Error('Failed to verify API key. Please try again.'));
        }),
      );
  }

  logout(): void {
    this.apiKey.set(null);
    this.username.set(null);
  }
}
