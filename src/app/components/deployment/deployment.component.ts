import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { JsonDisplayComponent } from '../common/json-display.component';
import { CapRowComponent } from '../common/cap-row.component';
import { ShellContextService } from '../../services/shell-context.service';
import { ModelReferenceApiService } from '../../services/model-reference-api.service';
import { DefaultService, HeartbeatResponse } from '../../api-client';
import { catchError, of } from 'rxjs';

/**
 * Write-access matrix row descriptor.
 */
interface MatrixRow {
  fmt: string;
  mode: string;
  v1: 'Read/Write' | 'Read-only';
  v2: 'Read/Write' | 'Read-only';
}

const MATRIX_ROWS: MatrixRow[] = [
  { fmt: 'LEGACY', mode: 'PRIMARY', v1: 'Read/Write', v2: 'Read-only' },
  { fmt: 'LEGACY', mode: 'REPLICA', v1: 'Read-only', v2: 'Read-only' },
  { fmt: 'v2', mode: 'PRIMARY', v1: 'Read-only', v2: 'Read/Write' },
  { fmt: 'v2', mode: 'REPLICA', v1: 'Read-only', v2: 'Read-only' },
];

@Component({
  selector: 'app-deployment',
  imports: [JsonDisplayComponent, CapRowComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="deployment-page">
      <!-- /replicate_mode endpoint response -->
      <div class="deployment-grid">
        <div class="deployment-col">
          <div class="section-title">Backend info endpoint</div>
          <div class="section-sub">GET /api/replicate_mode</div>
          <app-json-display class="deployment-json-block" [data]="replicateInfo()" [indent]="2" />

          <!-- Capability rows -->
          <div class="deployment-cap-rows">
            <app-cap-row
              [ok]="caps().mode === 'PRIMARY'"
              label="Replicate mode"
              [value]="caps().mode"
              desc="Authoritative — accepts writes"
            />
            <app-cap-row
              [ok]="true"
              label="Canonical format"
              [value]="caps().canonicalFormat"
              [desc]="
                caps().canonicalFormat === 'v2'
                  ? 'v2 API owns writes; v1 is read-only'
                  : 'v1 API owns writes; v2 is read-only'
              "
              [neutral]="true"
            />
            <app-cap-row
              [ok]="caps().writable"
              label="Writable"
              [value]="caps().writable ? 'true' : 'false'"
              [desc]="
                caps().writable
                  ? 'Create / update / delete are enqueued'
                  : 'All writes return 503 Service Unavailable'
              "
            />
            <app-cap-row
              [ok]="true"
              label="Pending queue"
              value="enabled"
              desc="Two-person approval workflow active"
              [neutral]="true"
            />
            <app-cap-row
              [ok]="true"
              label="Redis / multi-worker"
              value="single worker"
              desc="No shared cache invalidation"
              [neutral]="true"
            />
          </div>
        </div>

        <!-- Write-access matrix + Heartbeat -->
        <div class="deployment-col">
          <div class="section-title">Write-access matrix</div>
          <div class="section-sub">canonical_format × replicate_mode → which API can write</div>
          <div class="deployment-matrix surface-glass">
            <table class="deployment-matrix-table">
              <thead>
                <tr class="deployment-matrix-header-row">
                  <th>Canonical</th>
                  <th>Mode</th>
                  <th>v1 API</th>
                  <th>v2 API</th>
                </tr>
              </thead>
              <tbody>
                @for (row of matrixRows; track row.fmt + row.mode) {
                  <tr
                    class="deployment-matrix-row"
                    [class.deployment-matrix-row--current]="
                      row.fmt === curFmt() && row.mode === caps().mode
                    "
                  >
                    <td class="deployment-matrix-fmt">
                      {{ row.fmt }}
                      @if (row.fmt === curFmt() && row.mode === caps().mode) {
                        <span class="deployment-matrix-current-tag">● current</span>
                      }
                    </td>
                    <td>{{ row.mode }}</td>
                    <td>
                      <span class="write-cell" [class.write-cell--rw]="row.v1 === 'Read/Write'">
                        <span class="write-cell-dot"></span>
                        {{ row.v1 }}
                      </span>
                    </td>
                    <td>
                      <span class="write-cell" [class.write-cell--rw]="row.v2 === 'Read/Write'">
                        <span class="write-cell-dot"></span>
                        {{ row.v2 }}
                      </span>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <!-- Heartbeat -->
          <div class="deployment-heartbeat surface-glass">
            <div class="deployment-heartbeat-header">
              <span class="deployment-heartbeat-check">✓</span>
              Heartbeat
            </div>
            @if (heartbeat(); as hb) {
              <app-json-display [data]="hb" [indent]="2" />
            } @else {
              <div class="deployment-heartbeat-loading text-muted">Loading heartbeat…</div>
            }
          </div>
        </div>
      </div>
    </div>
  `,
})
export class DeploymentComponent implements OnInit {
  private readonly shellContext = inject(ShellContextService);
  private readonly api = inject(ModelReferenceApiService);
  private readonly defaultService = inject(DefaultService);
  private readonly destroyRef = inject(DestroyRef);

  readonly caps = this.api.backendCapabilities;

  readonly replicateInfo = () => {
    const c = this.caps();
    return {
      replicate_mode: c.mode,
      canonical_format: c.canonicalFormat,
      writable: c.writable,
    };
  };

  readonly curFmt = () => (this.caps().canonicalFormat === 'v2' ? 'v2' : 'LEGACY');

  readonly matrixRows = MATRIX_ROWS;

  protected readonly heartbeat = signal<HeartbeatResponse | null>(null);

  ngOnInit(): void {
    this.shellContext.setContext({
      breadcrumb: [{ label: 'System' }, { label: 'Deployment' }],
      title: 'Deployment & backend mode',
      sub: 'How this instance is configured — clients query /replicate_mode to route reads & writes.',
      actions: [],
    });

    // Fetch live heartbeat
    this.defaultService
      .heartbeatHeartbeatGet()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(() => of(null)),
      )
      .subscribe((response) => {
        this.heartbeat.set(response);
      });
  }
}
