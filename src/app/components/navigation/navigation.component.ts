import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { ModelReferenceApiService } from '../../services/model-reference-api.service';

@Component({
  selector: 'app-navigation',
  imports: [],
  templateUrl: './navigation.component.html',
  styleUrl: './navigation.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavigationComponent {
  private readonly router = inject(Router);
  readonly api = inject(ModelReferenceApiService);

  goHome(): void {
    this.router.navigate(['/']);
  }
}
