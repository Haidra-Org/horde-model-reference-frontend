import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ModelReferenceApiService } from '../../services/model-reference-api.service';
import { AuthService } from '../../services/auth.service';
import { LoginModalComponent } from '../login-modal/login-modal.component';
import { ThemeSwitcherComponent } from '../common/theme-switcher.component';

@Component({
  selector: 'app-navigation',
  imports: [LoginModalComponent, RouterLink, ThemeSwitcherComponent],
  templateUrl: './navigation.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavigationComponent {
  private readonly router = inject(Router);
  readonly api = inject(ModelReferenceApiService);
  readonly auth = inject(AuthService);

  readonly showLoginModal = signal(false);
  readonly showHelpMenu = signal(false);

  goHome(): void {
    this.router.navigate(['/']);
  }

  toggleHelpMenu(): void {
    this.showHelpMenu.update((v) => !v);
  }

  closeHelpMenu(): void {
    this.showHelpMenu.set(false);
  }

  openLoginModal(): void {
    this.showLoginModal.set(true);
  }

  closeLoginModal(): void {
    this.showLoginModal.set(false);
  }

  logout(): void {
    this.auth.logout();
  }
}
