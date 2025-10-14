import { Component, inject, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { ModelReferenceApiService } from '../../services/model-reference-api.service';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-category-list',
  imports: [],
  templateUrl: './category-list.component.html',
  styleUrl: './category-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoryListComponent implements OnInit {
  private readonly api = inject(ModelReferenceApiService);
  private readonly notification = inject(NotificationService);
  private readonly router = inject(Router);

  readonly categories = signal<string[]>([]);
  readonly loading = signal(true);

  ngOnInit(): void {
    this.loadCategories();
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
}
