import { provideZonelessChangeDetection, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import {
  BASE_PATH,
  LicenseDefinition,
  LicensedAssetView,
  LicensingSummary,
  PermissionStatus,
} from '../../api-client';
import { AuthService } from '../../services/auth.service';
import { ModelReferenceApiService } from '../../services/model-reference-api.service';
import { ShellContextService } from '../../services/shell-context.service';
import { LicensingComponent } from './licensing.component';

const SUMMARY: LicensingSummary = {
  total_assets: 10,
  commercial_use: {
    allowed: 2,
    allowed_with_conditions: 1,
    prohibited: 1,
    unknown: 6,
  },
  redistribution: {
    allowed: 1,
    allowed_with_conditions: 2,
    prohibited: 1,
    unknown: 6,
  },
  licenses: { MIT: 2 },
};

const DEFINITION: LicenseDefinition = {
  license_id: 'MIT',
  name: 'MIT License',
  spdx_identifier: 'MIT',
  canonical_url: 'https://spdx.org/licenses/MIT.html',
  commercial_use: PermissionStatus.Allowed,
  redistribution: PermissionStatus.AllowedWithConditions,
  obligations: ['include_license'],
};

const MODEL_ASSET: LicensedAssetView = {
  asset_kind: 'model',
  asset_identifier: 'image_generation:Example Model',
  display_name: 'Example Model',
  category: 'image_generation',
  source_url: 'https://example.test/model',
  locations: [],
  related_assets: [],
  licensing: {
    license_expression: 'MIT',
    license_ids: ['MIT'],
    commercial_use: PermissionStatus.Allowed,
    redistribution: PermissionStatus.AllowedWithConditions,
    obligations: ['include_license'],
    evidence: [],
    files: {},
  },
  definition_urls: { MIT: 'https://spdx.org/licenses/MIT.html' },
};

describe('LicensingComponent', () => {
  let fixture: ComponentFixture<LicensingComponent>;
  let apiSpy: {
    backendCapabilities: ReturnType<typeof signal>;
    getLicensingSummary: ReturnType<typeof vi.fn>;
    listLicenseDefinitions: ReturnType<typeof vi.fn>;
    listLicensedAssets: ReturnType<typeof vi.fn>;
    createLicenseDefinition: ReturnType<typeof vi.fn>;
    replaceLicenseDefinition: ReturnType<typeof vi.fn>;
    deleteLicenseDefinition: ReturnType<typeof vi.fn>;
    createLicensedAsset: ReturnType<typeof vi.fn>;
    replaceLicensedAsset: ReturnType<typeof vi.fn>;
    deleteLicensedAsset: ReturnType<typeof vi.fn>;
  };
  const isLicenseEditor = signal(false);

  beforeEach(async () => {
    isLicenseEditor.set(false);
    apiSpy = {
      backendCapabilities: signal({
        writable: true,
        mode: 'PRIMARY' as const,
        canonicalFormat: 'legacy' as const,
      }),
      getLicensingSummary: vi.fn().mockReturnValue(of(SUMMARY)),
      listLicenseDefinitions: vi
        .fn()
        .mockReturnValue(
          of({ items: [DEFINITION], total: 1, offset: 0, limit: 100, metadata: {} }),
        ),
      listLicensedAssets: vi.fn().mockReturnValue(
        of({
          items: [MODEL_ASSET],
          total: 1,
          offset: 0,
          limit: 50,
          metadata: {},
        }),
      ),
      createLicenseDefinition: vi
        .fn()
        .mockImplementation((definition: LicenseDefinition) => of(definition)),
      replaceLicenseDefinition: vi.fn(),
      deleteLicenseDefinition: vi.fn(),
      createLicensedAsset: vi.fn(),
      replaceLicensedAsset: vi.fn(),
      deleteLicensedAsset: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [LicensingComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: BASE_PATH, useValue: 'http://localhost:19800/api' },
        { provide: ModelReferenceApiService, useValue: apiSpy },
        {
          provide: AuthService,
          useValue: {
            isLicenseEditor: isLicenseEditor.asReadonly(),
          },
        },
        ShellContextService,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LicensingComponent);
    fixture.detectChanges();
  });

  it('explains unknown conclusions and shows reviewed permission semantics', () => {
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Unknown does not mean permitted');
    expect(text).toContain('Commercially reviewed');
    expect(text).toContain('4');
    expect(text).toContain('Example Model');
    expect(text).toContain('Allowed with conditions');
  });

  it('links model licensing results back to the model users need to inspect', () => {
    const link = fixture.nativeElement.querySelector(
      'a.license-asset-name',
    ) as HTMLAnchorElement | null;

    expect(link?.textContent).toContain('Example Model');
    expect(link?.getAttribute('href')).toBe('/categories/image_generation/model/Example%20Model');
  });

  it('passes user-selected activity filters to the API and renders the returned result', () => {
    apiSpy.listLicensedAssets.mockClear();
    const query = fixture.nativeElement.querySelector(
      'input[formControlName="query"]',
    ) as HTMLInputElement;
    const commercial = fixture.nativeElement.querySelector(
      'select[formControlName="commercialUse"]',
    ) as HTMLSelectElement;

    query.value = 'example';
    query.dispatchEvent(new Event('input'));
    commercial.value = PermissionStatus.Allowed;
    commercial.dispatchEvent(new Event('change'));
    fixture.nativeElement.querySelector('form.license-filters').dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(apiSpy.listLicensedAssets).toHaveBeenCalledWith({
      nameContains: 'example',
      commercialUse: PermissionStatus.Allowed,
      offset: 0,
      limit: 50,
    });
    expect(fixture.nativeElement.textContent).toContain('Example Model');
  });

  it('does not expose direct management to a non-editor even on a writable backend', () => {
    expect(fixture.nativeElement.textContent).not.toContain('Add non-model asset');

    const definitionsTab = Array.from<HTMLButtonElement>(
      fixture.nativeElement.querySelectorAll('.licensing-tabs button'),
    ).find((button) => button.textContent?.includes('License definitions'));
    definitionsTab!.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('Add definition');
    expect(fixture.nativeElement.textContent).not.toContain('Delete');
  });

  it('lets an independently authorized editor create a reusable definition', () => {
    isLicenseEditor.set(true);
    fixture.detectChanges();
    const definitionsTab = Array.from<HTMLButtonElement>(
      fixture.nativeElement.querySelectorAll('.licensing-tabs button'),
    ).find((button) => button.textContent?.includes('License definitions'));
    definitionsTab!.click();
    fixture.detectChanges();

    const addButton = Array.from<HTMLButtonElement>(
      fixture.nativeElement.querySelectorAll('button'),
    ).find((button) => button.textContent?.includes('Add definition'));
    addButton!.click();
    fixture.detectChanges();

    setInput('licenseId', 'Apache-2.0');
    setInput('name', 'Apache License 2.0');
    setInput('canonicalUrl', 'https://www.apache.org/licenses/LICENSE-2.0');
    fixture.nativeElement
      .querySelector('form.license-editor-form')
      .dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(apiSpy.createLicenseDefinition).toHaveBeenCalledWith(
      expect.objectContaining({
        license_id: 'Apache-2.0',
        name: 'Apache License 2.0',
        canonical_url: 'https://www.apache.org/licenses/LICENSE-2.0',
        commercial_use: PermissionStatus.Unknown,
        redistribution: PermissionStatus.Unknown,
      }),
    );
    expect(fixture.nativeElement.textContent).toContain('Apache License 2.0');
  });

  function setInput(controlName: string, value: string): void {
    const input = fixture.nativeElement.querySelector(
      '[formControlName="' + controlName + '"]',
    ) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }
});
