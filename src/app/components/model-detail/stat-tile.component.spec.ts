import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { StatTileComponent } from './stat-tile.component';

describe('StatTileComponent', () => {
  let fixture: ComponentFixture<StatTileComponent>;
  let nativeEl: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StatTileComponent],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();

    fixture = TestBed.createComponent(StatTileComponent);
    nativeEl = fixture.nativeElement;
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render label and value', () => {
    fixture.componentRef.setInput('label', 'Workers');
    fixture.componentRef.setInput('value', '42');
    fixture.detectChanges();

    expect(nativeEl.textContent).toContain('Workers');
    expect(nativeEl.textContent).toContain('42');
  });

  it('should render sub when provided', () => {
    fixture.componentRef.setInput('label', 'Usage 30d');
    fixture.componentRef.setInput('value', '1.2M');
    fixture.componentRef.setInput('sub', '5M all-time');
    fixture.detectChanges();

    expect(nativeEl.textContent).toContain('5M all-time');
  });

  it('should not render sub when not provided', () => {
    fixture.componentRef.setInput('label', 'Test');
    fixture.componentRef.setInput('value', '0');
    fixture.detectChanges();

    const subEl = nativeEl.querySelector('.stat-tile-sub');
    expect(subEl).toBeFalsy();
  });

  it('should apply accent color via CSS custom property', () => {
    fixture.componentRef.setInput('label', 'Test');
    fixture.componentRef.setInput('value', '1');
    fixture.componentRef.setInput('accent', '#1d4ed8');
    fixture.detectChanges();

    const tile = nativeEl.querySelector('.stat-tile') as HTMLElement;
    expect(tile.style.getPropertyValue('--stat-accent')).toBe('#1d4ed8');
  });

  it('should render icon SVG when icon path is provided', () => {
    fixture.componentRef.setInput('label', 'Test');
    fixture.componentRef.setInput('value', '1');
    fixture.componentRef.setInput('icon', 'M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25');
    fixture.detectChanges();

    const svg = nativeEl.querySelector('.stat-tile-icon svg');
    expect(svg).toBeTruthy();
  });
});
