import { inject } from '@angular/core';
import { Router, Routes } from '@angular/router';
import { DEFAULT_CATEGORY } from './shared/constants';
import { BrowseViewComponent } from './components/browse/browse-view.component';
import { TextModelGroupComponent } from './components/text-model-group/text-model-group.component';
import { CreateGroupWizardComponent } from './components/text-model-group/create-group-wizard.component';
import { TextGroupsComponent } from './components/text-groups/text-groups.component';
import { TextFamiliesComponent } from './components/text-groups/text-families.component';
import { approverGuard, requestorGuard } from './guards/role.guard';
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
    // The old audit view is now the Analytics risk tab, which only curators see. Land
    // everyone on Analytics; the tab resolves for those entitled to it.
    path: 'categories/:category/audit',
    redirectTo: (route) =>
      inject(Router).createUrlTree(['/analytics'], {
        queryParams: { category: route.params['category'], tab: 'risk' },
      }),
    pathMatch: 'full',
  },
  // Redirect old text-group routes to new canonical paths
  {
    path: 'categories/:category/group/:groupName',
    // Group names can contain '/', which a path param can't carry — redirect to the
    // query-param form so the name survives intact.
    redirectTo: (route) =>
      inject(Router).createUrlTree(['/text-groups/group'], {
        queryParams: { name: route.params['groupName'] },
      }),
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
    canActivate: [requestorGuard],
    canDeactivate: [unsavedChangesGuard],
  },
  {
    path: 'categories/:category/create-group',
    component: CreateGroupWizardComponent,
    canActivate: [requestorGuard],
    canDeactivate: [unsavedChangesGuard],
  },
  {
    path: 'categories/:category/edit/:modelName',
    loadComponent: () =>
      import('./components/write-wizard/write-wizard.component').then(
        (m) => m.WriteWizardComponent,
      ),
    canActivate: [requestorGuard],
    canDeactivate: [unsavedChangesGuard],
  },
  {
    path: 'pending-queue',
    loadComponent: () =>
      import('./components/pending-queue/pending-queue.component').then(
        (m) => m.PendingQueueComponent,
      ),
    canActivate: [approverGuard],
  },
  // Redirect old audit trail route to the unified pending queue with history tab
  { path: 'pending-queue/audit', redirectTo: '/pending-queue?tab=history', pathMatch: 'full' },
  // Text Groups feature
  {
    path: 'text-groups',
    component: TextGroupsComponent,
  },
  {
    // Families and aliases is a curation surface: saved families, canonical resolution
    // rules and suggestions to review. The public group explorer at /text-groups stays open.
    path: 'text-groups/families',
    component: TextFamiliesComponent,
    canActivate: [requestorGuard],
  },
  {
    path: 'text-guidance',
    loadComponent: () =>
      import('./components/text-guidance/text-guidance.component').then(
        (m) => m.TextGuidanceComponent,
      ),
    data: { title: 'Text usage guidance' },
  },
  {
    // Group name travels as ?name= because group names may contain '/'.
    path: 'text-groups/group',
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
    path: 'licensing',
    loadComponent: () =>
      import('./components/licensing/licensing.component').then((m) => m.LicensingComponent),
    data: { title: 'Licensing' },
  },
  {
    path: 'propose',
    loadComponent: () =>
      import('./components/write-wizard/propose-entry.component').then(
        (m) => m.ProposeEntryComponent,
      ),
    canActivate: [requestorGuard],
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
  {
    path: '**',
    loadComponent: () =>
      import('./components/not-found/not-found.component').then((m) => m.NotFoundComponent),
  },
];
