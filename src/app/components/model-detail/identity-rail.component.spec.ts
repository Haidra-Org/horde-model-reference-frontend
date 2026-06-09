import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { BASE_PATH } from '../../api-client';
import { ModelIdentityRailComponent } from './identity-rail.component';
import type { BrowseModel } from '../../services/browse-models.service';
import type { LegacyRecordUnion } from '../../models/api.models';

function makeModel(overrides: Partial<BrowseModel> = {}): BrowseModel {
  return {
    name: 'test-model-v1',
    display_name: 'Test Model v1',
    description: 'A test model for unit tests.',
    version: '1.0',
    style: 'photorealistic',
    nsfw: false,
    baseline: 'stable_diffusion_xl',
    tags: ['test', 'unit'],
    category: 'image_generation',
    _raw: {
      name: 'test-model-v1',
      display_name: 'Test Model v1',
      description: 'A test model for unit tests.',
      version: '1.0',
      style: 'photorealistic',
      nsfw: false,
      baseline: 'stable_diffusion_xl',
      tags: ['test', 'unit'],
      model_classification: { domain: 'image', purpose: 'generation' },
      metadata: {
        added: '2025-01-15T00:00:00Z',
        updated: '2025-06-01T12:00:00Z',
        author: 'test-author',
      },
    } as unknown as LegacyRecordUnion,
    ...overrides,
  };
}

describe('ModelIdentityRailComponent', () => {
  let fixture: ComponentFixture<ModelIdentityRailComponent>;
  let nativeEl: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ModelIdentityRailComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: BASE_PATH, useValue: 'http://localhost:19800/api' },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ModelIdentityRailComponent);
    nativeEl = fixture.nativeElement;
  });

  it('should create', () => {
    fixture.componentRef.setInput('model', makeModel());
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should display the model display name', () => {
    fixture.componentRef.setInput('model', makeModel());
    fixture.detectChanges();

    const nameEl = nativeEl.querySelector('.identity-rail-name');
    expect(nameEl).toBeTruthy();
    expect(nameEl!.textContent).toContain('Test Model v1');
  });

  it('should display the description', () => {
    fixture.componentRef.setInput('model', makeModel());
    fixture.detectChanges();

    const desc = nativeEl.querySelector('.identity-rail-desc');
    expect(desc).toBeTruthy();
    expect(desc!.textContent).toContain('A test model for unit tests.');
  });

  it('should use model name as fallback when display_name is missing', () => {
    fixture.componentRef.setInput(
      'model',
      makeModel({ display_name: null, name: 'fallback-name' }),
    );
    fixture.detectChanges();

    const nameEl = nativeEl.querySelector('.identity-rail-name');
    expect(nameEl!.textContent).toContain('fallback-name');
  });

  it('should show NSFW badge when model is nsfw', () => {
    fixture.componentRef.setInput('model', makeModel({ nsfw: true }));
    fixture.detectChanges();

    const badges = nativeEl.querySelectorAll('.badge-danger');
    const nsfwBadge = Array.from(badges).find((b) => b.textContent!.includes('NSFW'));
    expect(nsfwBadge).toBeTruthy();
  });

  it('should display domain accent border for image models', () => {
    fixture.componentRef.setInput('model', makeModel({ category: 'image_generation' }));
    fixture.detectChanges();

    const rail = nativeEl.querySelector('.identity-rail');
    expect(rail!.classList.contains('accent-top-image')).toBe(true);
  });

  it('should display domain accent border for text models', () => {
    fixture.componentRef.setInput('model', makeModel({ category: 'text_generation' }));
    fixture.detectChanges();

    const rail = nativeEl.querySelector('.identity-rail');
    expect(rail!.classList.contains('accent-top-text')).toBe(true);
  });

  it('should show identifier in KV row with copy button', () => {
    fixture.componentRef.setInput('model', makeModel());
    fixture.detectChanges();

    const kvMono = nativeEl.querySelector('.kv-mono');
    expect(kvMono).toBeTruthy();
    expect(kvMono!.textContent).toContain('test-model-v1');

    const copyBtn = nativeEl.querySelector('app-copy-button');
    expect(copyBtn).toBeTruthy();
  });

  it('should show added and updated dates', () => {
    fixture.componentRef.setInput('model', makeModel());
    fixture.detectChanges();

    const kvValues = nativeEl.querySelectorAll('.kv-value');
    const texts = Array.from(kvValues).map((el) => el.textContent ?? '');
    const hasDate = texts.some((t) => t.includes('Jan') || t.includes('2025'));
    expect(hasDate).toBe(true);
  });

  it('should render showcase component', () => {
    fixture.componentRef.setInput('model', makeModel());
    fixture.componentRef.setInput('showcaseSrc', 'https://example.com/img.png');
    fixture.detectChanges();

    const showcase = nativeEl.querySelector('app-showcase');
    expect(showcase).toBeTruthy();
  });
});
