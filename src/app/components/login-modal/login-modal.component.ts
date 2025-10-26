import { Component, inject, output, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login-modal',
  imports: [FormsModule],
  templateUrl: './login-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginModalComponent {
  private readonly authService = inject(AuthService);

  readonly close = output<void>();

  readonly apiKey = signal('');
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  onSubmit(): void {
    this.error.set(null);
    this.loading.set(true);

    this.authService.login(this.apiKey()).subscribe({
      next: () => {
        this.loading.set(false);
        this.close.emit();
      },
      error: (err: Error) => {
        this.loading.set(false);
        this.error.set(err.message);
      },
    });
  }

  onCancel(): void {
    this.close.emit();
  }
}
