export * from './audit.service';
import { AuditService } from './audit.service';
export * from './default.service';
import { DefaultService } from './default.service';
export * from './metadata.service';
import { MetadataService } from './metadata.service';
export * from './statistics.service';
import { StatisticsService } from './statistics.service';
export * from './v1.service';
import { V1Service } from './v1.service';
export * from './v1CreateUpdate.service';
import { V1CreateUpdateService } from './v1CreateUpdate.service';
export * from './v2.service';
import { V2Service } from './v2.service';
export const APIS = [
  AuditService,
  DefaultService,
  MetadataService,
  StatisticsService,
  V1Service,
  V1CreateUpdateService,
  V2Service,
];
