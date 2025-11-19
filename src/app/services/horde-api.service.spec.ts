import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HordeApiService } from './horde-api.service';
import {
  HordeImageWorker,
  HordeModelStatsResponse,
  HordeModelStatus,
  HordeTextWorker,
  HordeTotalStatsResponse,
} from '../models/horde-api.models';
import { provideHttpClient } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { withDone } from '../../testing/with-done';

describe('HordeApiService', () => {
  let service: HordeApiService;
  let httpMock: HttpTestingController;

  const baseUrl = 'https://aihorde.net/api/v2';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(HordeApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getModelStatus', () => {
    it('should fetch image model status', withDone((done) => {
      const mockResponse: HordeModelStatus[] = [
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

      service.getModelStatus('image', 10).subscribe((data) => {
        expect(data).toEqual(mockResponse);
        expect(service.isLoading()).toBe(false);
        done();
      });

      const req = httpMock.expectOne(
        (request) =>
          request.url === `${baseUrl}/status/models` &&
          request.params.get('type') === 'image' &&
          request.params.get('min_count') === '10' &&
          request.params.get('model_state') === 'known',
      );
      expect(req.request.method).toBe('GET');
      req.flush(mockResponse);
    }));

    it('should handle errors gracefully', withDone((done) => {
      service.getModelStatus('image').subscribe((data) => {
        expect(data).toEqual([]);
        expect(service.isLoading()).toBe(false);
        done();
      });

      const req = httpMock.expectOne((request) => request.url.includes('status/models'));
      req.error(new ProgressEvent('Network error'));
    }));
  });

  describe('getModelStats', () => {
    it('should fetch image model stats', withDone((done) => {
      const mockResponse: HordeModelStatsResponse = {
        day: { 'AlbedoBase XL (SDXL)': 12010 },
        month: { 'AlbedoBase XL (SDXL)': 509919 },
        total: { 'AlbedoBase XL (SDXL)': 9929012 },
      };

      service.getModelStats('image').subscribe((data) => {
        expect(data).toEqual(mockResponse);
        expect(service.isLoading()).toBe(false);
        done();
      });

      const req = httpMock.expectOne(
        (request) =>
          request.url === `${baseUrl}/stats/img/models` &&
          request.params.get('model_state') === 'known',
      );
      expect(req.request.method).toBe('GET');
      req.flush(mockResponse);
    }));

    it('should fetch text model stats', withDone((done) => {
      const mockResponse: HordeModelStatsResponse = {
        day: { 'Test Model': 1975 },
        month: { 'Test Model': 15000 },
        total: { 'Test Model': 50000 },
      };

      service.getModelStats('text').subscribe((data) => {
        expect(data).toEqual(mockResponse);
        done();
      });

      const req = httpMock.expectOne((request) => request.url.includes('stats/text/models'));
      req.flush(mockResponse);
    }));

    it('should handle errors gracefully', withDone((done) => {
      service.getModelStats('image').subscribe((data) => {
        expect(data).toEqual({ day: {}, month: {}, total: {} });
        done();
      });

      const req = httpMock.expectOne((request) => request.url.includes('stats/img/models'));
      req.error(new ProgressEvent('Network error'));
    }));
  });

  describe('getTotalStats', () => {
    it('should fetch total image stats', withDone((done) => {
      const mockResponse: HordeTotalStatsResponse = {
        minute: { images: 114, ps: 2406862848 },
        hour: { images: 4641, ps: 104515403776 },
        day: { images: 115219, ps: 2476687925248 },
        month: { images: 3932580, ps: 77582109749248 },
        total: { images: 159090223, ps: 2580274521276416 },
      };

      service.getTotalStats('image').subscribe((data) => {
        expect(data).toEqual(mockResponse);
        done();
      });

      const req = httpMock.expectOne(`${baseUrl}/stats/img/totals`);
      expect(req.request.method).toBe('GET');
      req.flush(mockResponse);
    }));

    it('should fetch total text stats', withDone((done) => {
      const mockResponse: HordeTotalStatsResponse = {
        minute: { requests: 100, tokens: 29309 },
        hour: { requests: 5952, tokens: 1597720 },
        day: { requests: 157393, tokens: 42227151 },
        month: { requests: 4634361, tokens: 1287191375 },
        total: { requests: 237746762, tokens: 48258864255 },
      };

      service.getTotalStats('text').subscribe((data) => {
        expect(data).toEqual(mockResponse);
        done();
      });

      const req = httpMock.expectOne(`${baseUrl}/stats/text/totals`);
      req.flush(mockResponse);
    }));
  });

  describe('getWorkers', () => {
    it('should fetch worker by name', withDone((done) => {
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

      service.getWorkers({ name: 'CausticLogic' }).subscribe((data) => {
        expect(data).toEqual([mockImageWorker]);
        expect(service.isLoading()).toBe(false);
        done();
      });

      const req = httpMock.expectOne(
        (request) =>
          request.url === `${baseUrl}/workers` && request.params.get('name') === 'CausticLogic',
      );
      expect(req.request.method).toBe('GET');
      req.flush([mockImageWorker]);
    }));

    it('should fetch workers by type', withDone((done) => {
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

      service.getWorkers({ type: 'text' }).subscribe((data) => {
        expect(data).toEqual([mockTextWorker]);
        done();
      });

      const req = httpMock.expectOne(
        (request) => request.url === `${baseUrl}/workers` && request.params.get('type') === 'text',
      );
      req.flush([mockTextWorker]);
    }));

    it('should fetch all workers when no options provided', withDone((done) => {
      const mockWorkers = [
        {
          name: 'Worker1',
          id: 'id1',
          type: 'image' as const,
          performance: '1.0 megapixelsteps per second',
          requests_fulfilled: 100,
          kudos_rewards: 1000,
          kudos_details: { generated: 900, uptime: 100 },
          threads: 1,
          uptime: 1000,
          uncompleted_jobs: 0,
          maintenance_mode: false,
          nsfw: false,
          trusted: true,
          flagged: false,
          online: true,
          models: ['Model A'],
          team: { name: null, id: null },
          bridge_agent: 'Agent 1',
          max_pixels: 1024000,
          megapixelsteps_generated: 50000,
          img2img: true,
          painting: true,
          'post-processing': true,
          lora: true,
          controlnet: false,
          sdxl_controlnet: false,
        },
      ];

      service.getWorkers().subscribe((data) => {
        expect(data.length).toBeGreaterThan(0);
        done();
      });

      const req = httpMock.expectOne(
        (request) =>
          request.url === `${baseUrl}/workers` &&
          !request.params.has('name') &&
          !request.params.has('type'),
      );
      req.flush(mockWorkers);
    }));

    it('should handle errors gracefully', withDone((done) => {
      service.getWorkers({ name: 'NonExistent' }).subscribe((data) => {
        expect(data).toEqual([]);
        expect(service.isLoading()).toBe(false);
        done();
      });

      const req = httpMock.expectOne((request) => request.url.includes('workers'));
      req.error(new ProgressEvent('Network error'));
    }));
  });
});
