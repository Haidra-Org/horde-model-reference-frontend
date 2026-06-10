import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { ShellContextService } from '../../services/shell-context.service';
import { CopyButtonComponent } from '../common/copy-button/copy-button.component';
import { BASE_PATH } from '../../api-client';
import { ModelReferenceApiService } from '../../services/model-reference-api.service';

/**
 * Method-colour mapping for endpoint-group rows.
 */
const METHOD_COLORS: Record<string, string> = {
  GET: 'var(--brand-blue, #2563eb)',
  POST: 'var(--success-icon, #16a34a)',
  PUT: 'var(--accent-pending, #b45309)',
  DELETE: 'var(--danger-text, #dc2626)',
};

@Component({
  selector: 'app-api-docs',
  imports: [CopyButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="api-docs-page">
      <!-- Base URL card -->
      <div class="api-docs-base-url surface-glass">
        <span class="api-docs-base-label">Base URL</span>
        <code class="api-docs-base-value">{{ apiBaseUrl() }}</code>
        <span class="api-docs-canonical-badge"> canonical {{ canonicalBadge() }} </span>
        <app-copy-button [text]="apiBaseUrl()" label="Copy" copiedLabel="Copied" />
      </div>

      <!-- Quickstart -->
      <div class="api-docs-quickstart surface-glass">
        <div class="api-docs-quickstart-title">Quickstart · fetch image models</div>
        <pre class="api-docs-quickstart-code">{{ quickstartCurl() }}</pre>
      </div>

      <!-- Endpoint group cards -->
      <div class="api-docs-endpoint-groups">
        @for (group of endpointGroups(); track group.title) {
          <div class="api-docs-group surface-glass" [style.borderTopColor]="group.color">
            <div class="api-docs-group-header">
              <span class="api-docs-group-title">{{ group.title }}</span>
            </div>
            <div class="api-docs-group-body">
              @for (row of group.rows; track row.method + row.path; let last = $last) {
                <div class="api-docs-group-row" [class.api-docs-group-row--last]="last">
                  <span class="api-docs-group-method" [style.color]="methodColor(row.method)">
                    {{ row.method }}
                  </span>
                  <code class="api-docs-group-path">{{ row.path }}</code>
                </div>
              }
            </div>
          </div>
        }
      </div>
    </div>
  `,
})
export class ApiDocsComponent implements OnInit {
  private readonly shellContext = inject(ShellContextService);
  private readonly apiBasePath = inject(BASE_PATH);
  private readonly api = inject(ModelReferenceApiService);

  readonly apiBaseUrl = () => {
    const bp = this.apiBasePath;
    return Array.isArray(bp) ? bp[0] : bp;
  };

  readonly canonicalBadge = () =>
    this.api.backendCapabilities().canonicalFormat === 'v2' ? 'v2' : 'v1';

  readonly quickstartCurl = () => {
    const base = this.apiBaseUrl();
    const v = this.canonicalBadge();
    return [
      `curl ${base}/model_references/v2/image_generation`,
      '',
      '# anonymous read needs no key — writes do:',
      `curl -X POST ${base}/model_references/${v}/image_generation \\`,
      '  -H "apikey: $AI_HORDE_API_KEY" \\',
      '  -H "Content-Type: application/json" \\',
      `  -d '{"name":"my_finetune_xl","baseline":"stable_diffusion_xl","nsfw":false}'`,
      '# → 202 Accepted, returns a PendingChangeRecord',
    ].join('\n');
  };

  readonly endpointGroups = () => {
    const v = this.canonicalBadge();
    const base = '/' + v;
    return [
      {
        title: 'Reads — open to everyone',
        icon: 'search',
        color: 'var(--brand-blue, #2563eb)',
        rows: [
          { method: 'GET', path: '/model_references/v2/model_categories' },
          { method: 'GET', path: '/model_references/v2/{category}' },
          { method: 'GET', path: '/model_references/v2/{category}/model/{name}' },
          { method: 'GET', path: '/model_references/v2/text_generation/groups' },
          { method: 'GET', path: '/model_references/v2/text_generation/families' },
          { method: 'GET', path: '/replicate_mode' },
        ],
      },
      {
        title: 'Analytics — public, cached',
        icon: 'chart',
        color: 'var(--accent-text, #9333ea)',
        rows: [
          { method: 'GET', path: '/model_references/v2/{category}/statistics' },
          { method: 'GET', path: '/model_references/v2/{category}/deletion_risk' },
          {
            method: 'GET',
            path: '/model_references/v2/text_generation/deletion_risk?grouped=true',
          },
        ],
      },
      {
        title: 'Writes — requestor key, enqueued (202)',
        icon: 'wand',
        color: 'var(--success-icon, #16a34a)',
        rows: [
          { method: 'POST', path: `${base}/{category}` },
          { method: 'PUT', path: `${base}/{category}/model/{name}` },
          { method: 'DELETE', path: `${base}/{category}/model/{name}` },
          { method: 'GET', path: `${base}/me/roles` },
        ],
      },
      {
        title: 'Pending queue — approver key',
        icon: 'inbox',
        color: 'var(--accent-pending, #b45309)',
        rows: [
          { method: 'GET', path: `${base}/pending_queue/changes?statuses=pending` },
          { method: 'GET', path: `${base}/pending_queue/changes/{id}/diff` },
          { method: 'GET', path: `${base}/pending_queue/my_changes` },
          { method: 'POST', path: `${base}/pending_queue/batches` },
          { method: 'POST', path: `${base}/pending_queue/apply_batch/{id}` },
        ],
      },
    ];
  };

  ngOnInit(): void {
    this.shellContext.setContext({
      breadcrumb: [{ label: 'System' }, { label: 'API & docs' }],
      title: 'REST API',
      sub: 'Interactive Swagger lives at /docs. Reads are open; writes are reviewed.',
      actions: [
        {
          id: 'swagger',
          label: 'Swagger /docs',
          action: () => {
            window.open('/docs', '_blank');
          },
        },
      ],
    });
  }

  protected methodColor(method: string): string {
    return METHOD_COLORS[method] ?? 'var(--fg-3)';
  }
}
