import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal, provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { BASE_PATH } from '../../api-client';
import { SidebarComponent } from './sidebar.component';
import { PendingQueueSummaryService } from '../../services/pending-queue-summary.service';
import { ViewerCapabilitiesService } from '../../services/viewer-capabilities.service';

describe('SidebarComponent', () => {
  let fixture: ComponentFixture<SidebarComponent>;
  let nativeEl: HTMLElement;

  const canPropose = signal(false);
  const canApprove = signal(false);

  // The sidebar's contract is with ViewerCapabilitiesService, so that is the seam the
  // test drives. Auth and backend mode are its inputs, not the sidebar's.
  const viewerStub = {
    canPropose: canPropose.asReadonly(),
    canApprove: canApprove.asReadonly(),
    canSeeCuration: signal(false).asReadonly(),
    canEditLicensing: signal(false).asReadonly(),
  };

  /** Labels of the nav entries currently rendered, in order. */
  const renderedLabels = (): string[] =>
    Array.from(nativeEl.querySelectorAll('.sidebar-feature-item-label')).map(
      (el) => el.textContent?.trim() ?? '',
    );

  const renderedGroups = (): string[] =>
    Array.from(nativeEl.querySelectorAll('.sidebar-feature-group-title')).map(
      (el) => el.textContent?.trim() ?? '',
    );

  const pendingStub = {
    totalPendingCount: signal(0).asReadonly(),
    startPolling: vi.fn(),
    clear: vi.fn(),
    pendingCountFor: vi.fn().mockReturnValue(0),
  };

  beforeEach(async () => {
    canPropose.set(false);
    canApprove.set(false);

    await TestBed.configureTestingModule({
      imports: [SidebarComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: BASE_PATH, useValue: 'http://localhost:19800/api' },
        { provide: ViewerCapabilitiesService, useValue: viewerStub },
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

  it('should render only the publicly visible groups for a visitor', () => {
    expect(renderedGroups()).toEqual(['Catalog', 'Developers']);
  });

  it('should render the Curation group once the viewer may contribute', async () => {
    canPropose.set(true);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(renderedGroups()).toEqual(['Catalog', 'Curation', 'Developers']);
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

  it('should omit every curation entry for a visitor rather than disabling it', () => {
    expect(renderedLabels()).not.toContain('Propose a change');
    expect(renderedLabels()).not.toContain('Families & aliases');
    expect(renderedLabels()).not.toContain('Review queue');
    // Contribution is allowlist-controlled, so a greyed-out entry would be a door the
    // viewer can never open.
    expect(nativeEl.querySelectorAll('.sidebar-feature-item--disabled')).toHaveLength(0);
  });

  it('should reveal contributor entries but not the review queue for a contributor', async () => {
    canPropose.set(true);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(renderedLabels()).toContain('Propose a change');
    expect(renderedLabels()).toContain('Families & aliases');
    expect(renderedLabels()).not.toContain('Review queue');
  });

  it('should reveal the review queue only for an approver', async () => {
    canPropose.set(true);
    canApprove.set(true);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(renderedLabels()).toContain('Review queue');
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
