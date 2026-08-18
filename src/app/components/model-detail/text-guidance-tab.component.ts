import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import type { ResolvedTextGuidance, TextUsageProfile } from '../../models/text-guidance.models';
import { TextGuidanceService } from '../../services/text-guidance.service';

@Component({
  selector: 'app-text-guidance-tab',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="guidance-detail" aria-labelledby="guidance-heading">
      <div class="guidance-detail__header">
        <div>
          <p class="eyebrow">Prompting contract</p>
          <h2 id="guidance-heading">How to use this model</h2>
        </div>
        <a class="concept-link" [routerLink]="['/text-guidance']">Browse reusable guidance</a>
      </div>

      @if (loading()) {
        <div class="catalog-state" role="status">Loading usage guidance…</div>
      } @else if (error()) {
        <div class="alert alert--danger" role="alert">{{ error() }}</div>
      } @else if (guidance(); as resolved) {
        @if (resolved.summary.status === 'undocumented') {
          <div class="guidance-empty">
            <strong>No reviewed usage guide yet</strong>
            <p>
              This is an exact model record, but its prompt serialization has not been documented.
            </p>
            <a [routerLink]="['/text-guidance']" [queryParams]="{ assign: modelName() }"
              >Help document it</a
            >
          </div>
        } @else if (resolved.summary.status === 'legacy_label') {
          <div class="guidance-legacy">
            <strong>Legacy format label: {{ resolved.legacy_instruct_format }}</strong>
            <p>
              This historical label is useful evidence, but it is not yet a reviewed, reusable
              prompt contract.
            </p>
          </div>
        }

        @if (resolved.primary_profile; as profile) {
          <article class="guidance-profile-detail">
            <div class="guidance-profile-detail__title">
              <div>
                <h3>{{ profile.display_name }}</h3>
                <p>{{ profile.summary }}</p>
              </div>
              <span class="badge badge-purple">Shared by this model</span>
            </div>

            <div class="guidance-audience-switch" role="group" aria-label="Guidance audience">
              <button
                type="button"
                [attr.aria-pressed]="audience() === 'user'"
                (click)="audience.set('user')"
              >
                For users
              </button>
              <button
                type="button"
                [attr.aria-pressed]="audience() === 'developer'"
                (click)="audience.set('developer')"
              >
                For developers
              </button>
            </div>
            @if (audienceContent(profile); as content) {
              <p class="guidance-overview">
                {{ content.overview || 'No overview has been published.' }}
              </p>
              <div class="guidance-prose-grid">
                @if (content.use_cases.length) {
                  <section>
                    <h4>Useful for</h4>
                    <ul>
                      @for (item of content.use_cases; track item) {
                        <li>{{ item }}</li>
                      }
                    </ul>
                  </section>
                }
                @if (content.tips.length) {
                  <section>
                    <h4>Practical tips</h4>
                    <ul>
                      @for (item of content.tips; track item) {
                        <li>{{ item }}</li>
                      }
                    </ul>
                  </section>
                }
                @if (content.caveats.length) {
                  <section>
                    <h4>Watch for</h4>
                    <ul>
                      @for (item of content.caveats; track item) {
                        <li>{{ item }}</li>
                      }
                    </ul>
                  </section>
                }
              </div>
            }

            @if (profile.templates?.length) {
              <div class="guidance-templates">
                <h4>Prompt templates</h4>
                @for (template of profile.templates; track template.template_id) {
                  <details>
                    <summary>
                      {{ template.name }} <span>{{ template.syntax_name || template.syntax }}</span>
                    </summary>
                    <pre><code>{{ template.template }}</code></pre>
                  </details>
                }
              </div>
            }

            @if (profile.recommended_settings && objectKeys(profile.recommended_settings).length) {
              <div class="guidance-settings">
                <h4>Recommended starting settings</h4>
                @for (key of objectKeys(profile.recommended_settings); track key) {
                  <code>{{ key }}: {{ profile.recommended_settings[key] }}</code>
                }
              </div>
            }
          </article>
        }

        @if (resolved.supplemental_profiles.length) {
          <section class="guidance-recipes">
            <h3>Usage recipes</h3>
            @for (recipe of resolved.supplemental_profiles; track recipe.profile_id) {
              <article>
                <strong>{{ recipe.display_name }}</strong>
                <p>{{ recipe.summary }}</p>
              </article>
            }
          </section>
        }
      }
    </section>
  `,
})
export class TextGuidanceTabComponent {
  private readonly service = inject(TextGuidanceService);
  private readonly destroyRef = inject(DestroyRef);

  readonly modelName = input.required<string>();
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly guidance = signal<ResolvedTextGuidance | null>(null);
  protected readonly audience = signal<'user' | 'developer'>('user');
  protected readonly objectKeys = Object.keys;

  constructor() {
    effect(() => this.load(this.modelName()));
  }

  protected audienceContent(profile: TextUsageProfile) {
    return this.audience() === 'user' ? profile.user : profile.developer;
  }

  private load(modelName: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.guidance.set(null);
    this.service
      .resolveModel(modelName)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (guidance) => {
          this.guidance.set(guidance);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Usage guidance could not be loaded.');
          this.loading.set(false);
        },
      });
  }
}
