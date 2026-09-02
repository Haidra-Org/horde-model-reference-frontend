import {
  ApplicationConfig,
  inject,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import {
  HTTP_INTERCEPTORS,
  provideHttpClient,
  withInterceptorsFromDi,
  withXhr,
} from '@angular/common/http';

import { Configuration, BASE_PATH } from './api-client';
import { environment } from '../environments/environment';
import { AuthService } from './services/auth.service';
import { ApiKeyHttpInterceptor } from './interceptors/api-key.interceptor';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes),
    provideHttpClient(withXhr(), withInterceptorsFromDi()),
    { provide: HTTP_INTERCEPTORS, useClass: ApiKeyHttpInterceptor, multi: true },
    { provide: BASE_PATH, useValue: environment.apiBaseUrl },
    {
      provide: Configuration,
      useFactory: () => {
        const authService = inject(AuthService);
        return new Configuration({
          credentials: {
            APIKeyHeader: () => authService.getApiKey() ?? undefined,
          },
        });
      },
    },
  ],
};
