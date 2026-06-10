import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  OnDestroy,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ModelReferenceApiService } from '../../services/model-reference-api.service';
import { ShellContextService } from '../../services/shell-context.service';
import { AuthService } from '../../services/auth.service';
import { IconComponent } from '../common/icon.component';
import { TextTabsComponent } from './text-tabs.component';
import type {
  GroupFamilyResponse,
  GroupAliasResponse,
  DetectFamiliesResponse,
} from '../../api-client';

@Component({
  selector: 'app-text-families',
  imports: [IconComponent, TextTabsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './text-families.component.html',
})
export class TextFamiliesComponent implements OnInit, OnDestroy {
  private readonly api = inject(ModelReferenceApiService);
  private readonly shellContext = inject(ShellContextService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly families = signal<GroupFamilyResponse[]>([]);
  readonly aliases = signal<GroupAliasResponse[]>([]);
  readonly suggestionData = signal<DetectFamiliesResponse | null>(null);

  readonly canApprove = computed(
    () => this.api.backendCapabilities().writable && this.auth.isApprover(),
  );

  readonly textTabs = [
    { route: '/text-groups', label: 'Groups', icon: 'branch' },
    { route: '/text-groups/families', label: 'Families & aliases', icon: 'layers' },
  ];

  ngOnInit(): void {
    this.shellContext.setContext({
      breadcrumb: [
        { label: 'Catalog' },
        { label: 'Families & aliases', route: ['/text-groups/families'] },
      ],
      title: 'Families & aliases',
      sub: 'Families link architecturally-distinct groups under one brand. Aliases canonicalize alternate names to a group.',
      actions: [],
    });

    forkJoin({
      families: this.api.listFamilies(),
      aliases: this.api.listAliases(),
      suggestions: this.api.detectFamilySuggestions(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ families, aliases, suggestions }) => {
          this.families.set(families.families ?? []);
          this.aliases.set(aliases.entries ?? []);
          this.suggestionData.set(suggestions);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
        },
      });
  }

  ngOnDestroy(): void {
    this.shellContext.clearContext();
  }

  navigateToGroup(groupName: string): void {
    this.router.navigate(['/text-groups', groupName]);
  }

  navigateToFamilies(): void {
    this.router.navigate(['/text-groups/families']);
  }
}
