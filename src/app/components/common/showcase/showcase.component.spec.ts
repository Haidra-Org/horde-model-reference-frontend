import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { BASE_PATH } from '../../../api-client';
import { ShowcaseComponent } from './showcase.component';

describe('ShowcaseComponent', () => {
  let fixture: ComponentFixture<ShowcaseComponent>;
  let nativeEl: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShowcaseComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: BASE_PATH, useValue: 'http://localhost:19800/api' },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ShowcaseComponent);
    nativeEl = fixture.nativeElement;
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render image when src is provided', () => {
    fixture.componentRef.setInput('src', 'https://example.com/img.png');
    fixture.componentRef.setInput('alt', 'Test image');
    fixture.componentRef.setInput('name', 'test-model');
    fixture.detectChanges();

    const img = nativeEl.querySelector('img');
    expect(img).toBeTruthy();
    expect(img!.getAttribute('alt')).toBe('Test image');
  });

  it('should render gradient fallback when src is null', () => {
    fixture.componentRef.setInput('src', null);
    fixture.componentRef.setInput('name', 'my-model');
    fixture.detectChanges();

    const fallback = nativeEl.querySelector('.showcase-fallback');
    expect(fallback).toBeTruthy();
    expect(fallback!.getAttribute('role')).toBe('img');
  });

  it('should render initials in fallback', () => {
    fixture.componentRef.setInput('src', null);
    fixture.componentRef.setInput('name', 'StableDiffusion');
    fixture.detectChanges();

    const initials = nativeEl.querySelector('.showcase-initials');
    expect(initials).toBeTruthy();
    expect(initials!.textContent).toContain('ST');
  });

  it('should fall back to gradient on image error', () => {
    fixture.componentRef.setInput('src', 'https://example.com/broken.png');
    fixture.componentRef.setInput('name', 'test');
    fixture.detectChanges();

    const img = nativeEl.querySelector('img')!;
    img.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    const fallback = nativeEl.querySelector('.showcase-fallback');
    expect(fallback).toBeTruthy();
  });

  it('should generate deterministic gradient based on name', () => {
    fixture.componentRef.setInput('src', null);
    fixture.componentRef.setInput('name', 'specific-model');
    fixture.detectChanges();

    const fallback = nativeEl.querySelector('.showcase-fallback') as HTMLElement;
    const bg1 = fallback.style.background;

    // Same name = same gradient
    fixture.componentRef.setInput('src', null);
    fixture.componentRef.setInput('name', 'specific-model');
    fixture.detectChanges();
    const fallback2 = nativeEl.querySelector('.showcase-fallback') as HTMLElement;
    expect(fallback2.style.background).toBe(bg1);
  });
});
