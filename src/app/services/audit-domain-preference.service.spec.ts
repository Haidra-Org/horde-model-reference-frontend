import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID, provideZonelessChangeDetection, signal } from '@angular/core';
import { AuditDomainPreferenceService } from './audit-domain-preference.service';
import { ModelReferenceApiService } from './model-reference-api.service';
import type { BackendCapabilities } from '../models/api.models';

describe('AuditDomainPreferenceService', () => {
  class MockModelReferenceApiService {
    readonly backendCapabilities = signal<BackendCapabilities>({
      writable: false,
      mode: 'REPLICA',
      canonicalFormat: 'legacy',
    });

    setCanonical(format: BackendCapabilities['canonicalFormat']): void {
      const current = this.backendCapabilities();
      this.backendCapabilities.set({ ...current, canonicalFormat: format });
    }
  }

  let api: MockModelReferenceApiService;
  const flushSignals = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

  beforeEach(() => {
    api = new MockModelReferenceApiService();
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        AuditDomainPreferenceService,
        { provide: ModelReferenceApiService, useValue: api },
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });
  });

  it('falls back to backend canonical format when no preference exists', async () => {
    const service = TestBed.inject(AuditDomainPreferenceService);
    expect(service.domain()).toBe('legacy');

    api.setCanonical('v2');
    await flushSignals();
    expect(service.domain()).toBe('v2');
  });

  it('does not override explicit preferences once the user picks a domain', async () => {
    const service = TestBed.inject(AuditDomainPreferenceService);
    service.setDomain('legacy');
    api.setCanonical('v2');
    await flushSignals();
    expect(service.domain()).toBe('legacy');
  });

  it('prefers stored preference from localStorage over backend canonical', async () => {
    localStorage.setItem('pendingQueueAuditDomain', 'v2');
    const service = TestBed.inject(AuditDomainPreferenceService);
    expect(service.domain()).toBe('v2');

    api.setCanonical('legacy');
    await flushSignals();
    expect(service.domain()).toBe('v2');
  });
});
