import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ModelLicensing, PermissionStatus } from '../../api-client';
import type { BrowseModel } from '../../services/browse-models.service';

@Component({
  selector: 'app-licensing-tab',
  imports: [RouterLink],
  templateUrl: './licensing-tab.component.html',
  styleUrl: './licensing-tab.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LicensingTabComponent {
  readonly model = input.required<BrowseModel>();

  protected readonly licensing = computed<ModelLicensing>(() => {
    const raw = (this.model()._raw ?? {}) as Record<string, unknown>;
    return (
      (raw['licensing'] as ModelLicensing | undefined) ?? {
        license_expression: 'NOASSERTION',
        commercial_use: PermissionStatus.Unknown,
        redistribution: PermissionStatus.Unknown,
        license_ids: [],
        obligations: [],
        evidence: [],
        files: {},
        notes: 'No reviewed licensing conclusion is currently available.',
      }
    );
  });

  protected readonly isUnknown = computed(
    () =>
      this.licensing().license_expression === 'NOASSERTION' ||
      (this.licensing().commercial_use === PermissionStatus.Unknown &&
        this.licensing().redistribution === PermissionStatus.Unknown),
  );

  protected readonly fileOverrides = computed(() =>
    Object.entries(this.licensing().files ?? {}).map(([name, assignment]) => ({
      name,
      assignment,
    })),
  );

  protected permissionLabel(status: PermissionStatus): string {
    switch (status) {
      case PermissionStatus.Allowed:
        return 'Allowed';
      case PermissionStatus.AllowedWithConditions:
        return 'Allowed with conditions';
      case PermissionStatus.Prohibited:
        return 'Prohibited';
      default:
        return 'Unknown';
    }
  }

  protected permissionClass(status: PermissionStatus): string {
    const modifier =
      status === PermissionStatus.Allowed
        ? 'allowed'
        : status === PermissionStatus.AllowedWithConditions
          ? 'conditional'
          : status === PermissionStatus.Prohibited
            ? 'prohibited'
            : 'unknown';
    return 'model-license__permission model-license__permission--' + modifier;
  }

  protected obligationLabel(value: string): string {
    return value.replaceAll('_', ' ');
  }
}
