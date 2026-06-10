import { Routes } from '@angular/router';
import { DEFAULT_CATEGORY } from './shared/constants';
import { BrowseViewComponent } from './components/browse/browse-view.component';
import { TextModelGroupComponent } from './components/text-model-group/text-model-group.component';
import { CreateGroupWizardComponent } from './components/text-model-group/create-group-wizard.component';
import { TextGroupsComponent } from './components/text-groups/text-groups.component';
import { TextFamiliesComponent } from './components/text-groups/text-families.component';
import { ReviewQueueComponent } from './components/review-queue/review-queue.component';
import { authenticatedGuard } from './guards/role.guard';
import { unsavedChangesGuard } from './guards/unsaved-changes.guard';

export const routes: Routes = [
  { path: '', redirectTo: `/categories/${DEFAULT_CATEGORY}`, pathMatch: 'full' },
  { path: 'categories/:category', component: BrowseViewComponent },
  {
    path: 'categories/:category/model/:modelName',
    loadComponent: () =>
      import('./components/model-detail/model-detail.component').then(
        (m) => m.ModelDetailComponent,
      ),
  },
  {
    path: 'categories/:category/audit',
    redirectTo: '/analytics?category=:category&tab=risk',
    pathMatch: 'full',
  },
  // Redirect old text-group routes to new canonical paths
  {
    path: 'categories/:category/group/:groupName',
    redirectTo: '/text-groups/:groupName',
    pathMatch: 'full',
  },
  {
    path: 'categories/:category/group-management',
    redirectTo: '/text-groups',
    pathMatch: 'full',
  },
  {
    path: 'categories/:category/create',
    loadComponent: () =>
      import('./components/write-wizard/write-wizard.component').then(
        (m) => m.WriteWizardComponent,
      ),
    canDeactivate: [unsavedChangesGuard],
  },
  {
    path: 'categories/:category/create-group',
    component: CreateGroupWizardComponent,
    canDeactivate: [unsavedChangesGuard],
  },
  {
    path: 'categories/:category/edit/:modelName',
    loadComponent: () =>
      import('./components/write-wizard/write-wizard.component').then(
        (m) => m.WriteWizardComponent,
      ),
    canDeactivate: [unsavedChangesGuard],
  },
  {
    path: 'pending-queue',
    component: ReviewQueueComponent,
    canActivate: [authenticatedGuard],
  },
  // Redirect old audit trail route to the unified pending queue with history tab
  { path: 'pending-queue/audit', redirectTo: '/pending-queue?tab=history', pathMatch: 'full' },
  // Text Groups feature
  {
    path: 'text-groups',
    component: TextGroupsComponent,
  },
  {
    path: 'text-groups/families',
    component: TextFamiliesComponent,
  },
  {
    path: 'text-groups/:group',
    component: TextModelGroupComponent,
    canDeactivate: [unsavedChangesGuard],
  },
  {
    path: 'analytics',
    loadComponent: () =>
      import('./components/analytics/analytics.component').then((m) => m.AnalyticsComponent),
    data: { title: 'Analytics' },
  },
  {
    path: 'propose',
    loadComponent: () =>
      import('./components/write-wizard/propose-entry.component').then(
        (m) => m.ProposeEntryComponent,
      ),
    data: { title: 'Propose a Change' },
  },
  {
    path: 'deployment',
    loadComponent: () =>
      import('./components/deployment/deployment.component').then((m) => m.DeploymentComponent),
  },
  {
    path: 'api-docs',
    loadComponent: () =>
      import('./components/api-docs/api-docs.component').then((m) => m.ApiDocsComponent),
  },
];
