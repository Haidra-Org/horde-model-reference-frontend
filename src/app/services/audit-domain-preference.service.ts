import { Injectable, computed, effect, inject, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AuditDomain, AUDIT_DOMAINS } from '../models/pending-queue-audit';
import { ModelReferenceApiService } from './model-reference-api.service';

@Injectable({
  providedIn: 'root',
})
export class AuditDomainPreferenceService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly storageKey = 'pendingQueueAuditDomain';
  private readonly api = inject(ModelReferenceApiService);
  private hasExplicitPreference = false;

  private readonly preferredDomain = signal<AuditDomain>(this.loadInitialDomain());

  readonly domain = computed(() => this.preferredDomain());

  constructor() {
    effect(() => {
      if (!this.isBrowser) {
        return;
      }

      const domain = this.preferredDomain();
      localStorage.setItem(this.storageKey, domain);
    });

    effect(
      () => {
        if (this.hasExplicitPreference) {
          return;
        }

        const canonical = this.api.backendCapabilities().canonicalFormat;
        if (canonical === 'v2' && this.preferredDomain() !== 'v2') {
          this.preferredDomain.set('v2');
        } else if (canonical === 'legacy' && this.preferredDomain() !== 'legacy') {
          this.preferredDomain.set('legacy');
        }
      },
      { allowSignalWrites: true },
    );
  }

  setDomain(domain: AuditDomain): void {
    if (!AUDIT_DOMAINS.includes(domain)) {
      return;
    }

    this.hasExplicitPreference = true;
    this.preferredDomain.set(domain);
  }

  private loadInitialDomain(): AuditDomain {
    if (this.isBrowser) {
      const stored = localStorage.getItem(this.storageKey);
      if (stored && AUDIT_DOMAINS.includes(stored as AuditDomain)) {
        this.hasExplicitPreference = true;
        return stored as AuditDomain;
      }
    }

    const canonical = this.api.backendCapabilities().canonicalFormat;
    if (canonical === 'v2' && AUDIT_DOMAINS.includes('v2' as AuditDomain)) {
      return 'v2';
    }

    if (canonical === 'legacy' && AUDIT_DOMAINS.includes('legacy' as AuditDomain)) {
      return 'legacy';
    }

    const defaultDomain = AUDIT_DOMAINS.find((domain) => domain === 'v2') ?? AUDIT_DOMAINS[0];
    return defaultDomain;
  }
}
