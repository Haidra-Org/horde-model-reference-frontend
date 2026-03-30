# Styling Guide

Styling conventions for the Horde Model Reference frontend. For the CSS class catalog and extended reference, see the centralized CSS files under `src/styles/`.

---

## Core Principles

1. **Centralized Styles Only** — All styles live in `src/styles/*.css` and `src/shared/design-system/`. Component CSS files must remain empty except for documented exceptions (see below).
2. **Semantic Classes Over Utility Soup** — Prefer `.card`, `.alert-danger`, `.status-badge-success` over long chains of inline Tailwind utilities. Semantic classes are readable, searchable, and refactorable.
3. **Theme Tokens, Not Raw Colors** — All color references must use theme tokens (`primary-*`, `success-*`, `danger-*`, `warning-*`, `info-*`, `gray-*`). Never use raw Tailwind color names (`red-*`, `blue-*`, `emerald-*`, `amber-*`, `rose-*`, `sky-*`, `purple-*`, etc.) in templates or component code.
4. **Dark Mode by Default** — All components must support dark mode. Use `dark:` variants for every color/background declaration. The `DarkModeService` manages state.
5. **Shared Foundations, Local Extensions** — Common tokens and primitives come from the shared design system (`src/shared/design-system/`). Project-specific classes live in `src/styles/components/`.

---

## Technology Stack

- **Tailwind CSS v4** — CSS-first configuration using `@theme` directive (no `tailwind.config.js`)
- **CSS Layers** — `@layer components` for cascade ordering
- **Shared Design System** — Submodule at `src/shared/design-system/` providing tokens and primitives

---

## File Organization

```
src/styles/
├── tailwind.css              # Root import — loads shared system + local extensions
├── theme/
│   └── variables.css         # Project-specific tokens (heatmap colors, etc.)
├── components/
│   ├── base.css              # Badges, tags, info boxes, form helpers
│   ├── data-display.css      # Heatmap, audit status, filter pills, diff display
│   ├── layout.css            # Navigation, sidebar, modals, form sections
│   └── utilities.css         # Theme switcher, timeline, speed badges
└── themes/
    └── overrides.css         # Theme-specific overrides (utilitarian, etc.)

src/shared/design-system/     # Git submodule — shared with AiHordeFrontpage
├── tokens/
│   ├── colors.css            # Semantic color scales (primary, success, danger, etc.)
│   ├── spacing.css           # Spacing tokens
│   └── glass.css             # Glass effect tokens
└── primitives/
    ├── alerts.css            # .alert, .alert-success, .alert-danger, etc.
    ├── badges.css            # .badge, .badge-success, .badge-danger, etc.
    ├── buttons.css           # .btn, .btn-primary, .btn-danger, etc.
    ├── cards.css             # .card, .card-header, .card-body, etc.
    ├── forms.css             # .form-input, .form-label, .form-select, etc.
    ├── modals.css            # .modal-overlay, .modal-dialog, etc.
    ├── surfaces.css          # Surface primitives
    └── typography.css        # Heading and text classes
```

---

## Color System

### Theme Token Names

All colors must reference the semantic token scales defined in `src/shared/design-system/tokens/colors.css`:

| Token       | Hue   | Use Case                              |
| ----------- | ----- | ------------------------------------- |
| `primary-*` | Blue  | Primary actions, active states, links |
| `success-*` | Green | Success states, additions, approved   |
| `danger-*`  | Red   | Errors, deletions, rejected           |
| `warning-*` | Amber | Warnings, pending, critical           |
| `info-*`    | Cyan  | Informational, applied, neutral-info  |
| `gray-*`    | Gray  | Neutral, disabled, muted              |

### Forbidden Raw Color Names

Never use these raw Tailwind color names in templates or component code:

`red-*`, `blue-*`, `green-*`, `yellow-*`, `emerald-*`, `amber-*`, `rose-*`, `sky-*`, `purple-*`, `indigo-*`, `teal-*`, `cyan-*`, `orange-*`, `pink-*`

Instead, map to the closest semantic token:

| Raw Tailwind | Correct Theme Token |
| ------------ | ------------------- |
| `red-*`      | `danger-*`          |
| `blue-*`     | `primary-*`         |
| `green-*`    | `success-*`         |
| `emerald-*`  | `success-*`         |
| `yellow-*`   | `warning-*`         |
| `amber-*`    | `warning-*`         |
| `rose-*`     | `danger-*`          |
| `sky-*`      | `info-*`            |
| `purple-*`   | `info-*`            |
| `cyan-*`     | `info-*`            |

---

## Anti-Patterns

### 1. Raw Tailwind color classes in templates

```html
<!-- BAD: raw emerald color -->
<span class="bg-emerald-500/20 text-emerald-200">Approved</span>

<!-- GOOD: theme token -->
<span class="status-badge status-badge-success">Approved</span>
```

### 2. Inline styles in component decorators

```typescript
// BAD: styles in component
@Component({
  styles: [`.my-class { color: rgb(59 130 246); }`]
})

// GOOD: styles in centralized CSS
// (class defined in src/styles/components/utilities.css)
```

