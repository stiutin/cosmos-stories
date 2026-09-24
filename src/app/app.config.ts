import { provideHttpClient } from '@angular/common/http';
import type { ApplicationConfig } from '@angular/core';
import { isDevMode, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding, withViewTransitions } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { routes } from './app.routes';
import { onStoryViewTransition } from './stories/story-transition';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Since Angular 22 the fetch backend is the default; no `withFetch()` needed.
    provideHttpClient(),
    provideRouter(
      routes,
      // Route params (`:groupId`, `:date`) arrive as component inputs.
      withComponentInputBinding(),
      // A story ring morphs into the player and back (where supported).
      withViewTransitions({ onViewTransitionCreated: onStoryViewTransition }),
    ),
    // Offline support and installability (production builds only).
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
