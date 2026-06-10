import { Routes } from '@angular/router';
import { DEFAULT_CATEGORY } from './shared/constants';
import { BrowseViewComponent } from './components/browse/browse-view.component';
import { TextModelGroupComponent } from './components/text-model-group/text-model-group.component';
import { GroupManagementComponent } from './components/text-model-group/group-management.component';
import { CreateGroupWizardComponent } from './components/text-model-group/create-group-wizard.component';
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
  {
    path: 'categories/:category/group-management',
    component: GroupManagementComponent,
  },
  {
    path: 'categories/:category/group/:groupName',
    component: TextModelGroupComponent,
    canDeactivate: [unsavedChangesGuard],
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
  // New feature routes (lazy-loaded; full implementations land in later phases)
  {
    path: 'text-groups',
    loadComponent: () =>
      import('./components/placeholder-page/placeholder-page.component').then(
        (m) => m.PlaceholderPageComponent,
      ),
    data: { title: 'Text Groups' },
  },
  {
    path: 'analytics',
    loadComponent: () =>
      import('./components/placeholder-page/placeholder-page.component').then(
        (m) => m.PlaceholderPageComponent,
      ),
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
      import('./components/placeholder-page/placeholder-page.component').then(
        (m) => m.PlaceholderPageComponent,
      ),
    data: { title: 'Deployment' },
  },
  {
    path: 'api-docs',
    loadComponent: () =>
      import('./components/placeholder-page/placeholder-page.component').then(
        (m) => m.PlaceholderPageComponent,
      ),
    data: { title: 'API & Docs' },
  },
];
