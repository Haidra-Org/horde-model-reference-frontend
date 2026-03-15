import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { BehaviorSubject, EMPTY, Observable, Subject } from 'rxjs';
import { ModelListComponent } from './model-list.component';
import { ModelReferenceApiService } from '../../services/model-reference-api.service';
import { NotificationService } from '../../services/notification.service';
import {
  HordeApiService,
  BackendStatisticsResponse,
  HordeStatsState,
} from '../../services/horde-api.service';
import { AuthService } from '../../services/auth.service';
import { PendingQueueSummaryService } from '../../services/pending-queue-summary.service';
import { LegacyRecordUnion } from '../../models';
import { HordeModelType } from '../../models/horde-api.models';
import { StatisticsService } from '../../api-client';

class MockNotificationService {
  readonly error = vi.fn();
  readonly warning = vi.fn();
  readonly success = vi.fn();
}

class MockAuthService {
  isAuthenticated(): boolean {
    return false;
  }
}

class MockModelReferenceApiService {
  readonly backendCapabilities = signal({
    writable: false,
    mode: 'UNKNOWN',
    canonicalFormat: 'legacy',
  });
  private readonly subjects = new Map<string, Subject<LegacyRecordUnion[]>>();

  getDisplayModelsAsArray(category: string) {
    let subject = this.subjects.get(category);
    if (!subject) {
      subject = new Subject<LegacyRecordUnion[]>();
      this.subjects.set(category, subject);
    }
    return subject.asObservable();
  }

  emit(category: string, models: LegacyRecordUnion[]): void {
    const subject = this.subjects.get(category);
    subject?.next(models);
  }
}

class MockHordeApiService {
  private readonly statsState = signal<HordeStatsState>('idle');
  readonly hordeStatsState = () => this.statsState();
  private readonly subjects = new Map<HordeModelType, Subject<BackendStatisticsResponse>>();

  resetStatsState(): void {
    this.statsState.set('idle');
  }

  getCombinedModelData(type: HordeModelType) {
    this.statsState.set('loading');
    let subject = this.subjects.get(type);
    if (!subject) {
      subject = new Subject<BackendStatisticsResponse>();
      this.subjects.set(type, subject);
    }
    return subject.asObservable();
  }

  emit(type: HordeModelType, stats: BackendStatisticsResponse): void {
    const subject = this.subjects.get(type);
    if (subject) {
      subject.next(stats);
      this.statsState.set('success');
    }
  }
}

class MockStatisticsService {
  readV2CategoryStatistics(): Observable<unknown> {
    return EMPTY;
  }
}

class MockPendingQueueSummaryService {
  readonly records = signal<unknown[]>([]);
  readonly totalPendingCount = signal(0);
  readonly pendingCountByCategory = signal(new Map<string, number>());
  readonly loading = signal(false);
  readonly lastRefreshed = signal<Date | null>(null);
  startPolling(): void { /* empty */ }
  stopPolling(): void { /* empty */ }
  clear(): void { /* empty */ }
  refresh(): void { /* empty */ }
  pendingCountFor(): number {
    return 0;
  }
}

