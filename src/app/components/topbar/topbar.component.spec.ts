import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal, provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { BASE_PATH } from '../../api-client';
import { TopbarComponent } from './topbar.component';
import { AuthService } from '../../services/auth.service';
import { ShellContextService } from '../../services/shell-context.service';

describe('TopbarComponent', () => {
  let fixture: ComponentFixture<TopbarComponent>;
  let nativeEl: HTMLElement;
  let shellContext: ShellContextService;

  const isAuthenticated = signal(false);
  const username = signal<string | null>(null);
  const isApprover = signal(false);
  const isRequestor = signal(false);
  const logout = vi.fn();

  const authStub = {
    isAuthenticated: isAuthenticated.asReadonly(),
    username: username.asReadonly(),
    isApprover: isApprover.asReadonly(),
    isRequestor: isRequestor.asReadonly(),
    logout,
  };

  beforeEach(async () => {
    isAuthenticated.set(false);
    username.set(null);
    isApprover.set(false);
    isRequestor.set(false);
    logout.mockReset();

    await TestBed.configureTestingModule({
      imports: [TopbarComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: BASE_PATH, useValue: 'http://localhost:19800/api' },
        { provide: AuthService, useValue: authStub },
        ShellContextService,
      ],
    }).compileComponents();

    shellContext = TestBed.inject(ShellContextService);
    fixture = TestBed.createComponent(TopbarComponent);
    nativeEl = fixture.nativeElement;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render the header element', () => {
    const header = nativeEl.querySelector('header.topbar');
    expect(header).toBeTruthy();
  });

  it('should show Sign in button when not authenticated', () => {
    const signInBtn = nativeEl.querySelector('button[aria-label="Sign in"]');
    expect(signInBtn).toBeTruthy();
  });

  it('should show username when authenticated', () => {
    isAuthenticated.set(true);
    username.set('testuser');
    fixture.detectChanges();

    const el = nativeEl.querySelector('.topbar-username');
    expect(el).toBeTruthy();
    expect(el!.textContent).toContain('testuser');
  });

  it('should show Approver badge when user is an approver', () => {
    isAuthenticated.set(true);
    username.set('admin');
    isApprover.set(true);
    fixture.detectChanges();

    const badge = nativeEl.querySelector('.topbar-role-badge--approver');
    expect(badge).toBeTruthy();
    expect(badge!.textContent).toContain('Approver');
  });

  it('should show Requestor badge when user is requestor but not approver', () => {
    isAuthenticated.set(true);
    username.set('user');
    isRequestor.set(true);
    isApprover.set(false);
    fixture.detectChanges();

    const badge = nativeEl.querySelector('.topbar-role-badge--requestor');
    expect(badge).toBeTruthy();
    expect(badge!.textContent).toContain('Requestor');
  });

  it('should render breadcrumb from ShellContextService', () => {
    shellContext.setContext({
      breadcrumb: [
        { label: 'Image', route: ['/categories/image_generation'] },
        { label: 'Browse' },
      ],
      title: 'Model Name',
      actions: [],
    });
    fixture.detectChanges();

    const breadcrumb = nativeEl.querySelector('.topbar-breadcrumb');
    expect(breadcrumb).toBeTruthy();
    const links = breadcrumb!.querySelectorAll('a');
    expect(links.length).toBeGreaterThan(0);
    expect(links[0].textContent).toContain('Image');
  });

  it('should render title from ShellContextService', () => {
    shellContext.setContext({
      breadcrumb: [],
      title: 'Test Page',
      actions: [],
    });
    fixture.detectChanges();

    const title = nativeEl.querySelector('.topbar-title');
    expect(title).toBeTruthy();
    expect(title!.textContent).toContain('Test Page');
  });

  it('should render subtitle when provided', () => {
    shellContext.setContext({
      breadcrumb: [],
      title: 'Test Page',
      sub: 'A subtitle',
      actions: [],
    });
    fixture.detectChanges();

    const sub = nativeEl.querySelector('.topbar-sub');
    expect(sub).toBeTruthy();
    expect(sub!.textContent).toContain('A subtitle');
  });

  it('should render a theme toggle button', () => {
    const themeBtn = nativeEl.querySelector('.topbar-theme-btn');
    expect(themeBtn).toBeTruthy();
  });

  it('should show logout button when authenticated', () => {
    isAuthenticated.set(true);
    username.set('testuser');
    fixture.detectChanges();

    const logoutBtn = nativeEl.querySelector('button[aria-label="Sign out"]');
    expect(logoutBtn).toBeTruthy();
  });

  it('should call auth.logout when logout button clicked', () => {
    isAuthenticated.set(true);
    username.set('testuser');
    fixture.detectChanges();

    const logoutBtn = nativeEl.querySelector('button[aria-label="Sign out"]') as HTMLButtonElement;
    logoutBtn.click();
    expect(logout).toHaveBeenCalled();
  });
});
