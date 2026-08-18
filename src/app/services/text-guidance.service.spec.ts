import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BASE_PATH } from '../api-client';
import { TextGuidanceService } from './text-guidance.service';

describe('TextGuidanceService', () => {
  let service: TextGuidanceService;
  let http: HttpTestingController;
  const baseUrl = 'http://reference.test/api';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: BASE_PATH, useValue: baseUrl },
      ],
    });
    service = TestBed.inject(TextGuidanceService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('resolves guidance for the exact model identifier, including publisher slashes', () => {
    let status: string | undefined;
    service.resolveModel('publisher/model-7b').subscribe((response) => {
      status = response.summary.status;
    });

    const request = http.expectOne(
      (candidate) =>
        candidate.url.endsWith('/text_generation/guidance/model') &&
        candidate.params.get('name') === 'publisher/model-7b',
    );
    request.flush({
      model_name: 'publisher/model-7b',
      summary: { status: 'legacy_label', supplemental_profile_ids: [] },
      supplemental_profiles: [],
      legacy_instruct_format: 'ChatML',
      catalog_metadata: { schema_version: 1, revision: 2 },
    });

    expect(status).toBe('legacy_label');
  });

  it('loads assignment revisions so maintainers can submit conflict-safe replacements', () => {
    let revision: number | undefined;
    service.listAssignments().subscribe((response) => {
      revision = response.items[0]?.metadata?.revision;
    });

    const request = http.expectOne((candidate) =>
      candidate.url.endsWith('/text_generation/guidance/assignments'),
    );
    request.flush({
      items: [
        {
          model_name: 'publisher/model-7b',
          primary_profile_id: 'chatml',
          supplemental_profile_ids: [],
          metadata: { revision: 4 },
        },
      ],
      total: 1,
      metadata: { schema_version: 1, revision: 5 },
    });

    expect(revision).toBe(4);
  });

  it('submits a coherent catalog change as one review-queue resource', () => {
    const changeSet = {
      title: 'Assign ChatML',
      profile_changes: [],
      assignment_changes: [
        {
          model_name: 'publisher/model-7b',
          assignment: {
            model_name: 'publisher/model-7b',
            primary_profile_id: 'chatml',
            supplemental_profile_ids: [],
          },
          expected_before: null,
        },
      ],
    };
    let queuedId: number | undefined;
    service.submitChangeSet(changeSet).subscribe((record) => (queuedId = record.change_id));

    const request = http.expectOne((candidate) => candidate.url.endsWith('/guidance/change-sets'));
    expect(request.request.method).toBe('POST');
    expect(request.request.body.assignment_changes).toHaveLength(1);
    request.flush({
      change_id: 41,
      category: 'text_generation',
      model_name: 'guidance:proposal',
      operation: 'update',
      requested_by: 'maintainer',
      requested_username: 'maintainer',
      status: 'pending',
    });

    expect(queuedId).toBe(41);
  });
});
