import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { BASE_PATH } from '../../api-client';
import { ApiDocsComponent } from './api-docs.component';

describe('ApiDocsComponent', () => {
  let fixture: ComponentFixture<ApiDocsComponent>;
  let nativeEl: HTMLElement;
  const baseUrl = 'http://localhost:19800/api';

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ApiDocsComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: BASE_PATH, useValue: baseUrl },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ApiDocsComponent);
    nativeEl = fixture.nativeElement;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should display the config-derived base URL', () => {
    expect(nativeEl.textContent).toContain(baseUrl);
  });

  it('should render a CopyButton', () => {
    const copyBtn = nativeEl.querySelector('app-copy-button');
    expect(copyBtn).toBeTruthy();
  });

  it('should render the canonical format badge', () => {
    const badge = nativeEl.querySelector('.api-docs-canonical-badge');
    expect(badge).toBeTruthy();
    expect(badge!.textContent).toContain('canonical');
  });

  it('should render the quickstart section', () => {
    expect(nativeEl.textContent).toContain('Quickstart');
    const pre = nativeEl.querySelector('pre');
    expect(pre).toBeTruthy();
    expect(pre!.textContent).toContain('curl');
  });

  it('should render endpoint group cards', () => {
    const groups = nativeEl.querySelectorAll('.api-docs-group');
    expect(groups.length).toBeGreaterThanOrEqual(2);
  });

  it('should render method-colored endpoint rows', () => {
    const methods = nativeEl.querySelectorAll('.api-docs-group-method');
    expect(methods.length).toBeGreaterThan(0);
    const firstMethod = methods[0] as HTMLElement;
    expect(firstMethod.style.color).toBeTruthy();
  });

  it('should not contain hardcoded external URLs', () => {
    const allCode = nativeEl.querySelectorAll('code');
    let externalUrlsFound = false;
    allCode.forEach((el) => {
      const text = el.textContent ?? '';
      if (text.includes('http') && !text.includes(baseUrl)) {
        externalUrlsFound = true;
      }
    });
    expect(externalUrlsFound).toBeFalsy();
  });

  it('should render API path endpoints', () => {
    const paths = nativeEl.querySelectorAll('.api-docs-group-path');
    expect(paths.length).toBeGreaterThan(0);
    let foundCategories = false;
    paths.forEach((el) => {
      if (el.textContent?.includes('model_categories')) {
        foundCategories = true;
      }
    });
    expect(foundCategories).toBeTruthy();
  });

  it('documents both public licensing discovery and license-editor management', () => {
    const groups = Array.from<HTMLElement>(nativeEl.querySelectorAll('.api-docs-group'));
    const publicLicensing = groups.find((group) =>
      group.textContent?.includes('Licensing — public conclusions'),
    );
    const licensingManagement = groups.find((group) =>
      group.textContent?.includes('Licensing management — license-editor key'),
    );

    expect(publicLicensing?.textContent).toContain('GET');
    expect(publicLicensing?.textContent).toContain('/model_references/v2/licensing/summary');
    expect(publicLicensing?.textContent).toContain('/model_references/v2/licensing/models/');
    expect(licensingManagement?.textContent).toContain('POST');
    expect(licensingManagement?.textContent).toContain('DELETE');
    expect(licensingManagement?.textContent).toContain('/model_references/v2/licensing/licenses');
  });

  it('should show canonical version in badge', () => {
    const badge = nativeEl.querySelector('.api-docs-canonical-badge');
    expect(badge!.textContent).toMatch(/canonical\s+(v1|v2)/);
  });
});
