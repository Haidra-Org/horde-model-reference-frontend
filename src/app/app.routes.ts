import { Routes } from '@angular/router';
import { HomeComponent } from './components/home/home.component';
import { ModelListComponent } from './components/model-list/model-list.component';
import { ModelFormComponent } from './components/model-form/model-form.component';
import { ModelAuditComponent } from './components/model-audit/model-audit.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'categories/:category', component: ModelListComponent },
  { path: 'categories/:category/audit', component: ModelAuditComponent },
  { path: 'categories/:category/create', component: ModelFormComponent },
  { path: 'categories/:category/edit/:modelName', component: ModelFormComponent },
];