describe('ModelListComponent race conditions', () => {
  let fixture: ComponentFixture<ModelListComponent>;
  let component: ModelListComponent;
  let api: MockModelReferenceApiService;
  let paramsSubject: BehaviorSubject<{ category: string }>;

  beforeEach(async () => {
    paramsSubject = new BehaviorSubject<{ category: string }>({ category: 'image_generation' });

    await TestBed.configureTestingModule({
      imports: [ModelListComponent, RouterTestingModule],
      providers: [
        provideZonelessChangeDetection(),
        { provide: ModelReferenceApiService, useClass: MockModelReferenceApiService },
        { provide: HordeApiService, useClass: MockHordeApiService },
        { provide: NotificationService, useClass: MockNotificationService },
        { provide: AuthService, useClass: MockAuthService },
        { provide: StatisticsService, useClass: MockStatisticsService },
        { provide: PendingQueueSummaryService, useClass: MockPendingQueueSummaryService },
        { provide: ActivatedRoute, useValue: { params: paramsSubject.asObservable() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ModelListComponent);
    component = fixture.componentInstance;
    api = TestBed.inject(ModelReferenceApiService) as unknown as MockModelReferenceApiService;
  });

  it('keeps latest category data when earlier requests resolve later', () => {
    const imageModel = {
      name: 'image-alpha',
      description: 'Image baseline',
      baseline: 'stable_diffusion',
    } as LegacyRecordUnion;

    const textModel = {
      name: 'text-beta',
      description: 'Text baseline',
      baseline: 'llama',
      tags: ['alpaca'],
      parameters: 7_000_000_000,
    } as LegacyRecordUnion;

    fixture.detectChanges();

    paramsSubject.next({ category: 'text_generation' });
    fixture.detectChanges();

    api.emit('text_generation', [textModel]);
    fixture.detectChanges();

    expect(component.category()).toBe('text_generation');
    expect(component.models().some((model) => model.name.includes('text'))).toBe(true);

    api.emit('image_generation', [imageModel]);
    fixture.detectChanges();

    expect(component.category()).toBe('text_generation');
    expect(component.models().some((model) => model.name === 'image-alpha')).toBe(false);
  });
});

describe('ModelListComponent grouped model routing', () => {
  let fixture: ComponentFixture<ModelListComponent>;
  let component: ModelListComponent;
  let paramsSubject: BehaviorSubject<{ category: string }>;
  let routerSpy: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    paramsSubject = new BehaviorSubject<{ category: string }>({ category: 'text_generation' });

    await TestBed.configureTestingModule({
      imports: [ModelListComponent, RouterTestingModule],
      providers: [
        provideZonelessChangeDetection(),
        { provide: ModelReferenceApiService, useClass: MockModelReferenceApiService },
        { provide: HordeApiService, useClass: MockHordeApiService },
        { provide: NotificationService, useClass: MockNotificationService },
        { provide: AuthService, useClass: MockAuthService },
        { provide: StatisticsService, useClass: MockStatisticsService },
        { provide: PendingQueueSummaryService, useClass: MockPendingQueueSummaryService },
        { provide: ActivatedRoute, useValue: { params: paramsSubject.asObservable() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ModelListComponent);
    component = fixture.componentInstance;

    routerSpy = { navigate: vi.fn().mockResolvedValue(true) };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (component as any).router = routerSpy;
  });

  it('editModel navigates to group view for grouped text models', () => {
    fixture.detectChanges();

    // Inject a grouped model into the models signal
    component['models'].set([
      {
        name: 'Llama-3',
        isGrouped: true,
        variations: [],
        availableBackends: [],
        availableAuthors: [],
        description: '',
        baseline: '',
      } as unknown as import('../../models/unified-model').GroupedTextModel,
    ]);

    component.editModel('Llama-3');

    expect(routerSpy.navigate).toHaveBeenCalledWith([
      '/categories',
      'text_generation',
      'group',
      'Llama-3',
    ]);
  });

  it('editModel navigates to edit view for ungrouped models', () => {
    fixture.detectChanges();

    component['models'].set([
      {
        name: 'Regular-Model',
        description: '',
        baseline: '',
      } as LegacyRecordUnion,
    ]);

    component.editModel('Regular-Model');

    expect(routerSpy.navigate).toHaveBeenCalledWith([
      '/categories',
      'text_generation',
      'edit',
      'Regular-Model',
    ]);
  });

  it('confirmDelete navigates to group view for grouped text models', () => {
    fixture.detectChanges();

    component['models'].set([
      {
        name: 'Llama-3',
        isGrouped: true,
        variations: [],
        availableBackends: [],
        availableAuthors: [],
        description: '',
        baseline: '',
      } as unknown as import('../../models/unified-model').GroupedTextModel,
    ]);

    component.confirmDelete('Llama-3');

    expect(routerSpy.navigate).toHaveBeenCalledWith([
      '/categories',
      'text_generation',
      'group',
      'Llama-3',
    ]);
    expect(component.modelToDelete()).toBeNull();
  });

  it('confirmDelete sets modelToDelete for ungrouped models', () => {
    fixture.detectChanges();

    component['models'].set([
      {
        name: 'Regular-Model',
        description: '',
        baseline: '',
      } as LegacyRecordUnion,
    ]);

    component.confirmDelete('Regular-Model');

    expect(routerSpy.navigate).not.toHaveBeenCalled();
    expect(component.modelToDelete()).toBe('Regular-Model');
  });
});
