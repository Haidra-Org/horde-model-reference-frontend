import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { ModelReferenceApiService } from '../../services/model-reference-api.service';
import { DarkModeService } from '../../services/dark-mode.service';

@Component({
  selector: 'app-navigation',
  imports: [],
  templateUrl: './navigation.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavigationComponent {
  private readonly router = inject(Router);
  readonly api = inject(ModelReferenceApiService);
  readonly darkMode = inject(DarkModeService);

  goHome(): void {
    this.router.navigate(['/']);
  }

  toggleDarkMode(): void {
    this.darkMode.toggle();
  }
}
