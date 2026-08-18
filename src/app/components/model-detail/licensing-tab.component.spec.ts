import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PermissionStatus } from '../../api-client';
import type { BrowseModel } from '../../services/browse-models.service';
import { LicensingTabComponent } from './licensing-tab.component';

describe('LicensingTabComponent', () => {
  let fixture: ComponentFixture<LicensingTabComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LicensingTabComponent],
      providers: [provideZonelessChangeDetection(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(LicensingTabComponent);
  });

  it('warns consumers that absent review is not permission', () => {
    fixture.componentRef.setInput('model', modelWithLicensing(undefined));
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('NOASSERTION');
    expect(text).toContain('Unknown does not mean allowed');
    expect(text).toContain('Not yet reviewed');
  });

  it('communicates conditional use and the obligations a consumer must follow', () => {
    fixture.componentRef.setInput(
      'model',
      modelWithLicensing({
        license_expression: 'Apache-2.0',
        license_ids: ['Apache-2.0'],
        commercial_use: PermissionStatus.Allowed,
        redistribution: PermissionStatus.AllowedWithConditions,
        obligations: ['attribution', 'include_license'],
        evidence: [{ source: 'https://example.test/terms', description: 'Upstream terms' }],
        reviewed_by: 'curator',
        reviewed_at: '2026-08-01',
        files: {},
      }),
    );
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Commercial use');
    expect(text).toContain('Allowed with conditions');
    expect(text).toContain('include license');
    expect(text).toContain('Upstream terms');
    const reviewMetadata = fixture.nativeElement.querySelector(
      '.model-license__review-metadata',
    ) as HTMLElement;
    expect(reviewMetadata.textContent).toContain('curator');
    expect(reviewMetadata.textContent).toContain('2026-08-01');
    expect(text).not.toContain('Unknown does not mean allowed');
  });

  it('surfaces a narrower file-specific conclusion instead of hiding it under the model license', () => {
    fixture.componentRef.setInput(
      'model',
      modelWithLicensing({
        license_expression: 'MIT',
        commercial_use: PermissionStatus.Allowed,
        redistribution: PermissionStatus.Allowed,
        files: {
          'weights.safetensors': {
            license_expression: 'LicenseRef-Weights',
            commercial_use: PermissionStatus.Prohibited,
            redistribution: PermissionStatus.Unknown,
          },
        },
      }),
    );
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('File-specific conclusions');
    expect(text).toContain('weights.safetensors');
    expect(text).toContain('LicenseRef-Weights');
    expect(text).toContain('Commercial prohibited');
  });

  function modelWithLicensing(licensing: Record<string, unknown> | undefined): BrowseModel {
    return {
      name: 'example',
      category: 'image_generation',
      _raw: {
        name: 'example',
        ...(licensing ? { licensing } : {}),
      } as BrowseModel['_raw'],
    };
  }
});
