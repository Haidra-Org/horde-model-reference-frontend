import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { LoginModalComponent } from '../login-modal/login-modal.component';
import { ShellContextService } from '../../services/shell-context.service';
import { AuthService } from '../../services/auth.service';
import { DarkModeService } from '../../services/dark-mode.service';
import { SidebarService } from '../../services/sidebar.service';

@Component({
  selector: 'app-topbar',
  imports: [RouterLink, LoginModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="topbar glass-overlay">
      <div class="topbar-inner">
        <!-- Mobile sidebar toggle -->
        <button
          type="button"
          class="topbar-mobile-toggle"
          (click)="sidebar.toggle()"
          [attr.aria-expanded]="!sidebar.isCollapsed()"
          [attr.aria-label]="sidebar.isCollapsed() ? 'Open sidebar' : 'Close sidebar'"
          aria-controls="app-sidebar"
        >
          <svg class="topbar-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>

        <!-- Back button -->
        @if (canGoBack()) {
          <button type="button" class="topbar-back-btn" (click)="goBack()" aria-label="Go back">
            <svg class="topbar-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
        }

        <!-- Title area -->
        <div class="topbar-title-area">
          @if (ctx.breadcrumb().length > 0) {
            <nav class="topbar-breadcrumb" aria-label="Breadcrumb">
              @for (segment of ctx.breadcrumb(); track segment.label; let last = $last) {
                @if (!last) {
                  @if (segment.route) {
                    <a [routerLink]="segment.route" class="topbar-breadcrumb-link">{{
                      segment.label
                    }}</a>
                  } @else {
                    <span class="topbar-breadcrumb-text">{{ segment.label }}</span>
                  }
                  <span class="topbar-breadcrumb-sep">·</span>
                } @else {
                  <span class="topbar-breadcrumb-current">{{ segment.label }}</span>
                }
              }
            </nav>
          }
          <h1 class="topbar-title">{{ ctx.title() }}</h1>
          @if (ctx.sub()) {
            <div class="topbar-sub">{{ ctx.sub() }}</div>
          }
        </div>

        <!-- Actions slot -->
        <div class="topbar-actions">
          @for (action of ctx.actions(); track action.id) {
            <button
              type="button"
              class="btn"
              [class.btn-primary]="action.kind === 'primary'"
              [class.btn-ghost]="action.kind !== 'primary'"
              (click)="action.action()"
            >
              @if (action.kind === 'primary') {
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              }
              {{ action.label }}
            </button>
          }
        </div>

        <!-- Identity + role badge -->
        @if (auth.isAuthenticated()) {
          <div class="topbar-identity">
            <span class="topbar-username">{{ auth.username() }}</span>
            <span
              class="topbar-role-badge"
              [class.topbar-role-badge--approver]="auth.isApprover()"
              [class.topbar-role-badge--requestor]="
                auth.isRequestor() && !auth.isApprover() && !auth.isLicenseEditor()
              "
            >
              @if (auth.isApprover()) {
                Approver
              } @else if (auth.isLicenseEditor()) {
                License editor
              } @else if (auth.isRequestor()) {
                Requestor
              } @else {
                Read-only
              }
            </span>
            <button
              type="button"
              class="topbar-logout-btn"
              (click)="auth.logout()"
              aria-label="Sign out"
            >
              Sign out
            </button>
          </div>
        } @else {
          <button
            type="button"
            class="btn btn-ghost"
            (click)="showLoginModal.set(true)"
            aria-label="Sign in"
          >
            Sign in
          </button>
        }

        <!-- Theme toggle -->
        <button
          type="button"
          class="topbar-theme-btn"
          (click)="darkMode.toggle()"
          [attr.aria-label]="darkMode.darkMode() ? 'Switch to light mode' : 'Switch to dark mode'"
          [attr.aria-pressed]="darkMode.darkMode()"
        >
          @if (darkMode.darkMode()) {
            <!-- Sun icon (switch to light) -->
            <svg class="topbar-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
          } @else {
            <!-- Moon icon (switch to dark) -->
            <svg class="topbar-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
              />
            </svg>
          }
        </button>
      </div>
    </header>

    <!-- Login modal -->
    @if (showLoginModal()) {
      <app-login-modal (closed)="showLoginModal.set(false)" />
    }
  `,
  styles: ``,
})
export class TopbarComponent {
  readonly ctx = inject(ShellContextService);
  readonly auth = inject(AuthService);
  readonly darkMode = inject(DarkModeService);
  readonly sidebar = inject(SidebarService);
  private readonly location = inject(Location);
  private readonly router = inject(Router);

  readonly showLoginModal = signal(false);

  // The first completed route is the landing page, not evidence of in-app history.
  // Only reveal Back after a subsequent client-side navigation.
  private navigated = signal(false);

  readonly canGoBack = computed(() => this.navigated());

  constructor() {
    let completedNavigations = 0;
    this.router.events.subscribe((event) => {
      if (event.constructor.name === 'NavigationEnd') {
        completedNavigations++;
        this.navigated.set(completedNavigations > 1);
      }
    });
  }

  goBack(): void {
    this.location.back();
  }
}
