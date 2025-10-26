import { Directive, input } from '@angular/core';

/**
 * Directive to add a tooltip with a dotted underline to an element.
 * Uses the native title attribute for the tooltip content.
 */
@Directive({
  selector: '[appTooltip]',
  host: {
    class: 'tooltip-trigger',
    '[title]': 'appTooltip()',
  },
})
export class TooltipDirective {
  /**
   * The tooltip text to display
   */
  readonly appTooltip = input.required<string>();
}
