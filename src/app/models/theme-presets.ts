import { ThemeDefinition } from './theme.model';

/**
 * Enumerates the themes offered to users. The actual color tokens and
 * presentation tweaks live in CSS (`tailwind.css`), which keeps visual
 * concerns alongside styling utilities and prevents duplication of palettes
 * across TypeScript and stylesheets.
 */
export const THEME_DEFINITIONS: ThemeDefinition[] = [
  {
    id: 'default-light',
    name: 'Default Light',
    description: 'Modern, colorful theme with gradients and shadows',
    family: 'default',
    colorMode: 'light',
  },
  {
    id: 'default-dark',
    name: 'Default Dark',
    description: 'Modern, colorful dark theme with gradients and shadows',
    family: 'default',
    colorMode: 'dark',
  },
  {
    id: 'utilitarian-light',
    name: 'Utilitarian Light',
    description: 'Dense, data-first design with compact spacing and sharp edges',
    family: 'utilitarian',
    colorMode: 'light',
  },
  {
    id: 'utilitarian-dark',
    name: 'Utilitarian Dark',
    description: 'Dense, data-first dark design with compact spacing and sharp edges',
    family: 'utilitarian',
    colorMode: 'dark',
  },
];
