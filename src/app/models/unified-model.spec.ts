import {
  HordeImageWorker,
  HordeModelStatsResponse,
  HordeModelStatus,
  HordeTextWorker,
} from './horde-api.models';
import {
  associateWorkersWithModels,
  filterByMinWorkerCount,
  getWorkersForModel,
  hasActiveWorkers,
  hasHordeData,
  HordeWorkerSummary,
  mergeModelData,
  mergeMultipleModels,
  mergeMultipleBackendStatistics,
  sortByUsageTotal,
  sortByWorkerCount,
  UnifiedModelData,
  getDisplayName,
  groupTextModelsByBaseName,
  getBackendVariations,
  findModelByNameVariation,
  aggregateModelVariations,
} from './unified-model';
import {
  ImageGenerationModelRecordOutput,
  KNOWN_IMAGE_GENERATION_BASELINE,
  TextGenerationModelRecordOutput,
} from '../api-client';
import { TextBackend } from './text-model-name';

describe('Unified Model Utilities', () => {
  const mockReferenceModel: ImageGenerationModelRecordOutput = {
    name: 'AlbedoBase XL (SDXL)',
    baseline: 'stable_diffusion_xl' as KNOWN_IMAGE_GENERATION_BASELINE,
    nsfw: false,
  };

  const mockHordeStatus: HordeModelStatus[] = [
    {
      performance: 884156.6,
      queued: 1597177856.0,
      jobs: 390.0,
      eta: 129,
      type: 'image',
      name: 'AlbedoBase XL (SDXL)',
      count: 14,
    },
  ];

  const mockHordeStats: HordeModelStatsResponse = {
    day: { 'AlbedoBase XL (SDXL)': 12010 },
    month: { 'AlbedoBase XL (SDXL)': 509919 },
    total: { 'AlbedoBase XL (SDXL)': 9929012 },
  };

  describe('mergeModelData', () => {
    it('should merge reference data with Horde status and stats', () => {
      const result = mergeModelData(mockReferenceModel, mockHordeStatus, mockHordeStats);

      expect(result.name).toBe('AlbedoBase XL (SDXL)');
      expect(result.workerCount).toBe(14);
      expect(result.queuedJobs).toBe(390);
      expect(result.performance).toBe(884156.6);
      expect(result.eta).toBe(129);
      expect(result.queued).toBe(1597177856.0);
      expect(result.usageStats).toEqual({
        day: 12010,
        month: 509919,
        total: 9929012,
      });
    });

    it('should handle reference data without Horde data', () => {
      const result = mergeModelData(mockReferenceModel);

      expect(result.name).toBe('AlbedoBase XL (SDXL)');
      expect(result.workerCount).toBeUndefined();
      expect(result.usageStats).toBeUndefined();
    });

    it('should handle case-insensitive name matching for stats', () => {
      const lowerCaseModel: ImageGenerationModelRecordOutput = {
        ...mockReferenceModel,
        name: 'albedobase xl (sdxl)',
      };

      const result = mergeModelData(lowerCaseModel, mockHordeStatus, mockHordeStats);

      expect(result.usageStats).toEqual({
        day: 12010,
        month: 509919,
        total: 9929012,
      });
    });

    it('should handle missing stats for a model', () => {
      const unknownModel: ImageGenerationModelRecordOutput = {
        name: 'Unknown Model',
        baseline: 'stable_diffusion_1' as KNOWN_IMAGE_GENERATION_BASELINE,
        nsfw: false,
      };

      const result = mergeModelData(unknownModel, mockHordeStatus, mockHordeStats);

      expect(result.usageStats).toBeUndefined();
      expect(result.workerCount).toBeUndefined();
    });
  });

  describe('mergeMultipleModels', () => {
    it('should merge multiple models', () => {
      const models: ImageGenerationModelRecordOutput[] = [
        mockReferenceModel,
        {
          name: 'CyberRealistic Pony',
          baseline: 'stable_diffusion_xl' as KNOWN_IMAGE_GENERATION_BASELINE,
          nsfw: false,
        },
      ];

      const statusWithBoth: HordeModelStatus[] = [
        ...mockHordeStatus,
        {
          performance: 1046879.8,
          queued: 513802240.0,
          jobs: 130.0,
          eta: 40,
          type: 'image',
          name: 'CyberRealistic Pony',
          count: 12,
        },
      ];

      const result = mergeMultipleModels(models, statusWithBoth, mockHordeStats);

      expect(result.length).toBe(2);
      expect(result[0].workerCount).toBe(14);
      expect(result[1].workerCount).toBe(12);
    });
  });

  describe('sortByWorkerCount', () => {
    it('should sort models by worker count descending', () => {
      const models: UnifiedModelData[] = [
        { ...mockReferenceModel, workerCount: 5 },
        { ...mockReferenceModel, name: 'Model B', workerCount: 15 },
        { ...mockReferenceModel, name: 'Model C', workerCount: 10 },
      ];

      const result = sortByWorkerCount(models);

      expect(result[0].workerCount).toBe(15);
      expect(result[1].workerCount).toBe(10);
      expect(result[2].workerCount).toBe(5);
    });

    it('should sort models by worker count ascending', () => {
      const models: UnifiedModelData[] = [
        { ...mockReferenceModel, workerCount: 5 },
        { ...mockReferenceModel, name: 'Model B', workerCount: 15 },
        { ...mockReferenceModel, name: 'Model C', workerCount: 10 },
      ];

      const result = sortByWorkerCount(models, false);

      expect(result[0].workerCount).toBe(5);
      expect(result[1].workerCount).toBe(10);
      expect(result[2].workerCount).toBe(15);
    });

    it('should treat undefined worker counts as zero', () => {
      const models: UnifiedModelData[] = [
        { ...mockReferenceModel, workerCount: 5 },
        { ...mockReferenceModel, name: 'Model B' },
        { ...mockReferenceModel, name: 'Model C', workerCount: 10 },
      ];

      const result = sortByWorkerCount(models);

      expect(result[0].workerCount).toBe(10);
      expect(result[1].workerCount).toBe(5);
      expect(result[2].workerCount).toBeUndefined();
    });
  });

  describe('sortByUsageTotal', () => {
    it('should sort models by usage total descending', () => {
      const models: UnifiedModelData[] = [
        {
          ...mockReferenceModel,
          usageStats: { day: 100, month: 1000, total: 5000 },
        },
        {
          ...mockReferenceModel,
          name: 'Model B',
          usageStats: { day: 200, month: 2000, total: 15000 },
        },
        {
          ...mockReferenceModel,
          name: 'Model C',
          usageStats: { day: 150, month: 1500, total: 10000 },
        },
      ];

      const result = sortByUsageTotal(models);

      expect(result[0].usageStats?.total).toBe(15000);
      expect(result[1].usageStats?.total).toBe(10000);
      expect(result[2].usageStats?.total).toBe(5000);
    });
  });

  describe('filterByMinWorkerCount', () => {
    it('should filter models by minimum worker count', () => {
      const models: UnifiedModelData[] = [
        { ...mockReferenceModel, workerCount: 5 },
        { ...mockReferenceModel, name: 'Model B', workerCount: 15 },
        { ...mockReferenceModel, name: 'Model C', workerCount: 10 },
        { ...mockReferenceModel, name: 'Model D' },
      ];

      const result = filterByMinWorkerCount(models, 8);

      expect(result.length).toBe(2);
      expect(result[0].workerCount).toBe(15);
      expect(result[1].workerCount).toBe(10);
    });
  });

  describe('hasHordeData', () => {
    it('should return true if model has worker count', () => {
      const model: UnifiedModelData = {
        ...mockReferenceModel,
        workerCount: 10,
      };
      expect(hasHordeData(model)).toBe(true);
    });

    it('should return true if model has queued jobs', () => {
      const model: UnifiedModelData = {
        ...mockReferenceModel,
        queuedJobs: 50,
      };
      expect(hasHordeData(model)).toBe(true);
    });

    it('should return true if model has usage stats', () => {
      const model: UnifiedModelData = {
        ...mockReferenceModel,
        usageStats: { day: 100, month: 1000, total: 5000 },
      };
      expect(hasHordeData(model)).toBe(true);
    });

    it('should return false if model has no Horde data', () => {
      const model: UnifiedModelData = { ...mockReferenceModel };
      expect(hasHordeData(model)).toBe(false);
    });
  });

  describe('getWorkersForModel', () => {
    const mockImageWorker: HordeImageWorker = {
      name: 'CausticLogic',
      id: '12345678-1234-1234-1234-123456789abc',
      type: 'image',
      performance: '0.4 megapixelsteps per second',
      requests_fulfilled: 96266,
      kudos_rewards: 4390902.0,
      kudos_details: {
        generated: 4240166.0,
        uptime: 151922,
      },
      threads: 1,
      uptime: 1201584,
      uncompleted_jobs: 386,
      maintenance_mode: false,
      nsfw: true,
      trusted: true,
      flagged: false,
      online: true,
      models: ['AlbedoBase XL (SDXL)', 'Pony Diffusion XL'],
      team: {
        name: null,
        id: null,
      },
      bridge_agent: 'AI Horde Worker reGen:10.1.1',
      max_pixels: 589824,
      megapixelsteps_generated: 2468784.0,
      img2img: true,
      painting: true,
      'post-processing': true,
      lora: true,
      controlnet: true,
      sdxl_controlnet: false,
    };

    const mockTextWorker: HordeTextWorker = {
      name: 'hugalafutro_hetzner2',
      id: '87654321-4321-4321-4321-cba987654321',
      type: 'text',
      performance: '4.1 tokens per second',
      requests_fulfilled: 651678,
      kudos_rewards: 4017372.0,
      kudos_details: {
        generated: 1963657.0,
        uptime: 2175253,
      },
      threads: 1,
      uptime: 34482576,
      uncompleted_jobs: 2354,
      maintenance_mode: false,
      nsfw: true,
      trusted: true,
      flagged: false,
      online: true,
      models: ['Mistral 7B', 'Llama 2 13B'],
      team: {
        name: null,
        id: null,
      },
      bridge_agent: 'KoboldCppEmbedWorker:2:https://github.com/LostRuins/koboldcpp',
      max_length: 512,
      max_context_length: 2048,
      info: 'hetzner cloud cx32 vm',
    };

    it('should find workers serving a specific model', () => {
      const workers = getWorkersForModel('AlbedoBase XL (SDXL)', [mockImageWorker, mockTextWorker]);

      expect(workers.length).toBe(1);
      expect(workers[0].name).toBe('CausticLogic');
      expect(workers[0].id).toBe('12345678-1234-1234-1234-123456789abc');
      expect(workers[0].performance).toBe('0.4 megapixelsteps per second');
      expect(workers[0].online).toBe(true);
      expect(workers[0].trusted).toBe(true);
      expect(workers[0].uptime).toBe(1201584);
    });

    it('should match model names case-insensitively', () => {
      const workers = getWorkersForModel('albedobase xl (sdxl)', [mockImageWorker]);

      expect(workers.length).toBe(1);
      expect(workers[0].name).toBe('CausticLogic');
    });

    it('should return empty array if no workers serve the model', () => {
      const workers = getWorkersForModel('Unknown Model', [mockImageWorker]);

      expect(workers.length).toBe(0);
    });

    it('should return multiple workers if multiple serve the model', () => {
      const anotherWorker: HordeImageWorker = {
        ...mockImageWorker,
        id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        name: 'AnotherWorker',
      };

      const workers = getWorkersForModel('AlbedoBase XL (SDXL)', [mockImageWorker, anotherWorker]);

      expect(workers.length).toBe(2);
      expect(workers[0].name).toBe('CausticLogic');
      expect(workers[1].name).toBe('AnotherWorker');
    });
  });

  describe('associateWorkersWithModels', () => {
    const mockImageWorker: HordeImageWorker = {
      name: 'CausticLogic',
      id: '12345678-1234-1234-1234-123456789abc',
      type: 'image',
      performance: '0.4 megapixelsteps per second',
      requests_fulfilled: 96266,
      kudos_rewards: 4390902.0,
      kudos_details: {
        generated: 4240166.0,
        uptime: 151922,
      },
      threads: 1,
      uptime: 1201584,
      uncompleted_jobs: 386,
      maintenance_mode: false,
      nsfw: true,
      trusted: true,
      flagged: false,
      online: true,
      models: ['AlbedoBase XL (SDXL)', 'Pony Diffusion XL'],
      team: {
        name: null,
        id: null,
      },
      bridge_agent: 'AI Horde Worker reGen:10.1.1',
      max_pixels: 589824,
      megapixelsteps_generated: 2468784.0,
      img2img: true,
      painting: true,
      'post-processing': true,
      lora: true,
      controlnet: true,
      sdxl_controlnet: false,
    };

    it('should associate workers with models', () => {
      const models = [mockReferenceModel];

      const result = associateWorkersWithModels(
        models,
        [mockImageWorker],
        mockHordeStatus,
        mockHordeStats,
      );

      expect(result.length).toBe(1);
      expect(result[0].name).toBe('AlbedoBase XL (SDXL)');
      expect(result[0].workers?.length).toBe(1);
      expect(result[0].workers?.[0].name).toBe('CausticLogic');
      expect(result[0].workerCount).toBe(14);
      expect(result[0].usageStats).toEqual({
        day: 12010,
        month: 509919,
        total: 9929012,
      });
    });

    it('should not add workers field if no workers serve the model', () => {
      const unknownModel: ImageGenerationModelRecordOutput = {
        name: 'Unknown Model',
        baseline: 'stable_diffusion_1' as KNOWN_IMAGE_GENERATION_BASELINE,
        nsfw: false,
      };

      const result = associateWorkersWithModels([unknownModel], [mockImageWorker]);

      expect(result.length).toBe(1);
      expect(result[0].workers).toBeUndefined();
    });

    it('should handle multiple models with different workers', () => {
      const ponyModel: ImageGenerationModelRecordOutput = {
        name: 'Pony Diffusion XL',
        baseline: 'stable_diffusion_xl' as KNOWN_IMAGE_GENERATION_BASELINE,
        nsfw: false,
      };

      const result = associateWorkersWithModels([mockReferenceModel, ponyModel], [mockImageWorker]);

      expect(result.length).toBe(2);
      expect(result[0].workers?.length).toBe(1);
      expect(result[1].workers?.length).toBe(1);
      expect(result[0].workers?.[0].name).toBe('CausticLogic');
      expect(result[1].workers?.[0].name).toBe('CausticLogic');
    });
  });

  describe('hasActiveWorkers', () => {
    const onlineWorker: HordeWorkerSummary = {
      id: 'id1',
      name: 'Worker1',
      performance: '1.0 megapixelsteps per second',
      online: true,
      trusted: true,
      uptime: 1000,
    };

    const offlineWorker: HordeWorkerSummary = {
      id: 'id2',
      name: 'Worker2',
      performance: '0.5 megapixelsteps per second',
      online: false,
      trusted: true,
      uptime: 500,
    };

    it('should return true if model has workerCount > 0', () => {
      const model: UnifiedModelData = {
        ...mockReferenceModel,
        workerCount: 5,
      };

      expect(hasActiveWorkers(model)).toBe(true);
    });

    it('should return false if model has workerCount = 0', () => {
      const model: UnifiedModelData = {
        ...mockReferenceModel,
        workerCount: 0,
      };

      expect(hasActiveWorkers(model)).toBe(false);
    });

    it('should return true if model has online workers', () => {
      const model: UnifiedModelData = {
        ...mockReferenceModel,
        workers: [onlineWorker],
      };

      expect(hasActiveWorkers(model)).toBe(true);
    });

    it('should return false if model has only offline workers', () => {
      const model: UnifiedModelData = {
        ...mockReferenceModel,
        workers: [offlineWorker],
      };

      expect(hasActiveWorkers(model)).toBe(false);
    });

    it('should return true if at least one worker is online', () => {
      const model: UnifiedModelData = {
        ...mockReferenceModel,
        workers: [offlineWorker, onlineWorker],
      };

      expect(hasActiveWorkers(model)).toBe(true);
    });

    it('should return false if model has no workers', () => {
      const model: UnifiedModelData = {
        ...mockReferenceModel,
      };

      expect(hasActiveWorkers(model)).toBe(false);
    });

    it('should return false if workers array is empty', () => {
      const model: UnifiedModelData = {
        ...mockReferenceModel,
        workers: [],
      };

      expect(hasActiveWorkers(model)).toBe(false);
    });

    it('should prioritize workerCount over workers array', () => {
      const model: UnifiedModelData = {
        ...mockReferenceModel,
        workerCount: 3,
        workers: [offlineWorker], // has offline worker but workerCount says 3
      };

      expect(hasActiveWorkers(model)).toBe(true);
    });
  });

  describe('Text Model Name Support', () => {
    const textModel1: TextGenerationModelRecordOutput = {
      name: 'L3-Super-Nova-RP-8B',
      parameters: 8000000000,
    };

    const textModel2: TextGenerationModelRecordOutput = {
      name: 'Casual-Autopsy/L3-Super-Nova-RP-8B',
      parameters: 8000000000,
    };

    const textModel3: TextGenerationModelRecordOutput = {
      name: 'aphrodite/Casual-Autopsy/L3-Super-Nova-RP-8B',
      parameters: 8000000000,
    };

    const textModel4: TextGenerationModelRecordOutput = {
      name: 'koboldcpp/L3-Super-Nova-RP-8B',
      parameters: 8000000000,
    };

    describe('mergeModelData with text model names', () => {
      it('should parse text model names when option is enabled', () => {
        const result = mergeModelData(textModel3, undefined, undefined, {
          parseTextModelNames: true,
        });

        expect(result.parsedName).toBeDefined();
        expect(result.parsedName?.modelName).toBe('L3-Super-Nova-RP-8B');
        expect(result.parsedName?.author).toBe('Casual-Autopsy');
        expect(result.parsedName?.backend).toBe(TextBackend.Aphrodite);
      });

      it('should not parse text model names when option is disabled', () => {
        const result = mergeModelData(textModel3);

        expect(result.parsedName).toBeUndefined();
      });
    });

    describe('getDisplayName', () => {
      it('should return base name for parsed text models', () => {
        const model = mergeModelData(textModel3, undefined, undefined, {
          parseTextModelNames: true,
        });

        expect(getDisplayName(model)).toBe('L3-Super-Nova-RP-8B');
      });

      it('should return full name for unparsed models', () => {
        const model = mergeModelData(textModel3);

        expect(getDisplayName(model)).toBe('aphrodite/Casual-Autopsy/L3-Super-Nova-RP-8B');
      });

      it('should return full name for image models', () => {
        const model = mergeModelData(mockReferenceModel);

        expect(getDisplayName(model)).toBe('AlbedoBase XL (SDXL)');
      });
    });

    describe('groupTextModelsByBaseName', () => {
      it('should group models by base name', () => {
        const models = [
          mergeModelData(textModel1, undefined, undefined, {
            parseTextModelNames: true,
          }),
          mergeModelData(textModel2, undefined, undefined, {
            parseTextModelNames: true,
          }),
          mergeModelData(textModel3, undefined, undefined, {
            parseTextModelNames: true,
          }),
          mergeModelData(textModel4, undefined, undefined, {
            parseTextModelNames: true,
          }),
        ];

        const groups = groupTextModelsByBaseName(models);

        expect(groups.size).toBe(1); // All 4 models group under "L3-Super-Nova-RP-8B"
        expect(groups.get('L3-Super-Nova-RP-8B')?.length).toBe(4); // All 4 models together
      });

      it('should not group unparsed models', () => {
        const models = [
          mergeModelData(textModel1),
          mergeModelData(textModel2),
          mergeModelData(textModel3),
        ];

        const groups = groupTextModelsByBaseName(models);

        expect(groups.size).toBe(3);
      });
    });

    describe('getBackendVariations', () => {
      it('should find all backend variations of a model', () => {
        const models = [
          mergeModelData(textModel1, undefined, undefined, {
            parseTextModelNames: true,
          }),
          mergeModelData(textModel4, undefined, undefined, {
            parseTextModelNames: true,
          }),
        ];

        const variations = getBackendVariations(models, 'L3-Super-Nova-RP-8B');

        expect(variations.length).toBe(2);
        expect(variations.map((v) => v.name)).toContain('L3-Super-Nova-RP-8B');
        expect(variations.map((v) => v.name)).toContain('koboldcpp/L3-Super-Nova-RP-8B');
      });

      it('should handle case-insensitive matching', () => {
        const models = [
          mergeModelData(textModel1, undefined, undefined, {
            parseTextModelNames: true,
          }),
        ];

        const variations = getBackendVariations(models, 'l3-super-nova-rp-8b');

        expect(variations.length).toBe(1);
      });

      it('should return empty array if no matches', () => {
        const models = [
          mergeModelData(textModel1, undefined, undefined, {
            parseTextModelNames: true,
          }),
        ];

        const variations = getBackendVariations(models, 'NonExistent');

        expect(variations.length).toBe(0);
      });
    });

    describe('findModelByNameVariation', () => {
      it('should find model by exact name match', () => {
        const models = [
          mergeModelData(textModel1, undefined, undefined, {
            parseTextModelNames: true,
          }),
          mergeModelData(textModel3, undefined, undefined, {
            parseTextModelNames: true,
          }),
        ];

        const found = findModelByNameVariation(
          models,
          'aphrodite/Casual-Autopsy/L3-Super-Nova-RP-8B',
        );

        expect(found).toBeDefined();
        expect(found?.name).toBe('aphrodite/Casual-Autopsy/L3-Super-Nova-RP-8B');
      });

      it('should find model by base name when exact match not found', () => {
        const models = [
          mergeModelData(textModel3, undefined, undefined, {
            parseTextModelNames: true,
          }),
        ];

        const found = findModelByNameVariation(models, 'L3-Super-Nova-RP-8B');

        expect(found).toBeDefined();
        expect(found?.parsedName?.modelName).toBe('L3-Super-Nova-RP-8B');
      });

      it('should return undefined if no match found', () => {
        const models = [
          mergeModelData(textModel1, undefined, undefined, {
            parseTextModelNames: true,
          }),
        ];

        const found = findModelByNameVariation(models, 'NonExistent');

        expect(found).toBeUndefined();
      });

      it('should handle case-insensitive search', () => {
        const models = [
          mergeModelData(textModel1, undefined, undefined, {
            parseTextModelNames: true,
          }),
        ];

        const found = findModelByNameVariation(models, 'l3-super-nova-rp-8b');

        expect(found).toBeDefined();
      });
    });

    describe('aggregateModelVariations', () => {
      const mockStatus1: HordeModelStatus[] = [
        {
          name: 'L3-Super-Nova-RP-8B',
          count: 5,
          jobs: 10,
          performance: 100,
          eta: 60,
          queued: 1000,
          type: 'text',
        },
      ];

      const mockStatus2: HordeModelStatus[] = [
        {
          name: 'koboldcpp/L3-Super-Nova-RP-8B',
          count: 3,
          jobs: 5,
          performance: 80,
          eta: 90,
          queued: 500,
          type: 'text',
        },
      ];

      const mockStats: HordeModelStatsResponse = {
        day: {
          'L3-Super-Nova-RP-8B': 100,
          'koboldcpp/L3-Super-Nova-RP-8B': 50,
        },
        month: {
          'L3-Super-Nova-RP-8B': 1000,
          'koboldcpp/L3-Super-Nova-RP-8B': 500,
        },
        total: {
          'L3-Super-Nova-RP-8B': 10000,
          'koboldcpp/L3-Super-Nova-RP-8B': 5000,
        },
      };

      it('should aggregate worker counts across variations', () => {
        const models = [
          mergeModelData(textModel1, mockStatus1, mockStats, {
            parseTextModelNames: true,
          }),
          mergeModelData(textModel4, mockStatus2, mockStats, {
            parseTextModelNames: true,
          }),
        ];

        const result = aggregateModelVariations(models);

        expect(result.totalWorkerCount).toBe(8); // 5 + 3
        expect(result.totalQueuedJobs).toBe(15); // 10 + 5
      });

      it('should combine usage stats across variations', () => {
        const models = [
          mergeModelData(textModel1, mockStatus1, mockStats, {
            parseTextModelNames: true,
          }),
          mergeModelData(textModel4, mockStatus2, mockStats, {
            parseTextModelNames: true,
          }),
        ];

        const result = aggregateModelVariations(models);

        expect(result.combinedUsageStats).toBeDefined();
        expect(result.combinedUsageStats?.day).toBe(150); // 100 + 50
        expect(result.combinedUsageStats?.month).toBe(1500); // 1000 + 500
        expect(result.combinedUsageStats?.total).toBe(15000); // 10000 + 5000
      });

      it('should deduplicate workers across variations', () => {
        const worker1: HordeWorkerSummary = {
          id: 'worker1',
          name: 'Worker 1',
          performance: '100 MPS/s',
          online: true,
          trusted: true,
          uptime: 3600,
        };

        const worker2: HordeWorkerSummary = {
          id: 'worker2',
          name: 'Worker 2',
          performance: '80 MPS/s',
          online: true,
          trusted: false,
          uptime: 1800,
        };

        const model1 = mergeModelData(textModel1, mockStatus1, mockStats, {
          parseTextModelNames: true,
        });
        model1.workers = [worker1, worker2];

        const model2 = mergeModelData(textModel4, mockStatus2, mockStats, {
          parseTextModelNames: true,
        });
        model2.workers = [worker1]; // Same worker as in model1

        const result = aggregateModelVariations([model1, model2]);

        expect(result.allWorkers.length).toBe(2); // Should deduplicate worker1
        expect(result.allWorkers.map((w) => w.id)).toContain('worker1');
        expect(result.allWorkers.map((w) => w.id)).toContain('worker2');
      });

      it('should handle models with no stats', () => {
        const models = [
          mergeModelData(textModel1, undefined, undefined, {
            parseTextModelNames: true,
          }),
          mergeModelData(textModel4, undefined, undefined, {
            parseTextModelNames: true,
          }),
        ];

        const result = aggregateModelVariations(models);

        expect(result.totalWorkerCount).toBe(0);
        expect(result.totalQueuedJobs).toBe(0);
        expect(result.combinedUsageStats).toBeUndefined();
        expect(result.allWorkers.length).toBe(0);
      });

      it('should handle empty array', () => {
        const result = aggregateModelVariations([]);

        expect(result.totalWorkerCount).toBe(0);
        expect(result.totalQueuedJobs).toBe(0);
        expect(result.combinedUsageStats).toBeUndefined();
        expect(result.allWorkers.length).toBe(0);
      });
    });

    describe('groupTextModelsByBaseName with text_model_group', () => {
      it('should prefer backend text_model_group over client-side parsing', () => {
        const models: UnifiedModelData[] = [
          {
            name: 'ReadyArt/Broken-Tutu-24B-Unslop-v2.0',
            text_model_group: 'Broken-Tutu-24B',
            parsedName: {
              originalName: 'ReadyArt/Broken-Tutu-24B-Unslop-v2.0',
              fullName: 'ReadyArt/Broken-Tutu-24B-Unslop-v2.0',
              author: 'ReadyArt',
              modelName: 'Broken-Tutu-24B-Unslop-v2.0',
              backend: undefined,
            },
          } as UnifiedModelData,
          {
            name: 'ReadyArt/Broken-Tutu-24B-Transgression-v2.0',
            text_model_group: 'Broken-Tutu-24B',
            parsedName: {
              originalName: 'ReadyArt/Broken-Tutu-24B-Transgression-v2.0',
              fullName: 'ReadyArt/Broken-Tutu-24B-Transgression-v2.0',
              author: 'ReadyArt',
              modelName: 'Broken-Tutu-24B-Transgression-v2.0',
              backend: undefined,
            },
          } as UnifiedModelData,
        ];

        const groups = groupTextModelsByBaseName(models);

        expect(groups.size).toBe(1);
        expect(groups.has('Broken-Tutu-24B')).toBe(true);
        expect(groups.get('Broken-Tutu-24B')?.length).toBe(2);
      });

      it('should fall back to client-side parsing when text_model_group is missing', () => {
        const models: UnifiedModelData[] = [
          {
            name: 'acrastt/Marx-3B-V3',
            parsedName: {
              originalName: 'acrastt/Marx-3B-V3',
              fullName: 'acrastt/Marx-3B-V3',
              author: 'acrastt',
              modelName: 'Marx-3B-V3',
              backend: undefined,
            },
          } as UnifiedModelData,
        ];

        const groups = groupTextModelsByBaseName(models);

        expect(groups.size).toBe(1);
        // Should use parsed name extraction (removes author, size, version suffixes)
        expect(Array.from(groups.keys())[0]).toBeDefined();
      });

      it('should handle models without parsedName or text_model_group', () => {
        const models: UnifiedModelData[] = [
          {
            name: 'SomeUnparsedModel',
          } as UnifiedModelData,
        ];

        const groups = groupTextModelsByBaseName(models);

        expect(groups.size).toBe(1);
        expect(groups.has('SomeUnparsedModel')).toBe(true);
      });

      it('should group different variations with same text_model_group', () => {
        const models: UnifiedModelData[] = [
          {
            name: 'meta-llama/Llama-3-8B-Instruct',
            text_model_group: 'Llama-3',
          } as UnifiedModelData,
          {
            name: 'meta-llama/Llama-3-70B-Instruct',
            text_model_group: 'Llama-3',
          } as UnifiedModelData,
          {
            name: 'aphrodite/meta-llama/Llama-3-8B-Instruct',
            text_model_group: 'Llama-3',
          } as UnifiedModelData,
        ];

        const groups = groupTextModelsByBaseName(models);

        expect(groups.size).toBe(1);
        expect(groups.get('Llama-3')?.length).toBe(3);
      });
    });

    describe('mergeMultipleBackendStatistics', () => {
      it('should not create duplicate entries when backend_variations include canonical name', () => {
        // Simulate the backend response where a model has backend_variations
        // that include the canonical (non-prefixed) variant
        const referenceModels = [
          {
            name: 'Qwen/Qwen3-1.7B',
            baseline: 'qwen',
          },
        ];

        const backendStats = {
          'Qwen/Qwen3-1.7B': {
            worker_count: 0,
            queued_jobs: 0,
            performance: null,
            eta: null,
            queued: null,
            usage_stats: {
              day: 500,
              month: 26286,
              total: 26286,
            },
            worker_summaries: null,
            backend_variations: {
              canonical: {
                backend: 'canonical',
                variant_name: 'Qwen/Qwen3-1.7B',
                worker_count: 0,
                performance: null,
                queued: null,
                queued_jobs: null,
                eta: null,
                usage_day: 500,
                usage_month: 26286,
                usage_total: 26286,
              },
            },
          },
        };

        const result = mergeMultipleBackendStatistics(referenceModels, backendStats, {
          parseTextModelNames: true,
        });

        // Should only have ONE entry for Qwen/Qwen3-1.7B, not two
        const qwenEntries = result.filter((m) => m.name === 'Qwen/Qwen3-1.7B');
        expect(qwenEntries.length).toBe(
          1,
          'Should not create duplicate entries for canonical model',
        );

        // Verify the entry has the correct stats
        expect(qwenEntries[0].usageStats).toEqual({
          day: 500,
          month: 26286,
          total: 26286,
        });
      });

      it('should handle multiple backend variations without duplicates', () => {
        const referenceModels = [
          {
            name: 'Qwen/Qwen3-8B',
            baseline: 'qwen',
          },
        ];

        const backendStats = {
          'Qwen/Qwen3-8B': {
            worker_count: 0,
            queued_jobs: 0,
            performance: null,
            eta: null,
            queued: null,
            usage_stats: {
              day: 100,
              month: 2898,
              total: 2898,
            },
            worker_summaries: null,
            backend_variations: {
              canonical: {
                backend: 'canonical',
                variant_name: 'Qwen/Qwen3-8B',
                worker_count: 0,
                performance: null,
                queued: null,
                queued_jobs: null,
                eta: null,
                usage_day: 100,
                usage_month: 2898,
                usage_total: 2898,
              },
              koboldcpp: {
                backend: 'koboldcpp',
                variant_name: 'koboldcpp/Qwen3-8B',
                worker_count: 1,
                performance: 50.5,
                queued: 0,
                queued_jobs: 0,
                eta: 0,
                usage_day: 50,
                usage_month: 1500,
                usage_total: 1500,
              },
            },
          },
        };

        const result = mergeMultipleBackendStatistics(referenceModels, backendStats, {
          parseTextModelNames: true,
        });

        // Should have exactly 2 entries: canonical and koboldcpp
        expect(result.length).toBe(2, 'Should have exactly two entries (canonical + koboldcpp)');

        const canonicalEntry = result.find((m) => m.name === 'Qwen/Qwen3-8B');
        const koboldcppEntry = result.find((m) => m.name === 'koboldcpp/Qwen3-8B');

        expect(canonicalEntry).toBeDefined('Should have canonical entry');
        expect(koboldcppEntry).toBeDefined('Should have koboldcpp entry');

        // Verify no duplicate canonical entries
        const canonicalEntries = result.filter((m) => m.name === 'Qwen/Qwen3-8B');
        expect(canonicalEntries.length).toBe(1, 'Should have exactly one canonical entry');
      });
    });
  });
});
