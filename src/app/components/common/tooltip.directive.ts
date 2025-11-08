import { Directive, input, computed, inject } from '@angular/core';
import { TooltipGlossaryService } from '../../services/tooltip-glossary.service';

/**
 * Directive to add a tooltip with a dotted underline to an element.
 * Can use either explicit text or lookup from the glossary service.
 *
 * Usage:
 * - Direct text: [appTooltip]="'Custom tooltip text'"
 * - Glossary lookup: [appTooltip]="'baseline'" [tooltipFromGlossary]="true"
 * - Glossary term: [appGlossaryTooltip]="'baseline'"
 */
@Directive({
  selector: '[appTooltip]',
  host: {
    class: 'tooltip-trigger',
    '[title]': 'tooltipText()',
  },
})
export class TooltipDirective {
  private readonly glossary = inject(TooltipGlossaryService);

  /**
   * The tooltip text to display, or glossary term to lookup
   */
  readonly appTooltip = input.required<string>();

  /**
   * If true, treat appTooltip as a glossary term key
   */
  readonly tooltipFromGlossary = input<boolean>(false);

  readonly tooltipText = computed(() => {
    const text = this.appTooltip();
    if (this.tooltipFromGlossary()) {
      return this.glossary.getTooltipText(text) || text;
    }
    return text;
  });
}

/**
 * Simplified directive for glossary-only tooltips
 *
 * Usage: [appGlossaryTooltip]="'baseline'"
 */
@Directive({
  selector: '[appGlossaryTooltip]',
  host: {
    class: 'tooltip-trigger',
    '[title]': 'tooltipText()',
  },
})
export class GlossaryTooltipDirective {
  private readonly glossary = inject(TooltipGlossaryService);

  /**
   * The glossary term to look up
   */
  readonly appGlossaryTooltip = input.required<string>();

  readonly tooltipText = computed(() => {
    return this.glossary.getTooltipText(this.appGlossaryTooltip()) || this.appGlossaryTooltip();
  });
}
