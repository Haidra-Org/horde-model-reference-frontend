import {
  ApplicationConfig,
  inject,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter, UrlSerializer } from '@angular/router';
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
import { PathSyntaxUrlSerializer } from './utils/path-syntax-url-serializer';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes),
    { provide: UrlSerializer, useClass: PathSyntaxUrlSerializer },
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
