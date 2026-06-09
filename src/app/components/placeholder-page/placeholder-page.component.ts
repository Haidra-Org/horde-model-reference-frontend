import { ChangeDetectionStrategy, Component, inject, OnInit, DestroyRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ShellContextService } from '../../services/shell-context.service';

/**
 * Thin placeholder page for routes whose full implementation lands in a later phase.
 * Reads the `title` from route data and sets the shell context.
 */
@Component({
  selector: 'app-placeholder-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-center justify-center p-12">
      <div class="surface-glass rounded-xl p-8 text-center max-w-md">
        <div class="text-4xl mb-4">🚧</div>
        <h2 class="heading-section mb-2">{{ title }}</h2>
        <p class="text-muted">This page is coming soon.</p>
      </div>
    </div>
  `,
})
export class PlaceholderPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly shellContext = inject(ShellContextService);
  private readonly destroyRef = inject(DestroyRef);

  title = '';

  ngOnInit(): void {
    this.route.data.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((data) => {
      this.title = data['title'] ?? 'Coming Soon';
      this.shellContext.setContext({
        breadcrumb: [{ label: this.title }],
        title: this.title,
        actions: [],
      });
    });
  }
}
