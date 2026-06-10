import { Injectable, signal } from '@angular/core';

/**
 * Breadcrumb segment — a single step in the breadcrumb trail.
 * When `route` is provided, the segment renders as a routerLink.
 */
export interface BreadcrumbSegment {
  /** Display label */
  label: string;
  /** Optional route array for routerLink; if omitted, rendered as plain text */
  route?: unknown[];
}

/**
 * Topbar action descriptor.
 * Views push actions into ShellContextService and the TopbarComponent renders them.
 */
export interface TopbarAction {
  /** Unique identifier for tracking */
  id: string;
  /** Button label */
  label: string;
  /** Optional icon name (inline SVG identifier) */
  icon?: string;
  /** Visual weight — 'primary' renders as the page's main CTA */
  kind?: 'primary' | 'ghost';
  /** Click handler */
  action: () => void;
}

/**
 * Context the TopbarComponent reads to render breadcrumb, title, and actions.
 * Each routed view sets this in ngOnInit and clears it in ngOnDestroy.
 */
export interface ShellContext {
  breadcrumb: BreadcrumbSegment[];
  title: string;
  sub?: string;
  actions: TopbarAction[];
}

const EMPTY_CONTEXT: ShellContext = {
  breadcrumb: [],
  title: '',
  actions: [],
};

/**
 * Singleton service that decouples routed views from the TopbarComponent.
 *
 * Views call `setContext(...)` during init and `clearContext()` on destroy.
 * The TopbarComponent reads `context` reactively via signals.
 */
@Injectable({
  providedIn: 'root',
})
export class ShellContextService {
  private readonly _context = signal<ShellContext>(EMPTY_CONTEXT);

  /** Current shell context (reactive). Read by TopbarComponent. */
  readonly context = this._context.asReadonly();

  /** Convenience accessors for the topbar template */
  readonly breadcrumb = () => this._context().breadcrumb;
  readonly title = () => this._context().title;
  readonly sub = () => this._context().sub;
  readonly actions = () => this._context().actions;

  /**
   * Set the full shell context.
   * Called by routed views in ngOnInit.
   */
  setContext(context: ShellContext): void {
    this._context.set({ ...context });
  }

  /**
   * Clear the shell context.
   * Called by routed views in ngOnDestroy.
   */
  clearContext(): void {
    this._context.set(EMPTY_CONTEXT);
  }
}
