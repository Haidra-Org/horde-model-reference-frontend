import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { EditSummaryComponent } from './edit-summary.component';

describe('EditSummaryComponent', () => {
  let fixture: ComponentFixture<EditSummaryComponent>;
  let component: EditSummaryComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditSummaryComponent],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();

    fixture = TestBed.createComponent(EditSummaryComponent);
    component = fixture.componentInstance;
  });

  it('sets dialog role and aria attributes on the dialog element', () => {
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();

    const dialog = fixture.nativeElement.querySelector('.edit-summary-dialog') as HTMLElement | null;
    expect(dialog?.getAttribute('role')).toBe('dialog');
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(dialog?.getAttribute('tabindex')).toBe('-1');
  });

  it('focuses the dialog when opened', async () => {
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();

    await Promise.resolve(); // flush queueMicrotask
    const dialog = fixture.nativeElement.querySelector('.edit-summary-dialog') as HTMLElement | null;
    expect(document.activeElement).toBe(dialog);
  });

  it('emits dismiss when Escape is pressed inside the dialog', () => {
    const dismissSpy = vi.fn();
    component.dismissed.subscribe(dismissSpy);

    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();

    const dialog = fixture.nativeElement.querySelector('.edit-summary-dialog') as HTMLElement | null;
    dialog?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(dismissSpy).toHaveBeenCalled();
  });
});
