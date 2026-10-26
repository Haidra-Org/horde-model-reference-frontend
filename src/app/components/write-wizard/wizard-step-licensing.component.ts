import { ClearableFieldComponent } from '../form-fields/clearable-field/clearable-field.component';
import { clearedWriteFormFields } from '../../utils/write-record';
import { WizardFieldGroupComponent } from './wizard-field-group.component';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { LicenseObligation, PermissionStatus } from '../../api-client';
import type { WriteFormState } from '../../utils/write-record';

@Component({
  selector: 'app-wizard-step-licensing',
  imports: [ClearableFieldComponent, WizardFieldGroupComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="write-step-fields">
      <header class="write-step-intro">
        <h2>Licensing & evidence</h2>
        <p>Record the reviewed permissions and the sources that support them.</p>
      </header>
      <div class="alert alert--warning" role="note">
        <strong>Unknown does not mean permitted.</strong>
        Use <code>NOASSERTION</code> until a source has been reviewed.
      </div>

      <app-wizard-field-group
        title="Licensing conclusion"
        [clearable]="true"
        (cleared)="clearFields(['license_expression'])"
        icon="doc"
        [primary]="true"
      >
        <app-clearable-field
          label="License expression"
          [filled]="!!form().license_expression"
          width="standard"
          (cleared)="clearFields(['license_expression'])"
          ><label class="form-label">
            License expression <span aria-hidden="true">*</span>
            <input
              type="text"
              class="form-input mono"
              [value]="form().license_expression"
              placeholder="MIT or Apache-2.0 OR MIT"
              (input)="onExpressionChange($event)"
            />
            <span class="form-hint"
              >SPDX expression, or NOASSERTION for an unknown conclusion.</span
            >
          </label></app-clearable-field
        >
      </app-wizard-field-group>
      @if (hasReviewedConclusion()) {
        <app-wizard-field-group
          title="Permissions & obligations"
          [clearable]="true"
          (cleared)="
            clearFields([
              'license_ids',
              'commercial_use',
              'redistribution',
              'license_obligations',
              'license_attribution',
            ])
          "
          icon="checkCircle"
        >
          <app-clearable-field
            label="Referenced license IDs"
            [filled]="!!form().license_ids"
            width="standard"
            (cleared)="clearFields(['license_ids'])"
            ><label class="form-label">
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
            </label></app-clearable-field
          >

          <div class="write-field-grid">
            <app-clearable-field
              label="Commercial use"
              [filled]="form().commercial_use !== PermissionStatus.Unknown"
              width="standard"
              (cleared)="clearFields(['commercial_use'])"
              ><label class="form-label">
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
              </label></app-clearable-field
            >
            <app-clearable-field
              label="Redistribution"
              [filled]="form().redistribution !== PermissionStatus.Unknown"
              width="standard"
              (cleared)="clearFields(['redistribution'])"
              ><label class="form-label">
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
              </label></app-clearable-field
            >
          </div>

          <fieldset class="write-license-obligations">
            <legend>
              Consumer obligations
              @if (form().license_obligations.length) {
                <button
                  type="button"
                  class="write-section-clear"
                  aria-label="Clear Consumer obligations"
                  (click)="clearFields(['license_obligations'])"
                >
                  Clear
                </button>
              }
            </legend>
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

          <app-clearable-field
            label="Attribution text"
            [filled]="!!form().license_attribution"
            width="wide"
            (cleared)="clearFields(['license_attribution'])"
            ><label class="form-label">
              Attribution text
              <textarea
                class="form-textarea"
                rows="2"
                [value]="form().license_attribution"
                (input)="onTextChange('license_attribution', $event)"
              ></textarea></label
          ></app-clearable-field> </app-wizard-field-group
        ><app-wizard-field-group
          title="Primary evidence"
          [clearable]="true"
          (cleared)="clearFields(['license_evidence_source', 'license_evidence_description'])"
          icon="link"
          description="Link to the model card, license, or permission statement you reviewed."
        >
          <app-clearable-field
            label="Evidence URL"
            [filled]="!!form().license_evidence_source"
            width="url"
            (cleared)="clearFields(['license_evidence_source'])"
            ><label class="form-label">
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
            </label></app-clearable-field
          >

          <app-clearable-field
            label="Evidence description"
            [filled]="!!form().license_evidence_description"
            width="standard"
            (cleared)="clearFields(['license_evidence_description'])"
            ><label class="form-label">
              Evidence description
              <input
                type="text"
                class="form-input"
                [value]="form().license_evidence_description"
                placeholder="Model card licensing section"
                (input)="onTextChange('license_evidence_description', $event)"
              /> </label></app-clearable-field
        ></app-wizard-field-group>
      }

      <app-wizard-field-group
        title="Evidence record"
        [clearable]="true"
        (cleared)="clearFields(['license_evidence_checked_at', 'license_additional_evidence'])"
        icon="doc"
        [optional]="true"
      >
        <app-clearable-field
          label="Evidence checked date"
          [filled]="!!form().license_evidence_checked_at"
          width="short"
          (cleared)="clearFields(['license_evidence_checked_at'])"
          ><label class="form-label"
            >Evidence checked date
            <input
              type="date"
              class="form-input"
              [value]="form().license_evidence_checked_at || ''"
              (input)="onTextChange('license_evidence_checked_at', $event)"
            /> </label
        ></app-clearable-field>
        @for (evidence of form().license_additional_evidence || []; track $index) {
          <fieldset class="download-card">
            <legend>Additional license evidence {{ $index + 2 }}</legend>
            <app-clearable-field
              [label]="'Evidence URL ' + ($index + 2)"
              [filled]="!!evidence.source"
              width="url"
              (cleared)="clearEvidence($index, 'source')"
              ><label class="form-label"
                >Evidence URL
                <input
                  type="url"
                  class="form-input"
                  [value]="evidence.source"
                  (input)="updateEvidence($index, 'source', $event)"
                /> </label
            ></app-clearable-field>
            <app-clearable-field
              [label]="'Description ' + ($index + 2)"
              [filled]="!!evidence.description"
              width="standard"
              (cleared)="clearEvidence($index, 'description')"
              ><label class="form-label"
                >Description
                <input
                  class="form-input"
                  [value]="evidence.description || ''"
                  (input)="updateEvidence($index, 'description', $event)"
                /> </label
            ></app-clearable-field>
            <app-clearable-field
              [label]="'Checked date ' + ($index + 2)"
              [filled]="!!evidence.checked_at"
              width="short"
              (cleared)="clearEvidence($index, 'checked_at')"
              ><label class="form-label"
                >Checked date
                <input
                  type="date"
                  class="form-input"
                  [value]="evidence.checked_at || ''"
                  (input)="updateEvidence($index, 'checked_at', $event)"
                /> </label
            ></app-clearable-field>
            <button type="button" class="btn btn-ghost" (click)="removeEvidence($index)">
              Remove evidence
            </button>
          </fieldset>
        }
        <button type="button" class="btn btn-ghost" (click)="addEvidence()">
          Add license evidence
        </button>
      </app-wizard-field-group>
      <app-wizard-field-group
        title="Review notes"
        [clearable]="true"
        (cleared)="clearFields(['license_reviewed_by', 'license_reviewed_at', 'license_notes'])"
        icon="pencil"
        [optional]="true"
        ><div class="write-field-grid">
          <app-clearable-field
            label="Reviewed by"
            [filled]="!!form().license_reviewed_by"
            width="standard"
            (cleared)="clearFields(['license_reviewed_by'])"
            ><label class="form-label"
              >Reviewed by
              <input
                class="form-input"
                [value]="form().license_reviewed_by"
                (input)="onTextChange('license_reviewed_by', $event)"
              /> </label
          ></app-clearable-field>
          <app-clearable-field
            label="Reviewed date"
            [filled]="!!form().license_reviewed_at"
            width="short"
            (cleared)="clearFields(['license_reviewed_at'])"
            ><label class="form-label"
              >Reviewed date
              <input
                type="date"
                class="form-input"
                [value]="form().license_reviewed_at"
                (input)="onTextChange('license_reviewed_at', $event)"
              /> </label
          ></app-clearable-field>
        </div>
        <app-clearable-field
          label="Licensing notes"
          [filled]="!!form().license_notes"
          width="wide"
          (cleared)="clearFields(['license_notes'])"
          ><label class="form-label">
            Licensing notes
            <textarea
              class="form-textarea"
              rows="3"
              [value]="form().license_notes"
              (input)="onTextChange('license_notes', $event)"
            ></textarea></label></app-clearable-field
      ></app-wizard-field-group>
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

  clearFields(fields: readonly (keyof WriteFormState)[]): void {
    this.formChange.emit(clearedWriteFormFields(fields));
  }

  clearEvidence(index: number, field: 'source' | 'description' | 'checked_at'): void {
    this.formChange.emit({
      license_additional_evidence: (this.form().license_additional_evidence ?? []).map(
        (entry, i) =>
          i === index ? { ...entry, [field]: field === 'source' ? '' : undefined } : entry,
      ),
    });
  }

  addEvidence(): void {
    this.formChange.emit({
      license_additional_evidence: [
        ...(this.form().license_additional_evidence ?? []),
        { source: '' },
      ],
    });
  }
  removeEvidence(index: number): void {
    this.formChange.emit({
      license_additional_evidence: (this.form().license_additional_evidence ?? []).filter(
        (_, i) => i !== index,
      ),
    });
  }
  updateEvidence(
    index: number,
    field: 'source' | 'description' | 'checked_at',
    event: Event,
  ): void {
    const value = (event.target as HTMLInputElement).value;
    this.formChange.emit({
      license_additional_evidence: (this.form().license_additional_evidence ?? []).map(
        (entry, i) => (i === index ? { ...entry, [field]: value || null } : entry),
      ),
    });
  }

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
