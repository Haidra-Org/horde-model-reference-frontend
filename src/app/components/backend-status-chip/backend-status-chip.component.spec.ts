import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { BASE_PATH } from '../../api-client';
import { BackendStatusChipComponent } from './backend-status-chip.component';

describe('BackendStatusChipComponent', () => {
  let fixture: ComponentFixture<BackendStatusChipComponent>;
  let nativeEl: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BackendStatusChipComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: BASE_PATH, useValue: 'http://localhost:19800/api' },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BackendStatusChipComponent);
    nativeEl = fixture.nativeElement;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render a link to /deployment', () => {
    const link = nativeEl.querySelector('a[href="/deployment"]');
    expect(link).toBeTruthy();
  });

  it('should show mode and format', () => {
    const info = nativeEl.querySelector('.backend-chip-info');
    expect(info).toBeTruthy();
    expect(info!.textContent).toContain('UNKNOWN');
  });

  it('should show READ-ONLY pill by default', () => {
    const pill = nativeEl.querySelector('.backend-chip-pill--readonly');
    expect(pill).toBeTruthy();
    expect(pill!.textContent).toContain('READ-ONLY');
  });

  it('should have a descriptive aria-label', () => {
    const chip = nativeEl.querySelector('.backend-chip');
    expect(chip).toBeTruthy();
    const label = chip!.getAttribute('aria-label');
    expect(label).toContain('Backend');
    expect(label).toContain('read-only');
  });

  it('should show the read-only status dot', () => {
    const dot = nativeEl.querySelector('.backend-chip-dot--readonly');
    expect(dot).toBeTruthy();
  });
});
