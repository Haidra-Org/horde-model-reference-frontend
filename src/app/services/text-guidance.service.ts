import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BASE_PATH } from '../api-client';
import type { PendingChangeRecord } from '../api-client';
import type {
  GuidanceMigrationPreview,
  ResolvedTextGuidance,
  TextGuidanceAssignmentPage,
  TextGuidanceChangeSet,
  TextUsageProfile,
  TextUsageProfilePage,
} from '../models/text-guidance.models';

@Injectable({ providedIn: 'root' })
export class TextGuidanceService {
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(BASE_PATH);
  private readonly path = '/model_references/v2/text_generation/guidance';

  listProfiles(includeDeprecated = false): Observable<TextUsageProfilePage> {
    const params = new HttpParams().set('include_deprecated', includeDeprecated);
    return this.http.get<TextUsageProfilePage>(`${this.basePath}${this.path}/profiles`, { params });
  }

  getProfile(profileId: string): Observable<TextUsageProfile> {
    return this.http.get<TextUsageProfile>(
      `${this.basePath}${this.path}/profiles/${encodeURIComponent(profileId)}`,
    );
  }

  listAssignments(): Observable<TextGuidanceAssignmentPage> {
    return this.http.get<TextGuidanceAssignmentPage>(`${this.basePath}${this.path}/assignments`);
  }

  resolveModel(modelName: string): Observable<ResolvedTextGuidance> {
    const params = new HttpParams().set('name', modelName);
    return this.http.get<ResolvedTextGuidance>(`${this.basePath}${this.path}/model`, { params });
  }

  previewMigration(): Observable<GuidanceMigrationPreview> {
    return this.http.post<GuidanceMigrationPreview>(
      `${this.basePath}${this.path}/migration/preview`,
      {},
    );
  }

  submitChangeSet(changeSet: TextGuidanceChangeSet): Observable<PendingChangeRecord> {
    return this.http.post<PendingChangeRecord>(
      `${this.basePath}${this.path}/change-sets`,
      changeSet,
    );
  }
}
