import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { LicenseObligation, PermissionStatus } from '../../api-client';
import type { WriteFormState } from '../../utils/write-record';

@Component({
  selector: 'app-wizard-step-licensing',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="write-step-fields">
      <div class="alert alert--warning" role="note">
        <strong>Unknown does not mean permitted.</strong>
        Use <code>NOASSERTION</code> until a source has been reviewed.
      </div>

      <label class="form-label">
        License expression <span aria-hidden="true">*</span>
        <input
          type="text"
          class="form-input mono"
          [value]="form().license_expression"
          placeholder="MIT or Apache-2.0 OR MIT"
          (input)="onExpressionChange($event)"
        />
        <span class="form-hint">SPDX expression, or NOASSERTION for an unknown conclusion.</span>
      </label>

      @if (hasReviewedConclusion()) {
        <label class="form-label">
          Referenced license IDs <span aria-hidden="true">*</span>
          <input
            type="text"
            class="form-input"
            [value]="form().license_ids"
            placeholder="Apache-2.0, MIT"
            (input)="onTextChange('license_ids', $event)"
          />
          <span class="form-hint"
            >Comma-separated IDs; these must exactly match the expression.</span
          >
        </label>

        <div class="write-field-grid">
          <label class="form-label">
            Commercial use <span aria-hidden="true">*</span>
            <select
              class="form-select"
              [value]="form().commercial_use"
              (change)="onPermissionChange('commercial_use', $event)"
            >
              <option [value]="PermissionStatus.Unknown">Unknown</option>
              <option [value]="PermissionStatus.Allowed">Allowed</option>
              <option [value]="PermissionStatus.AllowedWithConditions">
                Allowed with conditions
              </option>
              <option [value]="PermissionStatus.Prohibited">Prohibited</option>
            </select>
          </label>
          <label class="form-label">
            Redistribution <span aria-hidden="true">*</span>
            <select
              class="form-select"
              [value]="form().redistribution"
              (change)="onPermissionChange('redistribution', $event)"
            >
              <option [value]="PermissionStatus.Unknown">Unknown</option>
              <option [value]="PermissionStatus.Allowed">Allowed</option>
              <option [value]="PermissionStatus.AllowedWithConditions">
                Allowed with conditions
              </option>
              <option [value]="PermissionStatus.Prohibited">Prohibited</option>
            </select>
          </label>
        </div>

        <fieldset class="write-license-obligations">
          <legend>Consumer obligations</legend>
          @for (obligation of obligationOptions; track obligation.value) {
            <label>
              <input
                type="checkbox"
                [checked]="hasObligation(obligation.value)"
                (change)="toggleObligation(obligation.value)"
              />
              {{ obligation.label }}
            </label>
          }
        </fieldset>

        <label class="form-label">
          Attribution text
          <textarea
            class="form-textarea"
            rows="2"
            [value]="form().license_attribution"
            (input)="onTextChange('license_attribution', $event)"
          ></textarea>
        </label>

        <label class="form-label">
          Evidence URL <span aria-hidden="true">*</span>
          <input
            type="url"
            class="form-input"
            [value]="form().license_evidence_source"
            placeholder="https://example.com/model-license"
            (input)="onTextChange('license_evidence_source', $event)"
          />
          <span class="form-hint"
            >Link to the model card, license file, or project terms reviewed.</span
          >
        </label>

        <label class="form-label">
          Evidence description
          <input
            type="text"
            class="form-input"
            [value]="form().license_evidence_description"
            placeholder="Model card licensing section"
            (input)="onTextChange('license_evidence_description', $event)"
          />
        </label>
      }

      <label class="form-label">
        Licensing notes
        <textarea
          class="form-textarea"
          rows="3"
          [value]="form().license_notes"
          (input)="onTextChange('license_notes', $event)"
        ></textarea>
      </label>
    </div>
  `,
})
export class WizardStepLicensingComponent {
  readonly form = input.required<WriteFormState>();
  readonly formChange = output<Partial<WriteFormState>>();
  readonly PermissionStatus = PermissionStatus;

  readonly obligationOptions = [
    { value: LicenseObligation.Attribution, label: 'Attribution' },
    { value: LicenseObligation.IncludeLicense, label: 'Include license text' },
    { value: LicenseObligation.ShareAlike, label: 'Share alike' },
    { value: LicenseObligation.DiscloseSource, label: 'Disclose source' },
    { value: LicenseObligation.NetworkSourceDisclosure, label: 'Network source disclosure' },
    {
      value: LicenseObligation.ResponsibleUseRestrictions,
      label: 'Responsible-use restrictions',
    },
    { value: LicenseObligation.Other, label: 'Other obligations' },
  ] as const;

  hasReviewedConclusion(): boolean {
    return this.form().license_expression.trim().toUpperCase() !== 'NOASSERTION';
  }

  hasObligation(obligation: LicenseObligation): boolean {
    return this.form().license_obligations.includes(obligation);
  }

  onExpressionChange(event: Event): void {
    const licenseExpression = (event.target as HTMLInputElement).value;
    const update: Partial<WriteFormState> = { license_expression: licenseExpression };
    if (licenseExpression.trim().toUpperCase() === 'NOASSERTION') {
      update.license_ids = '';
      update.commercial_use = PermissionStatus.Unknown;
      update.redistribution = PermissionStatus.Unknown;
      update.license_obligations = [];
      update.license_evidence_source = '';
      update.license_evidence_description = '';
    }
    this.formChange.emit(update);
  }

  onTextChange(field: keyof WriteFormState, event: Event): void {
    const input = event.target as HTMLInputElement | HTMLTextAreaElement;
    this.formChange.emit({ [field]: input.value });
  }

  onPermissionChange(field: 'commercial_use' | 'redistribution', event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.formChange.emit({ [field]: select.value as PermissionStatus });
  }

  toggleObligation(obligation: LicenseObligation): void {
    const obligations = this.hasObligation(obligation)
      ? this.form().license_obligations.filter((current) => current !== obligation)
      : [...this.form().license_obligations, obligation];
    this.formChange.emit({ license_obligations: obligations });
  }
}
