export * from './default.service';
import { DefaultService } from './default.service';
export * from './modelReferenceV1.service';
import { ModelReferenceV1Service } from './modelReferenceV1.service';
export * from './modelReferenceV2.service';
import { ModelReferenceV2Service } from './modelReferenceV2.service';
export const APIS = [DefaultService, ModelReferenceV1Service, ModelReferenceV2Service];
