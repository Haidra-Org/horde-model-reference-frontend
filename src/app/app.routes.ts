import { Routes } from '@angular/router';
import { HomeComponent } from './components/home/home.component';
import { ModelListComponent } from './components/model-list/model-list.component';
import { ModelFormComponent } from './components/model-form/model-form.component';
import { ModelAuditComponent } from './components/model-audit/model-audit.component';
import { TextModelGroupComponent } from './components/text-model-group/text-model-group.component';
import { CreateGroupWizardComponent } from './components/text-model-group/create-group-wizard.component';
import { PendingQueueComponent } from './components/pending-queue/pending-queue.component';
import { authenticatedGuard } from './guards/role.guard';
import { unsavedChangesGuard } from './guards/unsaved-changes.guard';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'categories/:category', component: ModelListComponent },
  { path: 'categories/:category/audit', component: ModelAuditComponent },
  {
    path: 'categories/:category/group/:groupName',
    component: TextModelGroupComponent,
    canDeactivate: [unsavedChangesGuard],
  },
  {
    path: 'categories/:category/create',
    component: ModelFormComponent,
    canDeactivate: [unsavedChangesGuard],
  },
  {
    path: 'categories/:category/create-group',
    component: CreateGroupWizardComponent,
    canDeactivate: [unsavedChangesGuard],
  },
  {
    path: 'categories/:category/edit/:modelName',
    component: ModelFormComponent,
    canDeactivate: [unsavedChangesGuard],
  },
  {
    path: 'pending-queue',
    component: PendingQueueComponent,
    canActivate: [authenticatedGuard],
  },
  // Redirect old audit trail route to the unified pending queue with history tab
  { path: 'pending-queue/audit', redirectTo: '/pending-queue?tab=history', pathMatch: 'full' },
];
