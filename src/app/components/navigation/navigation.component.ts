import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ModelReferenceApiService } from '../../services/model-reference-api.service';
import { DarkModeService } from '../../services/dark-mode.service';
import { AuthService } from '../../services/auth.service';
import { LoginModalComponent } from '../login-modal/login-modal.component';

@Component({
  selector: 'app-navigation',
  imports: [LoginModalComponent, RouterLink],
  templateUrl: './navigation.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavigationComponent {
  private readonly router = inject(Router);
  readonly api = inject(ModelReferenceApiService);
  readonly darkMode = inject(DarkModeService);
  readonly auth = inject(AuthService);

  readonly showLoginModal = signal(false);
  readonly showHelpMenu = signal(false);

  goHome(): void {
    this.router.navigate(['/']);
  }

  toggleDarkMode(): void {
    this.darkMode.toggle();
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
