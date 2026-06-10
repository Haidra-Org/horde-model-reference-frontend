import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { CapRowComponent } from './cap-row.component';
import { IconRegistryService } from '../../services/icon-registry.service';
import { ICON_PATHS } from '../../shared/icon-paths';

describe('CapRowComponent', () => {
  let fixture: ComponentFixture<CapRowComponent>;
  let nativeEl: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CapRowComponent],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();

    // Register all icons so the IconComponent can resolve them
    TestBed.inject(IconRegistryService).registerAll(ICON_PATHS);

    fixture = TestBed.createComponent(CapRowComponent);
    nativeEl = fixture.nativeElement;
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should display label, value, and desc', () => {
    fixture.componentRef.setInput('ok', true);
    fixture.componentRef.setInput('label', 'Replicate mode');
    fixture.componentRef.setInput('value', 'PRIMARY');
    fixture.componentRef.setInput('desc', 'Authoritative — accepts writes');
    fixture.detectChanges();

    expect(nativeEl.textContent).toContain('Replicate mode');
    expect(nativeEl.textContent).toContain('PRIMARY');
    expect(nativeEl.textContent).toContain('Authoritative');
  });

  it('should render an icon element', () => {
    fixture.componentRef.setInput('ok', true);
    fixture.componentRef.setInput('label', 'Test');
    fixture.componentRef.setInput('value', 'true');
    fixture.componentRef.setInput('desc', 'desc');
    fixture.detectChanges();

    const icon = nativeEl.querySelector('app-icon');
    expect(icon).toBeTruthy();
  });

  it('should render an icon when ok is false', () => {
    fixture.componentRef.setInput('ok', false);
    fixture.componentRef.setInput('label', 'Test');
    fixture.componentRef.setInput('value', 'false');
    fixture.componentRef.setInput('desc', 'desc');
    fixture.detectChanges();

    const icon = nativeEl.querySelector('app-icon');
    expect(icon).toBeTruthy();
  });

  it('should render an icon when neutral is true', () => {
    fixture.componentRef.setInput('ok', true);
    fixture.componentRef.setInput('neutral', true);
    fixture.componentRef.setInput('label', 'Test');
    fixture.componentRef.setInput('value', 'test');
    fixture.componentRef.setInput('desc', 'desc');
    fixture.detectChanges();

    const icon = nativeEl.querySelector('app-icon');
    expect(icon).toBeTruthy();
  });

  it('should render value with badge styling', () => {
    fixture.componentRef.setInput('ok', true);
    fixture.componentRef.setInput('label', 'Mode');
    fixture.componentRef.setInput('value', 'PRIMARY');
    fixture.componentRef.setInput('desc', 'desc');
    fixture.detectChanges();

    const valueEl = nativeEl.querySelector('.cap-row-value');
    expect(valueEl).toBeTruthy();
    expect(valueEl!.textContent).toContain('PRIMARY');
  });
});
