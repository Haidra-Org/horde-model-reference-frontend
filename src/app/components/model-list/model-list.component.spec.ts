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
import { LegacyRecordUnion } from '../../models';
import { HordeModelType } from '../../models/horde-api.models';
import { StatisticsService } from '../../api-client';

class MockNotificationService {
  readonly error = jasmine.createSpy('error');
  readonly warning = jasmine.createSpy('warning');
  readonly success = jasmine.createSpy('success');
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

  getLegacyModelsAsArray(category: string) {
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
    expect(component.models().some((model) => model.name.includes('text'))).toBeTrue();

    api.emit('image_generation', [imageModel]);
    fixture.detectChanges();

    expect(component.category()).toBe('text_generation');
    expect(component.models().some((model) => model.name === 'image-alpha')).toBeFalse();
  });
});
