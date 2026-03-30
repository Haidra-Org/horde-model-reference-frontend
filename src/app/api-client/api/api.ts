export * from './audit.service';
import { AuditService } from './audit.service';
export * from './default.service';
import { DefaultService } from './default.service';
export * from './deletionRisk.service';
import { DeletionRiskService } from './deletionRisk.service';
export * from './metadata.service';
import { MetadataService } from './metadata.service';
export * from './pendingQueue.service';
import { PendingQueueService } from './pendingQueue.service';
export * from './search.service';
import { SearchService } from './search.service';
export * from './statistics.service';
import { StatisticsService } from './statistics.service';
export * from './user.service';
import { UserService } from './user.service';
export * from './v1.service';
import { V1Service } from './v1.service';
export * from './v1CreateUpdate.service';
import { V1CreateUpdateService } from './v1CreateUpdate.service';
export * from './v2.service';
import { V2Service } from './v2.service';
export const APIS = [
  AuditService,
  DefaultService,
  DeletionRiskService,
  MetadataService,
  PendingQueueService,
  SearchService,
  StatisticsService,
  UserService,
  V1Service,
  V1CreateUpdateService,
  V2Service,
];
