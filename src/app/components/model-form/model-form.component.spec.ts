import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReplaySubject, of } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';

import { ModelFormComponent } from './model-form.component';
import { ModelReferenceApiService } from '../../services/model-reference-api.service';
import { NotificationService } from '../../services/notification.service';

class MockModelReferenceApiService {
  createLegacyModel = vi.fn().mockReturnValue(of({}));
  updateLegacyModel = vi.fn().mockReturnValue(of({}));
  deleteModel = vi.fn().mockReturnValue(of({}));
  getLegacyModelsInCategory = vi.fn().mockReturnValue(of({}));
}

class MockNotificationService {
  error = vi.fn();
  success = vi.fn();
}

class MockRouter {
  navigate = vi.fn();
}

describe('ModelFormComponent (exploded variations)', () => {
  let fixture: ComponentFixture<ModelFormComponent>;
  let component: ModelFormComponent;
  let params$: ReplaySubject<Record<string, string>>;

  beforeEach(async () => {
    params$ = new ReplaySubject<Record<string, string>>(1);

    await TestBed.configureTestingModule({
      imports: [ModelFormComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: ModelReferenceApiService, useClass: MockModelReferenceApiService },
        { provide: NotificationService, useClass: MockNotificationService },
        { provide: Router, useClass: MockRouter },
        { provide: ActivatedRoute, useValue: { params: params$.asObservable() } },
      ],
    })
      .overrideComponent(ModelFormComponent, {
        set: { template: '' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ModelFormComponent);
    component = fixture.componentInstance;

    params$.next({ category: 'text_generation' });
    fixture.detectChanges();
  });

  function switchToJsonView(): void {
    if (component.viewMode() === 'form') {
      component.toggleViewMode();
    }
  }

  it('updates exploded variations when JSON editor content changes', () => {
    component.form.get('name')?.setValue('base-model');
    switchToJsonView();

    const jsonControl = component.form.get('jsonData');
    const currentJson = JSON.parse(jsonControl?.value ?? '{}');
    currentJson.description = 'Updated description';

    jsonControl?.setValue(JSON.stringify(currentJson, null, 2));

    expect(component.explodedVariationsJson()).toContain('Updated description');
  });

  it('updates variation names when the base model name changes', () => {
    component.form.get('name')?.setValue('base-model');

    const initialNames = component.modelVariations().map((variation) => variation.name);

    component.form.get('name')?.setValue('renamed-model');

    const updatedNames = component.modelVariations().map((variation) => variation.name);

    expect(initialNames.every((name: string) => name.includes('base-model'))).toBe(true);
    expect(updatedNames.length).toBeGreaterThan(1);
    expect(updatedNames.every((name: string) => name.includes('renamed-model'))).toBe(true);
    expect(
      updatedNames.some((name: string) => name.startsWith('aphrodite/renamed-model')),
    ).toBe(true);
  });
});
