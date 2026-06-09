import { Injectable } from '@angular/core';

/**
 * Registry of SVG path data for named icons.
 * Icons are registered at app startup via `registerAll()`.
 *
 * Path data mirrors the prototype's ICON_PATHS in design/ui.jsx
 * (Heroicons-style, 1.5–2px stroke, currentColor).
 */
@Injectable({ providedIn: 'root' })
export class IconRegistryService {
  private readonly icons = new Map<string, string>();

  register(name: string, svgPath: string): void {
    this.icons.set(name, svgPath);
  }

  registerAll(icons: Record<string, string>): void {
    for (const [name, path] of Object.entries(icons)) {
      this.icons.set(name, path);
    }
  }

  get(name: string): string | undefined {
    return this.icons.get(name);
  }

  has(name: string): boolean {
    return this.icons.has(name);
  }
}
