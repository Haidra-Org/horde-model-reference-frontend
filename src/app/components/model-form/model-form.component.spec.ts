import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReplaySubject, of } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';

import { ModelFormComponent } from './model-form.component';
import { ModelReferenceApiService } from '../../services/model-reference-api.service';
import { NotificationService } from '../../services/notification.service';
import { PendingQueueSummaryService } from '../../services/pending-queue-summary.service';

class MockModelReferenceApiService {
  createLegacyModel = vi.fn().mockReturnValue(of({}));
  updateLegacyModel = vi.fn().mockReturnValue(of({}));
  deleteModel = vi.fn().mockReturnValue(of({}));
  getLegacyModelsInCategory = vi.fn().mockReturnValue(of({}));
  backendCapabilities = vi.fn().mockReturnValue({
    writable: true,
    canonicalFormat: 'legacy',
    mode: 'PRIMARY',
  });
}

class MockNotificationService {
  error = vi.fn();
  success = vi.fn();
}

class MockRouter {
  navigate = vi.fn();
  getCurrentNavigation = vi.fn().mockReturnValue(null);
}

class MockPendingQueueSummaryService {
  pendingCountFor = vi.fn().mockReturnValue(0);
  records = vi.fn().mockReturnValue([]);
  totalPendingCount = vi.fn().mockReturnValue(0);
  startPolling = vi.fn();
  stopPolling = vi.fn();
}

describe('ModelFormComponent', () => {
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
        { provide: PendingQueueSummaryService, useClass: MockPendingQueueSummaryService },
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

  it('initializes form in create mode for text_generation', () => {
    expect(component.form).toBeTruthy();
    expect(component.isEditMode()).toBe(false);
    expect(component.category()).toBe('text_generation');
    expect(component.form.get('name')).toBeTruthy();
  });

  it('syncs JSON view when toggling view mode', () => {
    component.form.get('name')?.setValue('test-model');
    component.toggleViewMode();

    expect(component.viewMode()).toBe('json');
    const jsonControl = component.form.get('jsonData');
    expect(jsonControl).toBeTruthy();

    // name is intentionally excluded from JSON data (shown separately)
    const jsonValue = JSON.parse(jsonControl?.value ?? '{}');
    expect(jsonValue.name).toBeUndefined();
    expect(typeof jsonValue).toBe('object');
  });
});
