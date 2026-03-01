import type {
  PendingQueueAuditBatchDetail as ApiPendingQueueAuditBatchDetail,
  PendingQueueAuditBatchPage as ApiPendingQueueAuditBatchPage,
  PendingQueueAuditBatchSummary as ApiPendingQueueAuditBatchSummary,
  PendingQueueAuditChange as ApiPendingQueueAuditChange,
  PendingQueueAuditCurrentResponse as ApiPendingQueueAuditCurrentResponse,
  PendingQueueAuditEvent as ApiPendingQueueAuditEvent,
} from '../api-client';
import { AuditDomain as ApiAuditDomain } from '../api-client';

export type AuditDomain = ApiAuditDomain;

export const AUDIT_DOMAINS: AuditDomain[] = [ApiAuditDomain.Legacy, ApiAuditDomain.V2];

export type PendingQueueAuditEvent = ApiPendingQueueAuditEvent;
export type PendingQueueAuditChange = ApiPendingQueueAuditChange;
export type PendingQueueAuditBatchSummary = ApiPendingQueueAuditBatchSummary;
export type PendingQueueAuditBatchDetail = ApiPendingQueueAuditBatchDetail;
export type PendingQueueAuditBatchPage = ApiPendingQueueAuditBatchPage;
export type PendingQueueAuditCurrentResponse = ApiPendingQueueAuditCurrentResponse;

export interface PendingQueueAuditListOptions {
  domain?: AuditDomain | null;
  cursor?: number | null;
  limit?: number;
}

export interface PendingQueueAuditDetailOptions {
  domain?: AuditDomain | null;
  forceRefresh?: boolean;
}

export const AUDIT_STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
