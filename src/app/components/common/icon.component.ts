import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { IconRegistryService } from '../../services/icon-registry.service';

@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'app-icon',
    '[attr.aria-hidden]': 'ariaLabel() ? null : "true"',
    '[attr.aria-label]': 'ariaLabel()',
    '[attr.role]': 'ariaLabel() ? "img" : null',
  },
  template: `<svg
    #svgEl
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  ></svg>`,
})
export class IconComponent {
  readonly name = input.required<string>();
  readonly ariaLabel = input<string>();

  private readonly registry = inject(IconRegistryService);
  private readonly svgRef = viewChild.required<ElementRef<SVGSVGElement>>('svgEl');

  constructor() {
    afterRenderEffect(() => {
      const pathData = this.registry.get(this.name());
      const el = this.svgRef().nativeElement;
      if (!pathData) {
        console.warn(`[IconComponent] Unknown icon: "${this.name()}"`);
        el.innerHTML = '';
        return;
      }
      el.innerHTML = `<path d="${pathData}" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6"/>`;
    });
  }
}
