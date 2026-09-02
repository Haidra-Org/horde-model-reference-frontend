import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { BASE_PATH, HeartbeatResponse } from '../../api-client';
import { DeploymentComponent } from './deployment.component';
import { IconRegistryService } from '../../services/icon-registry.service';
import { ModelReferenceApiService } from '../../services/model-reference-api.service';
import { ICON_PATHS } from '../../shared/icon-paths';
import { environment } from '../../../environments/environment';

describe('DeploymentComponent', () => {
  let fixture: ComponentFixture<DeploymentComponent>;
  let nativeEl: HTMLElement;
  let httpMock: HttpTestingController;
  const baseUrl = environment.apiBaseUrl;

  const mockHeartbeat: HeartbeatResponse = {
    status: 'ok',
    ai_horde: {
      degraded: false,
      consecutive_failures: 0,
      seconds_until_retry: null,
    },
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DeploymentComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: BASE_PATH, useValue: baseUrl },
      ],
    }).compileComponents();

    // Register icons so the IconComponent renders in tests
    TestBed.inject(IconRegistryService).registerAll(ICON_PATHS);

    fixture = TestBed.createComponent(DeploymentComponent);
    nativeEl = fixture.nativeElement;
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  /** Helper: trigger init + flush heartbeat HTTP request */
  function initAndFlush(): void {
    fixture.detectChanges();
    const req = httpMock.expectOne(`${baseUrl}/heartbeat`);
    req.flush(mockHeartbeat);
    fixture.detectChanges();
  }

  it('should create', () => {
    initAndFlush();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render the /replicate_mode JSON block', () => {
    initAndFlush();
    const jsonBlock = nativeEl.querySelector('app-json-display');
    expect(jsonBlock).toBeTruthy();
  });

  it('should render capability rows', () => {
    initAndFlush();
    const capRows = nativeEl.querySelectorAll('app-cap-row');
    expect(capRows.length).toBeGreaterThanOrEqual(3);
  });

  it('should render the write-access matrix table', () => {
    initAndFlush();
    const table = nativeEl.querySelector('.deployment-matrix-table');
    expect(table).toBeTruthy();
    // 1 header + 4 data rows
    const rows = table!.querySelectorAll('tr');
    expect(rows.length).toBe(5);
  });

  it('should mark the current deployment row when capabilities are known', () => {
    // Set capabilities to a known state so the matrix highlights the correct row
    const api = TestBed.inject(ModelReferenceApiService);
    api.backendCapabilities.set({
      writable: true,
      mode: 'PRIMARY' as const,
      canonicalFormat: 'legacy' as const,
    });

    initAndFlush();
    const currentRow = nativeEl.querySelector('.deployment-matrix-row--current');
    expect(currentRow).toBeTruthy();
    expect(currentRow!.textContent).toContain('current');
  });

  it('should render the heartbeat panel', () => {
    initAndFlush();
    const heartbeat = nativeEl.querySelector('.deployment-heartbeat');
    expect(heartbeat).toBeTruthy();
    expect(heartbeat!.textContent).toContain('Heartbeat');
  });

  it('should show heartbeat data after fetch (not loading)', () => {
    initAndFlush();
    expect(nativeEl.textContent).not.toContain('Loading heartbeat');
  });

  it('should NOT render a preset switcher (D3)', () => {
    initAndFlush();
    expect(nativeEl.textContent).not.toContain('Preview a deployment configuration');
  });

  it('should show writable status in capability rows', () => {
    initAndFlush();
    const capRows = nativeEl.querySelectorAll('app-cap-row');
    let foundWritable = false;
    capRows.forEach((row) => {
      if (row.textContent?.includes('Writable')) {
        foundWritable = true;
      }
    });
    expect(foundWritable).toBeTruthy();
  });

  it('should render all four matrix rows', () => {
    initAndFlush();
    const rows = nativeEl.querySelectorAll('.deployment-matrix-row');
    expect(rows.length).toBe(4);
  });
});
