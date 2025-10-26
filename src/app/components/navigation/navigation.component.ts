import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { ModelReferenceApiService } from '../../services/model-reference-api.service';
import { DarkModeService } from '../../services/dark-mode.service';
import { AuthService } from '../../services/auth.service';
import { LoginModalComponent } from '../login-modal/login-modal.component';

@Component({
  selector: 'app-navigation',
  imports: [LoginModalComponent],
  templateUrl: './navigation.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavigationComponent {
  private readonly router = inject(Router);
  readonly api = inject(ModelReferenceApiService);
  readonly darkMode = inject(DarkModeService);
  readonly auth = inject(AuthService);

  readonly showLoginModal = signal(false);

  goHome(): void {
    this.router.navigate(['/']);
  }

  toggleDarkMode(): void {
    this.darkMode.toggle();
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
