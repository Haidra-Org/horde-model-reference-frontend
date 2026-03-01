/**
 * Replicates the virtual init-testbed.js that Angular's @angular/build:unit-test
 * builder generates at build time. This file allows the Vitest VS Code extension
 * (which bypasses the Angular builder) to run tests with a properly initialized
 * Angular TestBed environment.
 */
import { getTestBed, ɵgetCleanupHook as getCleanupHook } from '@angular/core/testing';
import {
  BrowserTestingModule,
  platformBrowserTesting,
} from '@angular/platform-browser/testing';
import { beforeEach, afterEach } from 'vitest';

beforeEach(getCleanupHook(false));
afterEach(getCleanupHook(true));

getTestBed().initTestEnvironment(
  [BrowserTestingModule],
  platformBrowserTesting(),
  {
    errorOnUnknownElements: true,
    errorOnUnknownProperties: true,
  },
);
