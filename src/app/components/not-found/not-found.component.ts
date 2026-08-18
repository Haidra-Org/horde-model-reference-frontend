import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ShellContextService } from '../../services/shell-context.service';
import { DEFAULT_CATEGORY } from '../../shared/constants';

/**
 * Terminal route for URLs that match nothing.
 *
 * Without this the router leaves the outlet empty and the shell renders as a blank
 * page, which is indistinguishable from a load failure. Model names change over time,
 * so stale links into `/categories/:category/model/:modelName` are expected traffic
 * rather than an edge case.
 */
@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-container">
      <div class="not-found surface-glass">
        <p class="not-found-code">404</p>
        <h1 class="not-found-title">We couldn't find that page</h1>
        <p class="not-found-body">
          The link may be out of date, or the model it pointed to may have been renamed or removed
          from the reference.
        </p>
        <div class="not-found-actions">
          <a class="btn btn-primary" [routerLink]="['/categories', defaultCategory]">
            Browse models
          </a>
          <a class="btn btn-secondary" routerLink="/api-docs">API &amp; docs</a>
        </div>
      </div>
    </div>
  `,
})
export class NotFoundComponent implements OnInit {
  private readonly shellContext = inject(ShellContextService);

  protected readonly defaultCategory = DEFAULT_CATEGORY;

  ngOnInit(): void {
    this.shellContext.setContext({
      breadcrumb: [{ label: 'Not found' }],
      title: 'Page not found',
      actions: [],
    });
  }
}
