import { TestBed } from '@angular/core/testing';
import { afterEach, vi } from 'vitest';

const noop = (): void => undefined;

// Polyfill `window.matchMedia` for services (e.g., ThemeService) that rely on it.
if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: noop,
      removeListener: noop,
      dispatchEvent: vi.fn(() => false),
    })),
  });
}

// Polyfill URL.createObjectURL/revokeObjectURL for CSV export tests.
if (!window.URL.createObjectURL) {
  Object.defineProperty(window.URL, 'createObjectURL', {
    writable: true,
    value: vi.fn(() => 'blob:mock-url'),
  });
}

if (!window.URL.revokeObjectURL) {
  Object.defineProperty(window.URL, 'revokeObjectURL', {
    writable: true,
    value: vi.fn(),
  });
}

// Ensure the Angular TestBed and any Vitest mocks are clean between specs.
afterEach(() => {
  TestBed.resetTestingModule();
  vi.restoreAllMocks();
});
