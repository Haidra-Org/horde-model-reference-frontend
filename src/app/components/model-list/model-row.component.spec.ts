import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ModelRowComponent } from './model-row.component';
import { UnifiedModelData } from '../../models/unified-model';
import { LegacyStableDiffusionRecord } from '../../models';

describe('ModelRowComponent', () => {
  const baseModel: UnifiedModelData & LegacyStableDiffusionRecord = {
    name: 'Test Model',
    description: 'Example description',
    inpainting: false,
    baseline: 'stable_diffusion_xl',
    tags: ['tag-a', 'tag-b'],
    showcases: ['https://example.com/showcase.png'],
    nsfw: false,
    config: {
      files: [],
      download: [],
    },
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ModelRowComponent],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();
  });

  it('derives expansion state from expanded rows input signals', () => {
    const fixture = TestBed.createComponent(ModelRowComponent);
    const component = fixture.componentInstance;

    fixture.componentRef.setInput('model', baseModel);
    fixture.componentRef.setInput('expandedRows', new Set());

    expect(component.expanded()).toBe(false);

    fixture.componentRef.setInput('expandedRows', new Set([baseModel.name]));

    expect(component.expanded()).toBe(true);
  });

  it('maps baseline values to shorthand labels', () => {
    const fixture = TestBed.createComponent(ModelRowComponent);
    const component = fixture.componentInstance;

    fixture.componentRef.setInput('model', { ...baseModel });

    expect(component.baselineDisplay()).toBe('SDXL');
  });

  it('exposes showcases metadata via computed signals', () => {
    const fixture = TestBed.createComponent(ModelRowComponent);
    const component = fixture.componentInstance;

    fixture.componentRef.setInput('model', baseModel);
    fixture.componentRef.setInput('expandedShowcases', new Set([baseModel.name]));

    expect(component.hasShowcaseContent()).toBe(true);
    expect(component.showcases()).toEqual(baseModel.showcases ?? null);
    expect(component.showcaseExpanded()).toBe(true);
  });

  it('returns tags for stable diffusion models', () => {
    const fixture = TestBed.createComponent(ModelRowComponent);
    const component = fixture.componentInstance;

    fixture.componentRef.setInput('model', baseModel);

    expect(component.tags()).toEqual(baseModel.tags ?? []);
  });
});
