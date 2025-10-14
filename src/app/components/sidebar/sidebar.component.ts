import {
  Component,
  inject,
  OnInit,
  signal,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { ModelReferenceApiService } from '../../services/model-reference-api.service';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-sidebar',
  imports: [],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarComponent implements OnInit {
  private readonly api = inject(ModelReferenceApiService);
  private readonly notification = inject(NotificationService);
  private readonly router = inject(Router);

  readonly categories = signal<string[]>([]);
  readonly loading = signal(true);
  readonly currentCategory = signal<string | null>(null);

  readonly writable = computed(() => this.api.backendCapabilities().writable);

  ngOnInit(): void {
    this.loadCategories();
    this.trackCurrentCategory();
  }

  selectCategory(category: string): void {
    this.router.navigate(['/categories', category]);
  }

  private loadCategories(): void {
    this.loading.set(true);
    this.api.getCategories().subscribe({
      next: (categories) => {
        this.categories.set(categories);
        this.loading.set(false);
      },
      error: (error: Error) => {
        this.notification.error(error.message);
        this.loading.set(false);
      },
    });
  }

  private trackCurrentCategory(): void {
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => {
        const urlSegments = this.router.url.split('/');
        if (urlSegments[1] === 'categories' && urlSegments[2]) {
          this.currentCategory.set(urlSegments[2]);
        } else {
          this.currentCategory.set(null);
        }
      });

    const urlSegments = this.router.url.split('/');
    if (urlSegments[1] === 'categories' && urlSegments[2]) {
      this.currentCategory.set(urlSegments[2]);
    }
  }
}
