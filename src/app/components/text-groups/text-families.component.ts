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
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, finalize, forkJoin, map, of } from 'rxjs';
import { ModelReferenceApiService } from '../../services/model-reference-api.service';
import { ViewerCapabilitiesService } from '../../services/viewer-capabilities.service';
import { ShellContextService } from '../../services/shell-context.service';
import { NotificationService } from '../../services/notification.service';
import { IconComponent } from '../common/icon.component';
import { TextTabsComponent } from './text-tabs.component';
import type {
  GroupFamilyResponse,
  GroupAliasResponse,
  DetectFamiliesResponse,
  GroupMemberInfo,
} from '../../api-client';
import { sortTextModelMembers } from '../../utils/text-model-sort';

type FamilyWorkspaceView = 'saved' | 'aliases' | 'suggestions';

interface FamilyModelGroup {
  groupName: string;
  members: GroupMemberInfo[];
  loadFailed?: boolean;
}

@Component({
  selector: 'app-text-families',
  imports: [RouterLink, IconComponent, TextTabsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './text-families.component.html',
})
export class TextFamiliesComponent implements OnInit, OnDestroy {
  private readonly api = inject(ModelReferenceApiService);
  private readonly viewer = inject(ViewerCapabilitiesService);
  private readonly shellContext = inject(ShellContextService);
  private readonly notifications = inject(NotificationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly families = signal<GroupFamilyResponse[]>([]);
  readonly aliases = signal<GroupAliasResponse[]>([]);
  readonly suggestionData = signal<DetectFamiliesResponse | null>(null);
  readonly suggestionQuery = signal('');
  readonly activeView = signal<FamilyWorkspaceView>('saved');
  readonly dismissedSuggestions = signal<string[]>([]);
  readonly savingFamily = signal<string | null>(null);
  readonly loadError = signal<string | null>(null);
  readonly expandedFamily = signal<string | null>(null);
  readonly familyModelGroups = signal<Map<string, FamilyModelGroup[]>>(new Map());
  readonly familyModelsLoading = signal<string | null>(null);
  readonly familyModelsError = signal<string | null>(null);

  readonly canApprove = this.viewer.canApprove;

  readonly detectedFamilies = computed(() => {
    const persisted = new Set(this.families().map((family) => family.family_name));
    const dismissed = new Set(this.dismissedSuggestions());
    const query = this.suggestionQuery().trim().toLocaleLowerCase();

    return (this.suggestionData()?.suggestions ?? []).filter((family) => {
      if (persisted.has(family.family_name) || dismissed.has(family.family_name)) return false;
      if (!query) return true;
      return (
        family.family_name.toLocaleLowerCase().includes(query) ||
        family.members.some((member) => member.toLocaleLowerCase().includes(query))
      );
    });
  });

  readonly aliasRuleCount = computed(() =>
    this.aliases().reduce((count, entry) => count + entry.aliases.length, 0),
  );

  readonly textTabs = [
    { route: '/text-groups', label: 'Groups', icon: 'branch' },
    { route: '/text-groups/families', label: 'Families & aliases', icon: 'layers' },
  ];

  ngOnInit(): void {
    const requestedView = this.route.snapshot.queryParamMap.get('view');
    if (isFamilyWorkspaceView(requestedView)) this.activeView.set(requestedView);

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
          this.loadError.set('Families and aliases could not be loaded. Please try again.');
          this.loading.set(false);
        },
      });
  }

  ngOnDestroy(): void {
    this.shellContext.clearContext();
  }

  navigateToGroup(groupName: string): void {
    this.router.navigate(['/text-groups/group'], { queryParams: { name: groupName } });
  }

  navigateToFamilies(): void {
    this.router.navigate(['/text-groups/families']);
  }

  modelGroupsForFamily(familyName: string): FamilyModelGroup[] {
    return this.familyModelGroups().get(familyName) ?? [];
  }

  toggleFamilyModels(family: GroupFamilyResponse): void {
    if (this.expandedFamily() === family.family_name) {
      this.expandedFamily.set(null);
      return;
    }

    this.expandedFamily.set(family.family_name);
    this.familyModelsError.set(null);
    if (this.familyModelGroups().has(family.family_name)) return;

    this.familyModelsLoading.set(family.family_name);
    const groupRequests = family.members.map((groupName) =>
      this.api.getGroupMembers(groupName).pipe(
        map((response) => ({
          groupName,
          members: sortTextModelMembers(
            response.members.filter((member) => !member.is_backend_duplicate),
            response.name_format,
          ),
          loadFailed: false,
        })),
        catchError(() => of({ groupName, members: [] as GroupMemberInfo[], loadFailed: true })),
      ),
    );

    (groupRequests.length ? forkJoin(groupRequests) : of([] as FamilyModelGroup[]))
      .pipe(
        finalize(() => this.familyModelsLoading.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (groups) => {
          this.familyModelGroups.update((current) => {
            const updated = new Map(current);
            updated.set(family.family_name, groups);
            return updated;
          });
          if (groups.every((group) => group.loadFailed) && family.members.length > 0) {
            this.familyModelsError.set(family.family_name);
          }
        },
      });
  }

  setActiveView(view: FamilyWorkspaceView): void {
    this.activeView.set(view);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { view: view === 'saved' ? null : view },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  updateSuggestionQuery(event: Event): void {
    this.suggestionQuery.set((event.target as HTMLInputElement).value);
  }

  persistSuggestion(family: GroupFamilyResponse): void {
    if (!this.canApprove() || this.savingFamily()) return;

    this.savingFamily.set(family.family_name);
    this.api
      .setFamily(family.family_name, family.members)
      .pipe(
        finalize(() => this.savingFamily.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (saved) => {
          this.families.update((families) =>
            [...families.filter((item) => item.family_name !== saved.family_name), saved].sort(
              (a, b) => a.family_name.localeCompare(b.family_name),
            ),
          );
          this.notifications.success(`Saved ${saved.family_name} as a group family.`);
          this.setActiveView('saved');
        },
        error: () => {
          this.notifications.error(`Could not save the ${family.family_name} family.`);
        },
      });
  }

  dismissSuggestion(familyName: string): void {
    this.dismissedSuggestions.update((names) => [...names, familyName]);
    this.notifications.info(
      'Dismissed ' +
        familyName +
        ' for this review session. Detector suggestions are recomputed by the API.',
    );
  }
}

function isFamilyWorkspaceView(value: string | null): value is FamilyWorkspaceView {
  return ['saved', 'aliases', 'suggestions'].includes(value ?? '');
}
