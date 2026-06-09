import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal, provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { BASE_PATH } from '../../api-client';
import { SidebarComponent } from './sidebar.component';
import { AuthService } from '../../services/auth.service';
import { PendingQueueSummaryService } from '../../services/pending-queue-summary.service';

describe('SidebarComponent', () => {
  let fixture: ComponentFixture<SidebarComponent>;
  let nativeEl: HTMLElement;

  const isApprover = signal(false);
  const isRequestor = signal(false);

  const authStub = {
    isAuthenticated: signal(false).asReadonly(),
    isApprover: isApprover.asReadonly(),
    isRequestor: isRequestor.asReadonly(),
  };

  const pendingStub = {
    totalPendingCount: signal(0).asReadonly(),
    startPolling: vi.fn(),
    clear: vi.fn(),
    pendingCountFor: vi.fn().mockReturnValue(0),
  };

  beforeEach(async () => {
    isApprover.set(false);
    isRequestor.set(false);

    await TestBed.configureTestingModule({
      imports: [SidebarComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: BASE_PATH, useValue: 'http://localhost:19800/api' },
        { provide: AuthService, useValue: authStub },
        { provide: PendingQueueSummaryService, useValue: pendingStub },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SidebarComponent);
    nativeEl = fixture.nativeElement;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render the sidebar aside with aria-label Primary', () => {
    const aside = nativeEl.querySelector('aside#app-sidebar[aria-label="Primary"]');
    expect(aside).toBeTruthy();
  });

  it('should render the three feature groups: Catalog, Contribute, System', () => {
    const groupTitles = nativeEl.querySelectorAll('.sidebar-feature-group-title');
    const titles = Array.from(groupTitles).map((el) => el.textContent?.trim());
    expect(titles).toContain('Catalog');
    expect(titles).toContain('Contribute');
    expect(titles).toContain('System');
  });

  it('should render Browse models link pointing to the default category', () => {
    const browseLink = nativeEl.querySelector('a[href="/categories/image_generation"]');
    expect(browseLink).toBeTruthy();
    const label = browseLink?.querySelector('.sidebar-feature-item-label');
    expect(label?.textContent?.trim()).toBe('Browse models');
  });

  it('should render Text groups link', () => {
    const link = nativeEl.querySelector('a[href="/text-groups"]');
    expect(link).toBeTruthy();
  });

  it('should render Analytics link', () => {
    const link = nativeEl.querySelector('a[href*="/analytics"]');
    expect(link).toBeTruthy();
  });

  it('should render Deployment link', () => {
    const link = nativeEl.querySelector('a[href="/deployment"]');
    expect(link).toBeTruthy();
  });

  it('should render API & docs link', () => {
    const link = nativeEl.querySelector('a[href="/api-docs"]');
    expect(link).toBeTruthy();
  });

  it('should disable Propose a change when user cannot write', () => {
    const disabledItems = nativeEl.querySelectorAll('.sidebar-feature-item--disabled');
    const proposeDisabled = Array.from(disabledItems).find(
      (el) =>
        el.querySelector('.sidebar-feature-item-label')?.textContent?.trim() === 'Propose a change',
    );
    expect(proposeDisabled).toBeTruthy();
  });

  it('should disable Review queue when user is not an approver', () => {
    const disabledItems = nativeEl.querySelectorAll('.sidebar-feature-item--disabled');
    const queueDisabled = Array.from(disabledItems).find(
      (el) =>
        el.querySelector('.sidebar-feature-item-label')?.textContent?.trim() === 'Review queue',
    );
    expect(queueDisabled).toBeTruthy();
  });

  it('should render the backend status chip in the footer', () => {
    const footer = nativeEl.querySelector('.sidebar-footer');
    expect(footer).toBeTruthy();
    const chip = footer?.querySelector('app-backend-status-chip');
    expect(chip).toBeTruthy();
  });

  it('should render the Haidra logo and brand', () => {
    const brandTitle = nativeEl.querySelector('.sidebar-brand-title');
    expect(brandTitle).toBeTruthy();
    expect(brandTitle!.textContent).toContain('Model Reference');
    const brandSub = nativeEl.querySelector('.sidebar-brand-sub');
    expect(brandSub).toBeTruthy();
    expect(brandSub!.textContent).toContain('AI Horde');
  });
});
