import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal, provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { BASE_PATH } from '../../api-client';
import { AnalyticsShowcasesComponent } from './analytics-showcases.component';
import { ModelReferenceApiService } from '../../services/model-reference-api.service';
import { of } from 'rxjs';

describe('AnalyticsShowcasesComponent', () => {
  let fixture: ComponentFixture<AnalyticsShowcasesComponent>;
  let nativeEl: HTMLElement;

  const mockRecords = [
    {
      name: 'model-a',
      display_name: 'Model A',
      showcases: ['https://example.com/img1.jpg', 'https://example.com/img2.jpg'],
    },
    { name: 'model-b', display_name: 'Model B', showcase: 'https://example.com/img3.jpg' },
    { name: 'model-c', display_name: 'Model C', showcases: [] },
  ];

  const apiStub = {
    backendCapabilities: signal({
      writable: true,
      mode: 'PRIMARY' as const,
      canonicalFormat: 'v2' as const,
    }).asReadonly(),
    getDisplayModelsAsArray: vi.fn().mockReturnValue(of(mockRecords as unknown[])),
    getCategoryAudit: vi.fn().mockReturnValue(of(null)),
    getCategoryStatistics: vi.fn().mockReturnValue(of(null)),
  };

  beforeEach(async () => {
    apiStub.getDisplayModelsAsArray.mockReturnValue(of(mockRecords as unknown[]));

    await TestBed.configureTestingModule({
      imports: [AnalyticsShowcasesComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: BASE_PATH, useValue: 'http://localhost:19800/api' },
        { provide: ModelReferenceApiService, useValue: apiStub },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AnalyticsShowcasesComponent);
    nativeEl = fixture.nativeElement;
    fixture.componentRef.setInput('category', 'image_generation');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render showcase gallery grid with images', () => {
    const gallery = nativeEl.querySelector('.showcase-gallery-grid');
    expect(gallery).toBeTruthy();

    // 3 images total (2 from model-a + 1 from model-b)
    const images = nativeEl.querySelectorAll('.card-showcase img');
    expect(images.length).toBe(3);
  });

  it('should show model names on hover overlays', () => {
    expect(nativeEl.textContent).toContain('Model A');
    expect(nativeEl.textContent).toContain('Model B');
  });

  it('should show empty state when no showcases exist', async () => {
    apiStub.getDisplayModelsAsArray.mockReturnValue(of([{ name: 'empty-model' }]));
    fixture = TestBed.createComponent(AnalyticsShowcasesComponent);
    nativeEl = fixture.nativeElement;
    fixture.componentRef.setInput('category', 'image_generation');
    fixture.detectChanges();

    expect(nativeEl.textContent).toContain('No showcase images');
  });

  it('should open lightbox on showcase click', () => {
    const button = nativeEl.querySelector('.card-showcase') as HTMLButtonElement;
    expect(button).toBeTruthy();
    button.click();
    fixture.detectChanges();

    const lightbox = nativeEl.querySelector('.lightbox-scrim');
    expect(lightbox).toBeTruthy();
  });

  it('should close lightbox on close button click', () => {
    // Open lightbox first
    const button = nativeEl.querySelector('.card-showcase') as HTMLButtonElement;
    button.click();
    fixture.detectChanges();

    const closeBtn = nativeEl.querySelector('.lightbox-close') as HTMLButtonElement;
    expect(closeBtn).toBeTruthy();
    closeBtn.click();
    fixture.detectChanges();

    const lightbox = nativeEl.querySelector('.lightbox-scrim');
    expect(lightbox).toBeFalsy();
  });
});
