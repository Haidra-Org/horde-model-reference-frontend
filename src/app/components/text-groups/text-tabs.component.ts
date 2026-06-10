import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { IconComponent } from '../common/icon.component';

export interface TextTab {
  route: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-text-tabs',
  imports: [RouterLink, RouterLinkActive, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'tablist',
    '[attr.aria-label]': '"Text group sections"',
  },
  template: `
    <div class="text-tabs">
      @for (tab of tabs(); track tab.route) {
        <a
          [routerLink]="[tab.route]"
          routerLinkActive="text-tabs__tab--active"
          class="text-tabs__tab"
          role="tab"
          [attr.aria-selected]="false"
        >
          <app-icon [name]="tab.icon" />
          <span>{{ tab.label }}</span>
        </a>
      }
    </div>
  `,
})
export class TextTabsComponent {
  readonly tabs = input.required<TextTab[]>();
}