### 3. HTML `style=` attributes

```html
<!-- BAD: inline width -->
<col style="width: 33.5%" />

<!-- GOOD: CSS class -->
<col class="col-w-33-5" />
```

### 4. Hardcoded color values

```css
/* BAD: hardcoded RGB */
.my-element {
  color: rgb(59, 130, 246);
}

/* GOOD: theme token via @apply */
.my-element {
  @apply text-primary-500;
}
```

### 5. Duplicating existing classes

Check `src/styles/` and `src/shared/design-system/primitives/` before creating new utility classes. Common patterns already have semantic classes.

---

## Documented Exceptions

Three components are permitted to use component-scoped CSS:

| Component                   | Mechanism   | Justification                                                              |
| --------------------------- | ----------- | -------------------------------------------------------------------------- |
| `json-editor.component.ts`  | `styleUrls` | Syntax highlighting requires scoped CSS                                    |
| `json-display.component.ts` | `styleUrls` | Syntax highlighting requires scoped CSS                                    |
| `delta-diff.component.ts`   | `styles`    | Diff rendering (monospace, color-coded lines) tightly coupled to component |

All other components must have no `styles:` or `styleUrl:` properties.

---

## Quick Reference

| Need                    | Use                                                               |
| ----------------------- | ----------------------------------------------------------------- |
| Primary button          | `.btn-primary`                                                    |
| Secondary button        | `.btn-secondary`                                                  |
| Danger button           | `.btn-danger`                                                     |
| Small button            | `.btn-sm`                                                         |
| Card                    | `.card`, `.card-header`, `.card-body`                             |
| Form input              | `.form-input`                                                     |
| Form label              | `.form-label`                                                     |
| Select                  | `.form-select`                                                    |
| Textarea                | `.form-textarea`                                                  |
| Checkbox                | `.form-checkbox`                                                  |
| Error text              | `.form-error`                                                     |
| Hint text               | `.form-hint`                                                      |
| Required marker         | `text-danger-500`                                                 |
| Badge (generic)         | `.badge` + `.badge-success` / `.badge-danger` / etc.              |
| Tag (outline)           | `.tag` + `.tag-primary` / `.tag-success` / `.tag-info`            |
| Info box                | `.info-box` + `.info-box-warning` / etc.                          |
| Alert (border-left)     | `.alert` + `.alert-danger` / `.alert-warning` / etc.              |
| Alert (rounded banner)  | `.alert-banner` + `.alert-banner-danger` / `-warning`             |
| Status badge (pill)     | `.status-badge` + `-success` / `-danger` / `-warning` / `-info`   |
| Change badge (bordered) | `.change-badge` + `-added` / `-modified` / `-deleted`             |
| Filter pill             | `.filter-pill` + `-active-primary` / `-success` / etc.            |
| Stat count number       | `.stat-count-success` / `.stat-count-danger` / `.stat-count-info` |
| Critical indicator      | `.critical-badge`, `.critical-ring`                               |
| Diff field text         | `.change-text-added` / `.change-text-modified` / etc.             |
| Diff values             | `.diff-value-old`, `.diff-value-new`                              |
| Modal                   | `.modal-overlay`, `.modal-dialog`                                 |
| Data table              | `.data-table` (wrapper with pre-styled table elements)            |
| Heading (page)          | `.heading-page`                                                   |
| Heading (section)       | `.heading-section`                                                |
| Muted text              | `.text-muted`                                                     |
| Link                    | `.link`                                                           |

---

## Verification Commands

Run these to check for styling violations:

```bash
# No component inline styles (except 3 exceptions)
grep -rn "styles:" src/app/ --include="*.ts" | grep -v "styleUrl" | grep -v "spec.ts" | grep -v "json-editor" | grep -v "json-display" | grep -v "delta-diff"
# Expected: 0 results

# No HTML inline style= attributes
grep -rn 'style=' src/app/ --include="*.html"
# Expected: 0 results

# No hardcoded RGB/RGBA/hex values
grep -rn "rgb\|rgba\|#[0-9a-fA-F]" src/app/ --include="*.ts" --include="*.html" | grep -v "api-client" | grep -v "node_modules" | grep -v "spec.ts"
# Expected: 0 results

# No raw Tailwind color names (non-theme)
grep -rn "bg-red-\|text-red-\|bg-blue-\|text-blue-\|bg-emerald-\|text-emerald-\|bg-rose-\|text-rose-\|bg-amber-\|text-amber-\|bg-sky-\|text-sky-\|bg-purple-\|text-purple-" src/app/ --include="*.ts" --include="*.html" | grep -v "api-client" | grep -v "spec.ts"
# Expected: 0 results
```

---

## Further Reading

- **[CONTRIBUTING.md](CONTRIBUTING.md)** — Development workflow, code conventions, pre-commit checks
- **[.claude/CLAUDE.md](.claude/CLAUDE.md)** — Full architecture reference
- **[docs/style-cleanup-and-glass-migration/](docs/style-cleanup-and-glass-migration/)** — Multi-phase styling roadmap
