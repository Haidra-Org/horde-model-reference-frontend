# @

The **Horde Model Reference API** is the authoritative source of AI model metadata for the [AI-Horde](https://aihorde.net) ecosystem. It serves the curated lists of image, text, and utility models (CLIP, ControlNet, ESRGAN, …) that workers download and that clients display. ### Who uses this API - **Workers & clients** read model references - either directly over HTTP or via the `horde-model-reference` Python library running in REPLICA mode (which calls this same API, falling back to GitHub if the PRIMARY is unreachable). - **The AI-Horde backend** runs this service in PRIMARY mode at [`models.aihorde.net`](https://models.aihorde.net/api/docs) as the canonical source. ### Two API versions - **v2** (`/model_references/v2`) - the current format, with search, per-model retrieval, statistics, and the full text-model grouping toolkit. Prefer this for new integrations. - **v1** (`/model_references/v1`) - the legacy GitHub-compatible format, retained unchanged for backward compatibility with existing AI-Horde workers. Both versions are readable regardless of deployment configuration. **Reads are open; writes are not.** Write operations require a PRIMARY deployment and a valid `apikey`, and they are not applied immediately - they enter a [pending queue](https://models.aihorde.net/api/docs) for two-person review (propose -> approve -> apply). ### Discovering capabilities Call [`GET /replicate_mode`](#operations-default-replicate_mode_replicate_mode_get) on startup to learn whether an instance is writable and which canonical format it serves. Full documentation, tutorials, and guides: <https://github.com/Haidra-Org/horde-model-reference>

The version of the OpenAPI document: 0.1.dev385+g97725b489.d20260606

## Building

To install the required dependencies and to build the typescript sources run:

```console
npm install
npm run build
```

## Publishing

First build the package then run `npm publish dist` (don't forget to specify the `dist` folder!)

## Consuming

Navigate to the folder of your consuming project and run one of next commands.

_published:_

```console
npm install @ --save
```

_without publishing (not recommended):_

```console
npm install PATH_TO_GENERATED_PACKAGE/dist.tgz --save
```

_It's important to take the tgz file, otherwise you'll get trouble with links on windows_

_using `npm link`:_

In PATH_TO_GENERATED_PACKAGE/dist:

```console
npm link
```

In your project:

```console
npm link
```

**Note for Windows users:** The Angular CLI has troubles to use linked npm packages.
Please refer to this issue <https://github.com/angular/angular-cli/issues/8284> for a solution / workaround.
Published packages are not effected by this issue.

### General usage

In your Angular project:

```typescript
import { ApplicationConfig } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideApi } from '';

export const appConfig: ApplicationConfig = {
  providers: [
    // ...
    provideHttpClient(),
    provideApi(),
  ],
};
```

**NOTE**
If you're still using `AppModule` and haven't [migrated](https://angular.dev/reference/migrations/standalone) yet, you can still import an Angular module:

```typescript
import { ApiModule } from '';
```

If different from the generated base path, during app bootstrap, you can provide the base path to your service.

```typescript
import { ApplicationConfig } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideApi } from '';

export const appConfig: ApplicationConfig = {
  providers: [
    // ...
    provideHttpClient(),
    provideApi('http://localhost:9999'),
  ],
};
```

```typescript
// with a custom configuration
import { ApplicationConfig } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideApi } from '';

export const appConfig: ApplicationConfig = {
  providers: [
    // ...
    provideHttpClient(),
    provideApi({
      withCredentials: true,
      username: 'user',
      password: 'password',
    }),
  ],
};
```

```typescript
// with factory building a custom configuration
import { ApplicationConfig } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideApi, Configuration } from '';

export const appConfig: ApplicationConfig = {
  providers: [
    // ...
    provideHttpClient(),
    {
      provide: Configuration,
      useFactory: (authService: AuthService) =>
        new Configuration({
          basePath: 'http://localhost:9999',
          withCredentials: true,
          username: authService.getUsername(),
          password: authService.getPassword(),
        }),
      deps: [AuthService],
      multi: false,
    },
  ],
};
```

### Using multiple OpenAPI files / APIs

In order to use multiple APIs generated from different OpenAPI files,
you can create an alias name when importing the modules
in order to avoid naming conflicts:

```typescript
import { provideApi as provideUserApi } from 'my-user-api-path';
import { provideApi as provideAdminApi } from 'my-admin-api-path';
import { HttpClientModule } from '@angular/common/http';
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    // ...
    provideHttpClient(),
    provideUserApi(environment.basePath),
    provideAdminApi(environment.basePath),
  ],
};
```

### Customizing path parameter encoding

Without further customization, only [path-parameters][parameter-locations-url] of [style][style-values-url] 'simple'
and Dates for format 'date-time' are encoded correctly.

Other styles (e.g. "matrix") are not that easy to encode
and thus are best delegated to other libraries (e.g.: [@honoluluhenk/http-param-expander]).

To implement your own parameter encoding (or call another library),
pass an arrow-function or method-reference to the `encodeParam` property of the Configuration-object
(see [General Usage](#general-usage) above).

Example value for use in your Configuration-Provider:

```typescript
new Configuration({
  encodeParam: (param: Param) => myFancyParamEncoder(param),
});
```

[parameter-locations-url]: https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.1.0.md#parameter-locations
[style-values-url]: https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.1.0.md#style-values
[@honoluluhenk/http-param-expander]: https://www.npmjs.com/package/@honoluluhenk/http-param-expander
