import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ModelReferenceApiService } from '../../services/model-reference-api.service';
import { ViewerCapabilitiesService } from '../../services/viewer-capabilities.service';
import { ShellContextService } from '../../services/shell-context.service';
import { IconComponent } from '../common/icon.component';
import { domainMeta } from '../../shared/domain';
import type { MODEL_REFERENCE_CATEGORY } from '../../api-client';

interface CategoryChoice {
  value: MODEL_REFERENCE_CATEGORY;
  label: string;
  domain: ReturnType<typeof domainMeta>;
}

interface CategoryChoiceGroup {
  domain: string;
  label: string;
  cats: CategoryChoice[];
}

const DOMAIN_ORDER: { domain: string; label: string }[] = [
  { domain: 'image', label: 'Image' },
  { domain: 'text', label: 'Text' },
  { domain: 'utility', label: 'Utility' },
];

@Component({
  selector: 'app-propose-entry',
  imports: [RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Topbar context set via ShellContextService -->

    @if (categories().length > 0) {
      @for (group of groupedCategories(); track group.domain) {
        <div class="propose-entry-group" [class]="'propose-entry-group--' + group.domain">
          <div class="propose-entry-group-label">{{ group.label }}</div>
          <div class="propose-entry-grid">
            @for (cat of group.cats; track cat.value) {
              <a
                [routerLink]="['/categories', cat.value, 'create']"
                class="glass-inflow propose-entry-card"
                [class]="'accent-top-' + cat.domain.domain"
              >
                <span class="badge" [class]="cat.domain.accentClass">
                  <app-icon [name]="cat.domain.icon" />
                  {{ cat.label }}
                </span>
                <span class="propose-entry-action">
                  Propose model
                  <svg
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    style="width:14px;height:14px"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </span>
              </a>
            }
          </div>
        </div>
      }
    } @else {
      <div class="glass-inflow" style="padding:40px;text-align:center">
        <p style="color:var(--color-content-muted)">Loading categories…</p>
      </div>
    }
  `,
})
export class ProposeEntryComponent implements OnInit {
  private readonly api = inject(ModelReferenceApiService);
  private readonly viewer = inject(ViewerCapabilitiesService);
  private readonly shell = inject(ShellContextService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly categories = signal<CategoryChoice[]>([]);

  /** Category choices partitioned into domain sections (image → text → utility). */
  readonly groupedCategories = computed<CategoryChoiceGroup[]>(() => {
    const cats = this.categories();
    return DOMAIN_ORDER.map(({ domain, label }) => ({
      domain,
      label,
      cats: cats.filter((c) => c.domain.domain === domain),
    })).filter((g) => g.cats.length > 0);
  });

  readonly canWrite = this.viewer.canPropose;

  ngOnInit(): void {
    this.shell.setContext({
      breadcrumb: [{ label: 'Contribute' }],
      title: 'Propose a change',
      sub: 'Choose a category to propose a new model or edit an existing one.',
      actions: [],
    });

    this.api
      .getCategories()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (cats) => {
          const choices: CategoryChoice[] = cats
            .filter((c): c is string => typeof c === 'string' && c.length > 0)
            .map((c) => ({
              value: c as MODEL_REFERENCE_CATEGORY,
              label: c.replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase()),
              domain: domainMeta(c),
            }));
          this.categories.set(choices);
        },
      });
  }
}
