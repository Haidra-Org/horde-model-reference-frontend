import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { CopyButtonComponent } from './copy-button.component';
import { Clipboard } from '@angular/cdk/clipboard';

describe('CopyButtonComponent', () => {
  let fixture: ComponentFixture<CopyButtonComponent>;
  let nativeEl: HTMLElement;

  const clipboardCopy = vi.fn();
  const clipboardStub = { copy: clipboardCopy };

  beforeEach(async () => {
    clipboardCopy.mockReset();

    await TestBed.configureTestingModule({
      imports: [CopyButtonComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: Clipboard, useValue: clipboardStub },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CopyButtonComponent);
    nativeEl = fixture.nativeElement;
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render the default label', () => {
    fixture.componentRef.setInput('text', 'hello');
    fixture.detectChanges();
    expect(nativeEl.textContent).toContain('Copy');
  });

  it('should use custom label', () => {
    fixture.componentRef.setInput('text', 'hello');
    fixture.componentRef.setInput('label', 'Duplicate');
    fixture.detectChanges();
    expect(nativeEl.textContent).toContain('Duplicate');
  });

  it('should copy text to clipboard on click', () => {
    fixture.componentRef.setInput('text', 'hello-world');
    fixture.detectChanges();

    const btn = nativeEl.querySelector('button')!;
    btn.click();
    fixture.detectChanges();

    expect(clipboardCopy).toHaveBeenCalledWith('hello-world');
  });

  it('should show copied state after click', () => {
    fixture.componentRef.setInput('text', 'test');
    fixture.componentRef.setInput('copiedLabel', 'Done');
    fixture.detectChanges();

    const btn = nativeEl.querySelector('button')!;
    btn.click();
    fixture.detectChanges();

    expect(nativeEl.textContent).toContain('Done');
    expect(btn.classList.contains('copy-button--copied')).toBe(true);
  });

  it('should set aria-label when provided', () => {
    fixture.componentRef.setInput('text', 'test');
    fixture.componentRef.setInput('ariaLabel', 'Copy identifier');
    fixture.detectChanges();

    const btn = nativeEl.querySelector('button')!;
    expect(btn.getAttribute('aria-label')).toBe('Copy identifier');
  });
});
