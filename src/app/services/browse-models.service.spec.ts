import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, beforeEach, expect, it, vi } from 'vitest';
import { StatisticsService } from '../api-client/api/statistics.service';
import { HordeApiService } from './horde-api.service';
import { ModelReferenceApiService } from './model-reference-api.service';
import { PendingQueueSummaryService } from './pending-queue-summary.service';
import { BrowseModelsStore, browseModelDisplayName, toBrowseModel } from './browse-models.service';

const imageModels = [
  {
    name: 'Aurora Portrait',
    baseline: 'flux_1',
    style: 'realistic',
    tags: ['portrait', 'featured'],
    nsfw: false,
  },
  {
    name: 'Midnight Portrait',
    baseline: 'flux_1',
    style: 'anime',
    tags: ['portrait'],
    nsfw: true,
  },
  {
    name: 'Open Landscape',
    baseline: 'stable_diffusion_xl',
    style: 'realistic',
    tags: ['landscape'],
    nsfw: false,
  },
];

describe('BrowseModelsStore browser behavior', () => {
  let store: BrowseModelsStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        BrowseModelsStore,
        {
          provide: ModelReferenceApiService,
          useValue: {
            getDisplayModelsAsArray: vi.fn().mockReturnValue(of(imageModels)),
            getModelsInCategory: vi.fn().mockReturnValue(of({})),
            listFamilies: vi.fn().mockReturnValue(of({ families: [] })),
          },
        },
        {
          provide: HordeApiService,
          useValue: { getCombinedModelData: vi.fn().mockReturnValue(of({})) },
        },
        { provide: StatisticsService, useValue: {} },
        {
          provide: PendingQueueSummaryService,
          useValue: { records: signal([]) },
        },
      ],
    });

    store = TestBed.inject(BrowseModelsStore);
    store.loadCategory('image_generation');
  });

  it('combines independent concepts and requires every selected tag', () => {
    store.hydrateFromParams({ tags: 'portrait,featured', nsfw: 'sfw' });

    expect(store.filteredModels().map((model) => model.name)).toEqual(['Aurora Portrait']);
    expect(store.facets().tags[0]).toEqual({ value: 'portrait', label: 'portrait', count: 2 });
  });

  it('restores the complete browser state from a shareable URL', () => {
    store.hydrateFromParams({
      q: 'portrait',
      sort: 'name',
      layout: 'cards',
      baselines: 'flux_1',
      styles: 'realistic',
      groups: 'Atlas',
      families: 'Atlas family',
      tags: 'featured',
      nsfw: 'sfw',
      pending: 'true',
    });

    expect(store.toQueryParams()).toEqual({
      q: 'portrait',
      sort: 'name',
      direction: null,
      layout: 'cards',
      baselines: 'flux_1',
      styles: 'realistic',
      groups: 'Atlas',
      families: 'Atlas family',
      tags: 'featured',
      nsfw: 'sfw',
      pending: 'true',
    });

    store.hydrateFromParams({});

    expect(store.toQueryParams()).toEqual({
      sort: null,
      direction: null,
      layout: null,
      baselines: null,
      styles: null,
      groups: null,
      families: null,
      tags: null,
      nsfw: null,
      pending: null,
    });
  });

  it('does not discard URL-owned filters while a new category loads', () => {
    store.hydrateFromParams({ q: 'portrait', tags: 'portrait', layout: 'cards' });

    store.loadCategory('controlnet');

    expect(store.searchQuery()).toBe('portrait');
    expect(store.activeTags()).toEqual(['portrait']);
    expect(store.viewMode()).toBe('cards');
  });

  it('keeps exact text records actionable and makes grouping an alternate comparison', () => {
    const api = TestBed.inject(ModelReferenceApiService);
    vi.mocked(api.listFamilies).mockReturnValue(
      of({ families: [{ family_name: 'Atlas family', members: ['Atlas'] }] }),
    );
    vi.mocked(api.getModelsInCategory).mockReturnValue(
      of({
        'org/atlas-7b': {
          name: 'org/atlas-7b',
          display_name: '',
          text_model_group: 'Atlas',
          parameters: 7_000_000_000,
        },
        'org/atlas-13b': {
          name: 'org/atlas-13b',
          display_name: 'Atlas 13B',
          text_model_group: 'Atlas',
          parameters: 13_000_000_000,
        },
      }),
    );

    store.loadCategory('text_generation');

    expect(store.filteredModels().map((model) => model.name)).toEqual([
      'org/atlas-7b',
      'org/atlas-13b',
    ]);
    expect(store.groupedTextModels()).toHaveLength(1);
    expect(store.groupedTextModels()[0].members).toHaveLength(2);
    expect(browseModelDisplayName(store.filteredModels()[0])).toBe('atlas-7b');
    expect(store.filteredModels()[1].parameters_count).toBe(13_000_000_000);
    expect(store.filteredModels()[0].text_group_family).toBe('Atlas family');

    store.hydrateFromParams({ groups: 'Atlas', families: 'Atlas family' });
    expect(store.filteredModels().map((model) => model.name)).toEqual([
      'org/atlas-7b',
      'org/atlas-13b',
    ]);
    expect(store.toQueryParams()['groups']).toBe('Atlas');
    expect(store.toQueryParams()['families']).toBe('Atlas family');
  });

  it('click-style sorting reverses a column while keeping available models first', () => {
    const api = TestBed.inject(ModelReferenceApiService);
    const horde = TestBed.inject(HordeApiService);
    vi.mocked(api.getModelsInCategory).mockReturnValue(
      of({
        alpha: { name: 'alpha', parameters: 7_000_000_000 },
        zulu: { name: 'zulu', parameters: 13_000_000_000 },
      }),
    );
    vi.mocked(horde.getCombinedModelData).mockReturnValue(
      of({
        alpha: { worker_count: 0 },
        zulu: { worker_count: 2 },
      }),
    );
    store.loadCategory('text_generation');

    store.setSort('name');
    expect(store.sortDirection()).toBe('asc');
    expect(store.filteredModels().map((model) => model.name)).toEqual(['zulu', 'alpha']);

    store.setSort('name');
    expect(store.sortDirection()).toBe('desc');
    expect(store.filteredModels().map((model) => model.name)).toEqual(['zulu', 'alpha']);
  });

  it('reads the v2 wire alias for parameter count and repairs blank labels', () => {
    const model = toBrowseModel(
      { name: 'publisher/model-9b', display_name: '   ', parameters: 9_000_000_000 },
      'text_generation',
    );

    expect(model.parameters_count).toBe(9_000_000_000);
    expect(browseModelDisplayName(model)).toBe('model-9b');
  });
});
